-- 照片按讚：每使用者每照片一筆
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.photos (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT likes_user_id_photo_id_unique UNIQUE (user_id, photo_id)
);

CREATE INDEX IF NOT EXISTS likes_photo_id_idx ON public.likes (photo_id);

COMMENT ON TABLE public.likes IS '使用者對公開動態照片的按讚';

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 任何人可讀（含未登入），用於顯示按讚數
DROP POLICY IF EXISTS "likes_select_all" ON public.likes;
CREATE POLICY "likes_select_all"
  ON public.likes
  FOR SELECT
  TO public
  USING (true);

-- 僅本人可新增自己的按讚
DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
CREATE POLICY "likes_insert_own"
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 僅本人可刪除自己的按讚
DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;
CREATE POLICY "likes_delete_own"
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
