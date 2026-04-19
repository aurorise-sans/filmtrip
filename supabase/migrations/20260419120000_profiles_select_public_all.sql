-- profiles：任何人可讀取所有列（公開個人頁、Feed 作者等）
-- 取代「僅限至少一筆公開旅程」的舊規則。
-- INSERT / UPDATE 仍僅限本人（既有 policies 不變）。

DROP POLICY IF EXISTS "profiles_select_public_trip_authors" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

COMMENT ON POLICY "profiles_select_all" ON public.profiles IS
  '匿名與登入使用者皆可 SELECT 任意 profiles 列（與 profiles_select_own 並存為 PERMISSIVE OR）';
