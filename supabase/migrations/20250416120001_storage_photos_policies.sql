-- 在 Dashboard → Storage 建立 bucket：`photos`
-- 建議勾選「Public bucket」以便 getPublicUrl 可直接在網頁顯示圖片
-- 再於 SQL Editor 執行以下 policy（若已存在同名 policy 請先刪除或改名）

-- 公開讀取（僅 photos bucket）
CREATE POLICY "Public read photos bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- 已登入使用者上傳到自己的 user_id 目錄：{user_id}/{trip_id}/...
CREATE POLICY "Authenticated upload own folder in photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- 已登入使用者可更新、刪除自己目錄下的物件（選用）
CREATE POLICY "Authenticated update own folder in photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "Authenticated delete own folder in photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND split_part(name, '/', 1) = auth.uid()::text
);
