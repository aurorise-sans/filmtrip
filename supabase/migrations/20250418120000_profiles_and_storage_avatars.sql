-- 使用者公開檔案（頭像 URL 等）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  avatar_url TEXT,
  display_name TEXT,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS '使用者檔案；id 與 auth.users 一致';
COMMENT ON COLUMN public.profiles.avatar_url IS '頭像公開 URL（Storage bucket avatars，路徑 {user_id}/avatar.jpg）';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Storage：在 Dashboard 建立 bucket `avatars` 並勾選 Public；此處補上 policy
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read avatars bucket" ON storage.objects;
CREATE POLICY "Public read avatars bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated upload avatars own folder" ON storage.objects;
CREATE POLICY "Authenticated upload avatars own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated update avatars own folder" ON storage.objects;
CREATE POLICY "Authenticated update avatars own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Authenticated delete avatars own folder" ON storage.objects;
CREATE POLICY "Authenticated delete avatars own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
);
