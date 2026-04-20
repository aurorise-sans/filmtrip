-- 收藏夾 collections + 收藏項目 collection_items（若已在 Dashboard 執行過可略過）

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections (id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.photos (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collection_items_collection_id_photo_id_unique UNIQUE (collection_id, photo_id)
);

CREATE INDEX IF NOT EXISTS collections_user_id_idx ON public.collections (user_id);
CREATE INDEX IF NOT EXISTS collection_items_collection_id_idx ON public.collection_items (collection_id);
CREATE INDEX IF NOT EXISTS collection_items_photo_id_idx ON public.collection_items (photo_id);

COMMENT ON TABLE public.collections IS '使用者收藏夾';
COMMENT ON TABLE public.collection_items IS '收藏夾內的照片（同一收藏夾內同一照片僅一筆）';

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections_select_own" ON public.collections;
CREATE POLICY "collections_select_own"
  ON public.collections
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "collections_insert_own" ON public.collections;
CREATE POLICY "collections_insert_own"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "collections_update_own" ON public.collections;
CREATE POLICY "collections_update_own"
  ON public.collections
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "collections_delete_own" ON public.collections;
CREATE POLICY "collections_delete_own"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_items_select_own" ON public.collection_items;
CREATE POLICY "collection_items_select_own"
  ON public.collection_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "collection_items_insert_own" ON public.collection_items;
CREATE POLICY "collection_items_insert_own"
  ON public.collection_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "collection_items_delete_own" ON public.collection_items;
CREATE POLICY "collection_items_delete_own"
  ON public.collection_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = (SELECT auth.uid())
    )
  );
