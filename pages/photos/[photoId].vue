<template>
  <div
    class="photo-page"
    :class="{
      'photo-page--immersive': !!photo,
      'photo-page--with-appbar': !!user && !!photo,
    }"
  >
    <p v-if="pending" class="photo-page__state">載入中…</p>
    <p v-else-if="loadError" class="photo-page__error" role="alert">
      {{ loadError }}
    </p>
    <template v-else-if="photo">
      <div class="photo-page__shell">
        <div class="photo-page__stage">
          <img
            class="photo-page__img"
            :src="photo.image_url"
            alt=""
            decoding="async"
          >
        </div>
        <div class="photo-page__footer">
          <NuxtLink
            class="photo-page__trip-btn"
            :to="`/trips/${photo.trip_id}`"
          >
            查看旅程
          </NuxtLink>
        </div>
      </div>
    </template>
    <p
      v-else-if="!pending && !loadError"
      class="photo-page__state"
    >
      找不到此照片或旅程未公開。
    </p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const user = useSupabaseUser()

const photoId = computed(() => {
  const raw = route.params.photoId
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : ""
})

type TripEmbed = { id: string; name: string; is_public: boolean }

type PhotoWithTrip = {
  id: string
  image_url: string
  latitude: number | null
  longitude: number | null
  place_name: string | null
  trip_id: string
  trips: TripEmbed
}

const supabase = useSupabaseClient()

const {
  data: photo,
  pending,
  error: loadErr,
} = await useAsyncData(
  () => `photo-detail-${photoId.value}`,
  async () => {
    const id = photoId.value
    if (!id) return null

    const { data: row, error: qErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, trip_id, trips!inner(id, name, is_public)",
      )
      .eq("id", id)
      .maybeSingle()

    if (qErr) throw qErr

    const p = row as PhotoWithTrip | null
    if (!p || !p.trips?.is_public) return null
    return p
  },
  { watch: [photoId] },
)

const loadError = computed(() => loadErr.value?.message ?? "")
</script>

<style lang="scss" scoped>
.photo-page {
  box-sizing: border-box;
}

/* 與 layouts/default：Header 52px + safe-area-top；有登入時再扣底部 App bar（與 main--with-appbar 一致） */
.photo-page--immersive {
  overflow: hidden;
  height: calc(100dvh - 52px - env(safe-area-inset-top, 0px));
}

.photo-page--immersive.photo-page--with-appbar {
  height: calc(
    100dvh - 52px - env(safe-area-inset-top, 0px) - 0.5rem - 44px - 0.5rem -
      env(safe-area-inset-bottom, 0px)
  );
}

.photo-page__shell {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.photo-page__state {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.photo-page__error {
  margin: 1rem 1.25rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border-radius: 0.375rem;
}

.photo-page__stage {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  width: 100%;
  background: #fff;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.photo-page__img {
  display: block;
  width: auto;
  max-width: 90%;
  max-height: 100%;
  height: auto;
  margin: auto;
  border-radius: 0;
  object-fit: contain;
  object-position: center;
}

.photo-page__footer {
  flex-shrink: 0;
  padding: 0.75rem 1.25rem;
  box-sizing: border-box;
}

.photo-page__trip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  text-align: center;
  border-radius: 0.5rem;
  background: var(--color-accent, #2563eb);
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.92;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}
</style>
