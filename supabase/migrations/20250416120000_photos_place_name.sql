-- 在 Supabase SQL Editor 執行（若尚未套用）：讓無 GPS 的照片改以地點名稱儲存
-- Storage bucket「photos」請在 Dashboard → Storage 手動建立並設定權限（見專案說明）

ALTER TABLE public.photos
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS place_name text;

COMMENT ON COLUMN public.photos.place_name IS '無 GPS 時由使用者填寫的地點名稱';

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_location_chk;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_location_chk CHECK (
    (latitude IS NOT NULL AND longitude IS NOT NULL)
    OR (place_name IS NOT NULL AND length(trim(place_name)) > 0)
  );
