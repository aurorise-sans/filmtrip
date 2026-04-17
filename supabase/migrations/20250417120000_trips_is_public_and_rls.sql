-- 公開旅程：未登入可讀 is_public = true 的旅程與其照片；登入者可另讀自己的私人旅程／照片
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.trips.is_public IS 'true 時允許匿名讀取此旅程與其照片';

-- 以下 policy 與既有 policy 並存時，同一操作多條 PERMISSIVE policy 為 OR 關係。
-- 若你曾在 Dashboard 建立過衝突的 SELECT policy，請視需要手動 DROP 後再執行。

-- trips：任何人可讀公開旅程
DROP POLICY IF EXISTS "trips_select_when_public" ON public.trips;
CREATE POLICY "trips_select_when_public"
  ON public.trips
  FOR SELECT
  TO public
  USING (is_public = true);

-- trips：登入者可讀自己的旅程（含私人）
DROP POLICY IF EXISTS "trips_select_own" ON public.trips;
CREATE POLICY "trips_select_own"
  ON public.trips
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- photos：任何人可讀「所屬旅程為公開」的照片
DROP POLICY IF EXISTS "photos_select_when_trip_public" ON public.photos;
CREATE POLICY "photos_select_when_trip_public"
  ON public.photos
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_id
        AND t.is_public = true
    )
  );

-- photos：登入者可讀自己旅程底下所有照片（含私人旅程）
DROP POLICY IF EXISTS "photos_select_own_trip" ON public.photos;
CREATE POLICY "photos_select_own_trip"
  ON public.photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_id
        AND t.user_id = (SELECT auth.uid())
    )
  );
