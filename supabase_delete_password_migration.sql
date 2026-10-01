-- ==============================================================================
-- 賴冠宏專屬網站 (LGH-Friend-Meeting) - 活動刪除密碼功能 Migration & RPC
-- 【修正版：徹底解決 PostgREST 多載衝突 (PGRST203)，只保留唯一相容函數】
-- 請在 Supabase Dashboard (https://supabase.com/dashboard)
-- 進入專案 -> 點擊左側「SQL Editor」-> 貼上以下完整 SQL 並點擊「Run」執行
-- ==============================================================================

-- 1. 啟用 pgcrypto 擴充套件（用於安全 bcrypt 雜湊與比對）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 在 activities 資料表新增 delete_password_hash 欄位（安全保存 bcrypt 雜湊，非明文）
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS delete_password_hash TEXT;

-- 3. 【核心修正】：安全自動清理資料庫中所有同名殘留函數 (徹底解決 Could not choose the best candidate function)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc
        WHERE proname IN ('create_activity_with_password', 'delete_activity_with_password', 'set_activity_delete_password')
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE;';
    END LOOP;
END $$;

-- 4. 建立唯一且與 script.js 100% 相容的 create_activity_with_password 函數
-- 說明：
-- 1. 唯一簽名，參數型別為 p_deadline TEXT，絕無任何多載衝突。
-- 2. 內部使用 COALESCE(p_deadline, '') 安全防護空字串與 NULL。
-- 3. 密碼採用 pgcrypto 進行 bcrypt 10 rounds 安全雜湊，絕不存明文。
CREATE OR REPLACE FUNCTION public.create_activity_with_password(
    p_id TEXT,
    p_title TEXT,
    p_creator TEXT,
    p_cover TEXT,
    p_deadline TEXT,
    p_options JSONB,
    p_delete_password TEXT,
    p_is_read_only BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hash TEXT;
BEGIN
    IF p_delete_password IS NULL OR length(trim(p_delete_password)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', '請設定刪除密碼');
    END IF;

    -- 使用 pgcrypto 進行安全 bcrypt 雜湊 (10 rounds salt)
    v_hash := crypt(p_delete_password, gen_salt('bf', 10));

    INSERT INTO public.activities (
        id, title, creator, cover, deadline, options, delete_password_hash, is_read_only, created_at
    ) VALUES (
        p_id, 
        p_title, 
        p_creator, 
        p_cover, 
        COALESCE(p_deadline, ''), 
        p_options, 
        v_hash, 
        COALESCE(p_is_read_only, true), 
        timezone('utc'::text, now())
    );

    RETURN jsonb_build_object('success', true, 'id', p_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. 建立安全 RPC：後端比對刪除密碼並聯集清除活動及其相關資料 (selections, messages, activity_photos, storage.objects, events)
-- 說明：
-- 1. 密碼正確才執行刪除；密碼錯誤或未輸入回傳錯誤代碼，不執行任何刪除。
-- 2. 嚴格交易原子性：storage.objects 與資料表清理同屬一筆交易，若出錯立即 Rollback，絕無孤兒照片。
CREATE OR REPLACE FUNCTION public.delete_activity_with_password(
    p_activity_id TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, storage
AS $$
DECLARE
    v_stored_hash TEXT;
    v_photo_count INT := 0;
BEGIN
    -- 1. 查找活動與其密碼 hash
    SELECT delete_password_hash INTO v_stored_hash
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', '找不到此活動');
    END IF;

    -- 2. 舊活動若尚未設定密碼
    IF v_stored_hash IS NULL OR length(trim(v_stored_hash)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_PASSWORD_SET', 'message', '此活動尚未設定刪除密碼，請先設定刪除密碼。');
    END IF;

    -- 3. 比對密碼 (以 crypt 安全比對)
    IF crypt(p_password, v_stored_hash) != v_stored_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_PASSWORD', 'message', '❌ 刪除密碼錯誤，無法刪除活動');
    END IF;

    -- 4. 密碼驗證通過，執行完整聯集原子清理 (任一步出錯整筆 Transaction 立即 Rollback)
    -- 清理 storage.objects 中該活動的所有實體照片檔案
    DELETE FROM storage.objects 
    WHERE bucket_id = 'activity-photos' 
      AND (name LIKE p_activity_id || '/%' OR (path_tokens IS NOT NULL AND path_tokens[1] = p_activity_id));
    GET DIAGNOSTICS v_photo_count = ROW_COUNT;

    -- 清理 activity_photos metadata
    DELETE FROM public.activity_photos WHERE activity_id = p_activity_id;

    -- 清理 messages 聊天紀錄
    DELETE FROM public.messages WHERE activity_id = p_activity_id;

    -- 清理 selections 投票紀錄
    DELETE FROM public.selections WHERE activity_id = p_activity_id;

    -- 清理 events (若資料庫中存在 events 資料表)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
        EXECUTE 'DELETE FROM public.events WHERE activity_id = $1' USING p_activity_id;
    END IF;

    -- 清理 activities 主紀錄
    DELETE FROM public.activities WHERE id = p_activity_id;

    RETURN jsonb_build_object('success', true, 'deleted_storage_objects', v_photo_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 6. 建立安全 RPC：為早期尚未設定刪除密碼的舊活動補設刪除密碼
CREATE OR REPLACE FUNCTION public.set_activity_delete_password(
    p_activity_id TEXT,
    p_new_password TEXT,
    p_creator_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_stored_hash TEXT;
    v_actual_creator TEXT;
BEGIN
    SELECT delete_password_hash, creator INTO v_stored_hash, v_actual_creator
    FROM public.activities
    WHERE id = p_activity_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', '找不到此活動');
    END IF;

    -- 只有當原本沒有設定密碼時，才允許設定
    IF v_stored_hash IS NOT NULL AND length(trim(v_stored_hash)) > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_SET', 'message', '此活動已有刪除密碼，無法直接重新設定');
    END IF;

    -- 建立者姓名核對防呆（若有提供則比對原活動建立人）
    IF p_creator_name IS NOT NULL AND length(trim(p_creator_name)) > 0 THEN
        IF trim(p_creator_name) != trim(v_actual_creator) THEN
            RETURN jsonb_build_object('success', false, 'error', 'CREATOR_MISMATCH', 'message', '建立者姓名核對不符，無法補設密碼');
        END IF;
    END IF;

    IF p_new_password IS NULL OR length(trim(p_new_password)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMPTY_PASSWORD', 'message', '密碼不能為空');
    END IF;

    UPDATE public.activities
    SET delete_password_hash = crypt(p_new_password, gen_salt('bf', 10))
    WHERE id = p_activity_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 7. 授予公開/匿名呼叫權限
GRANT EXECUTE ON FUNCTION public.create_activity_with_password(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN) TO anon, authenticated, service_role, public;
GRANT EXECUTE ON FUNCTION public.delete_activity_with_password(TEXT, TEXT) TO anon, authenticated, service_role, public;
GRANT EXECUTE ON FUNCTION public.set_activity_delete_password(TEXT, TEXT, TEXT) TO anon, authenticated, service_role, public;

-- 8. 強化 activities 資料表之 RLS 安全防護（防止未經授權直接 DELETE）
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 允許所有人匿名 SELECT
DROP POLICY IF EXISTS "Allow public read activities" ON public.activities;
CREATE POLICY "Allow public read activities"
ON public.activities
FOR SELECT
TO public
USING (true);

-- 允許所有人匿名 INSERT
DROP POLICY IF EXISTS "Allow public insert activities" ON public.activities;
CREATE POLICY "Allow public insert activities"
ON public.activities
FOR INSERT
TO public
WITH CHECK (true);

-- 禁止匿名直接 DELETE（強制所有刪除操作必須透過 delete_activity_with_password 密碼驗證）
DROP POLICY IF EXISTS "Allow public delete activities" ON public.activities;

-- 9. 重新載入 PostgREST schema cache（確保所有函數立即生效）
NOTIFY pgrst, 'reload schema';
