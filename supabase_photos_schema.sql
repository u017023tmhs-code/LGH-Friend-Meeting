-- ==============================================================================
-- 賴冠宏專屬網站 (LGH-Friend-Meeting) - 活動回憶照片 Storage Bucket & activity_photos 資料表
-- 請在 Supabase Dashboard (https://supabase.com/dashboard)
-- 進入專案 -> 點擊左側「SQL Editor」-> 貼上以下完整 SQL 並點擊「Run」執行
-- ==============================================================================

-- 1. 建立 activity-photos 公開 Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'activity-photos',
    'activity-photos',
    true,
    52428800, -- 限制 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. 設定 Storage Objects RLS Policies
-- 允許所有人/訪客匿名讀取 activity-photos 圖片
DROP POLICY IF EXISTS "Allow public read activity-photos" ON storage.objects;
CREATE POLICY "Allow public read activity-photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'activity-photos');

-- 允許所有人/訪客匿名上傳圖片至 activity-photos (禁止未授權刪除或修改)
DROP POLICY IF EXISTS "Allow public insert activity-photos" ON storage.objects;
CREATE POLICY "Allow public insert activity-photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'activity-photos');

-- 3. 建立 activity_photos metadata 資料表
CREATE TABLE IF NOT EXISTS public.activity_photos (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL,
    caption TEXT,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_activity_photos_activity_id ON public.activity_photos(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_photos_uploaded_at ON public.activity_photos(uploaded_at);

-- 4. 啟用 Row Level Security (RLS)
ALTER TABLE public.activity_photos ENABLE ROW LEVEL SECURITY;

-- 5. 設定 activity_photos 資料表 RLS Policies
-- 允許所有人/訪客匿名 SELECT
DROP POLICY IF EXISTS "Allow public read activity_photos" ON public.activity_photos;
CREATE POLICY "Allow public read activity_photos"
ON public.activity_photos
FOR SELECT
TO public
USING (true);

-- 允許所有人/訪客匿名 INSERT (禁止匿名 UPDATE 與 DELETE)
DROP POLICY IF EXISTS "Allow public insert activity_photos" ON public.activity_photos;
CREATE POLICY "Allow public insert activity_photos"
ON public.activity_photos
FOR INSERT
TO public
WITH CHECK (true);

-- 6. 將 activity_photos 加入 Supabase Realtime 即時推播 (Publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'activity_photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_photos;
  END IF;
END $$;
