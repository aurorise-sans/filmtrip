-- Feed 顯示名稱後援：從 email 取 @ 前綴需有 profiles.email
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.profiles.email IS '與 auth.users.email 同步，供公開顯示後援（@ 前綴）';

-- 既有資料：由 auth.users 回填
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR p.email IS DISTINCT FROM u.email);

-- 有帳號但尚無 profiles 列者補上（僅 id + email，其餘預設）
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO UPDATE
SET email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = now();

-- 之後 auth 註冊／變更 email 時同步到 profiles
CREATE OR REPLACE FUNCTION public.sync_profiles_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, updated_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email),
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_sync_profiles ON auth.users;
CREATE TRIGGER on_auth_user_email_sync_profiles
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profiles_email_from_auth();
