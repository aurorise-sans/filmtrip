-- 旅程封面圖 URL（公開 bucket 的 getPublicUrl）
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT NULL;

COMMENT ON COLUMN public.trips.cover_image_url IS '封面圖公開 URL（Storage bucket photos，路徑 covers/{user_id}/{trip_id}.jpg）';

-- 既有 policy 僅允許 {user_id}/... ；封面使用 covers/{user_id}/{trip_id}.jpg 需另設 policy（多條 PERMISSIVE 為 OR）
DROP POLICY IF EXISTS "Authenticated upload covers folder in photos" ON storage.objects;
CREATE POLICY "Authenticated upload covers folder in photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = 'covers'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated update covers folder in photos" ON storage.objects;
CREATE POLICY "Authenticated update covers folder in photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = 'covers'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = 'covers'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated delete covers folder in photos" ON storage.objects;
CREATE POLICY "Authenticated delete covers folder in photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = 'covers'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);
