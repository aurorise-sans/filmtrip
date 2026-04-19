-- Feed 作者名：補齊僅有旅程但 profiles 缺 display_name / email 的列。
-- display_name 後援：僅使用既有 display_name，否則用 email @ 前綴（不使用 OAuth metadata）。
-- 需有 profiles.email 欄位時才更新 email；若無該欄位請刪除 SET 中的 email 行。
INSERT INTO public.profiles (id)
SELECT DISTINCT t.user_id
FROM public.trips t
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.user_id)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p
SET
  display_name = COALESCE(
    NULLIF(trim(p.display_name), ''),
    NULLIF(trim(split_part(u.email, '@', 1)), '')
  ),
  email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE u.id = p.id
  AND (
    (p.display_name IS NULL OR trim(p.display_name) = '')
    OR (p.email IS NULL AND u.email IS NOT NULL)
  );
