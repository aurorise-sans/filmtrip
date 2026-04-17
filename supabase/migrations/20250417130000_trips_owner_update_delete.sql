-- 擁有者可更新、刪除自己的旅程；刪除旅程前可先刪除所屬照片列
DROP POLICY IF EXISTS "trips_update_own" ON public.trips;
CREATE POLICY "trips_update_own"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "trips_delete_own" ON public.trips;
CREATE POLICY "trips_delete_own"
  ON public.trips
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "photos_delete_own_trip" ON public.photos;
CREATE POLICY "photos_delete_own_trip"
  ON public.photos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_id
        AND t.user_id = (SELECT auth.uid())
    )
  );
