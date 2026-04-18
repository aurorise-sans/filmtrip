-- Feed 等公開頁：可讀取至少擁有一筆公開旅程之使用者的 profiles（頭像、顯示名稱）
-- 與 profiles_select_own 並存時為 PERMISSIVE OR
DROP POLICY IF EXISTS "profiles_select_public_trip_authors" ON public.profiles;
CREATE POLICY "profiles_select_public_trip_authors"
  ON public.profiles
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.user_id = profiles.id
        AND t.is_public = true
    )
  );
