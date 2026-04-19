-- 移除旅程封面欄位與 photos bucket 內 covers/ 路徑的 Storage RLS policies
DROP POLICY IF EXISTS "Authenticated upload covers folder in photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update covers folder in photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete covers folder in photos" ON storage.objects;

ALTER TABLE public.trips
  DROP COLUMN IF EXISTS cover_image_url;
