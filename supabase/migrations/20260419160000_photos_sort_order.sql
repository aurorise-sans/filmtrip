-- photos：自訂排序（1-based），依旅程分組
-- 既有資料依 created_at ASC（同時間則 id）回填

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE public.photos AS p
SET sort_order = sub.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY trip_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.photos
) AS sub
WHERE p.id = sub.id;

ALTER TABLE public.photos
  ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_sort_order_positive_chk;

ALTER TABLE public.photos
  ADD CONSTRAINT photos_sort_order_positive_chk
  CHECK (sort_order >= 1);

COMMENT ON COLUMN public.photos.sort_order IS '旅程內照片順序（1-based，與 sort_order ASC 顯示順序一致）';

CREATE INDEX IF NOT EXISTS photos_trip_id_sort_order_idx
  ON public.photos (trip_id, sort_order);
