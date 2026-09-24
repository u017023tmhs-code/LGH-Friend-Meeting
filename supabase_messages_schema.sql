-- ==============================================================================
-- 賴冠宏專屬網站 (LGH-Friend-Meeting) - 活動聊天室 messages 資料表與 Realtime 啟用 SQL
-- 請在 Supabase Dashboard (https://supabase.com/dashboard)
-- 進入專案 -> 點擊左側「SQL Editor」-> 貼上以下 SQL 並點擊「Run」執行
-- ==============================================================================

-- 1. 建立 messages 聊天訊息資料表
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_messages_activity_id ON public.messages(activity_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 2. 啟用 Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. 設定 RLS Policies (無需登入，允許所有人/訪客匿名 SELECT 與 INSERT，禁止未授權的 DELETE 與 UPDATE)
DROP POLICY IF EXISTS "Allow public read messages" ON public.messages;
CREATE POLICY "Allow public read messages"
ON public.messages
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Allow public insert messages" ON public.messages;
CREATE POLICY "Allow public insert messages"
ON public.messages
FOR INSERT
TO public
WITH CHECK (true);

-- 4. 將 messages 加入 Realtime 即時推播 (Publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
