<template>
  <div
    :key="collectionRouteId"
    class="collection-detail"
  >
    <p v-if="pending" class="collection-detail__state">載入中…</p>
    <p v-else-if="fetchError" class="collection-detail__error" role="alert">
      {{ fetchError }}
    </p>
    <template v-else-if="pageData">
      <header class="collection-detail__head">
        <h1 class="collection-detail__title">{{ pageData.collection.name }}</h1>
        <p class="collection-detail__subtitle">
          {{ pageData.photos.length }} 張照片
        </p>
      </header>

      <p
        v-if="!pageData.photos.length"
        class="collection-detail__state collection-detail__state--muted"
      >
        此收藏夾尚無照片。
      </p>
      <ul
        v-else
        class="collection-detail__grid"
        role="list"
      >
        <li
          v-for="photo in pageData.photos"
          :key="photo.id"
          class="collection-detail__cell"
        >
          <NuxtLink
            class="collection-detail__link"
            :to="`/photos/${photo.id}`"
          >
            <img
              class="collection-detail__img"
              :src="photo.image_url"
              alt=""
              loading="lazy"
              decoding="async"
            >
          </NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: "collections-auth",
})

const route = useRoute()

/** 供 template :key 與 asyncData key 使用，避免同頁切換收藏夾時沿用舊 DOM／快取 */
const collectionRouteId = computed(() => String(route.params.id ?? ""))

/** 每個收藏夾一個快取槽（Nuxt useAsyncData 以 key 區分） */
const collectionAsyncKey = computed(
  () => `collection-detail-${collectionRouteId.value}`,
)

const supabase = useSupabaseClient()

type PhotoBrief = {
  id: string
  image_url: string
}

const {
  data: pageData,
  pending,
  error: loadError,
} = await useAsyncData(
  collectionAsyncKey,
  async () => {
    const id = collectionRouteId.value
    console.log("[collection-detail] fetch 開始", {
      routeParamsId: route.params.id,
      collectionRouteId: id,
    })

    if (!id) {
      console.log("[collection-detail] 無 id，略過查詢")
      return null
    }

    const { data: col, error: cErr } = await supabase
      .from("collections")
      .select("id, name")
      .eq("id", id)
      .maybeSingle()

    console.log("[collection-detail] collections 查詢", {
      id,
      col,
      error: cErr,
      message: cErr?.message,
    })

    if (cErr) throw cErr
    if (!col) return null

    const { data: rows, error: iErr } = await supabase
      .from("collection_items")
      .select(
        `
        photo_id,
        created_at,
        photos (
          id,
          image_url
        )
      `,
      )
      .eq("collection_id", id)
      .order("created_at", { ascending: false })

    console.log("[collection-detail] collection_items 查詢", {
      collection_id: id,
      rowCount: rows?.length ?? 0,
      rows,
      error: iErr,
      message: iErr?.message,
    })

    if (iErr) throw iErr

    const photos: PhotoBrief[] = []
    for (const row of rows ?? []) {
      const r = row as {
        photos: PhotoBrief | PhotoBrief[] | null
      }
      const p = Array.isArray(r.photos) ? r.photos[0] : r.photos
      if (p?.id && p.image_url) {
        photos.push({ id: p.id, image_url: p.image_url })
      }
    }

    const result = {
      collection: { id: col.id as string, name: col.name as string },
      photos,
    }
    console.log("[collection-detail] 組裝結果", result)
    return result
  },
  { watch: [collectionRouteId] },
)

const fetchError = computed(() => {
  if (loadError.value) return loadError.value.message
  if (!pending.value && pageData.value === null) {
    return "找不到此收藏夾。"
  }
  return ""
})

onMounted(() => {
  console.log("[collections/[id].vue] mounted", {
    path: route.path,
    paramsId: route.params.id,
  })
})
</script>

<style lang="scss" scoped>
.collection-detail {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.5rem;
}

.collection-detail__state {
  margin: 0;
  padding: 1rem 0;
  font-size: 0.9375rem;
  color: var(--color-text);

  &--muted {
    color: var(--color-text-muted);
  }
}

.collection-detail__error {
  margin: 0;
  padding: 0.75rem 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.collection-detail__head {
  margin-bottom: 1rem;
}

.collection-detail__title {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.collection-detail__subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* 與 nearby 縮圖網格一致：3 欄、方格、圓角、間距 */
.collection-detail__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.collection-detail__cell {
  margin: 0;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.06);
}

.collection-detail__link {
  display: block;
  width: 100%;
  height: 100%;
  text-decoration: none;
  color: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 8px;
  }
}

.collection-detail__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>
