<template>
  <div class="trip-detail">
    <p v-if="pending || (!pageData && !fetchError)" class="trip-detail__hint">載入中…</p>
    <p v-else-if="fetchError" class="trip-detail__error" role="alert">
      {{ fetchError }}
    </p>
    <template v-else-if="pageData">
      <header class="trip-detail__header">
        <NuxtLink class="trip-detail__back" to="/profile">← 返回個人</NuxtLink>
        <h1 class="trip-detail__title">{{ pageData.trip.name }}</h1>
        <p class="trip-detail__dates">
          <time :datetime="pageData.trip.start_date">{{
            formatDate(pageData.trip.start_date)
          }}</time>
          <span class="trip-detail__sep" aria-hidden="true">—</span>
          <time :datetime="pageData.trip.end_date">{{
            formatDate(pageData.trip.end_date)
          }}</time>
        </p>
      </header>

      <section
        class="trip-detail__section"
        aria-labelledby="trip-photos-heading"
      >
        <div class="trip-detail__section-head">
          <h2 id="trip-photos-heading" class="trip-detail__section-title">
            照片
          </h2>
<TripPhotoUploadPanel
  v-if="tripId"
  :trip-id="tripId"
  :user-id="userId || ''"
  @uploaded="onPhotosUploaded"
/>
        </div>

        <div v-if="pageData.photos.length" class="trip-detail__grid">
          <figure
            v-for="photo in pageData.photos"
            :key="photo.id"
            class="trip-detail__figure"
          >
            <img
              class="trip-detail__thumb"
              :src="photo.image_url"
              :alt="photoCaption(photo) || '旅程照片'"
              loading="lazy"
              decoding="async"
            />
            <figcaption
              v-if="photoCaption(photo)"
              class="trip-detail__caption"
            >
              {{ photoCaption(photo) }}
            </figcaption>
          </figure>
        </div>

        <div v-else class="trip-detail__empty">
          <p class="trip-detail__empty-text">尚無照片</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
type TripDetail = {
  id: string
  name: string
  start_date: string
  end_date: string
}

type PhotoRow = {
  id: string
  image_url: string
  created_at: string
  latitude: number | null
  longitude: number | null
  place_name: string | null
}

const route = useRoute()
const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()

const userId = computed(() => userClaims.value?.id ?? null)

const tripId = computed(() => {
  const id = route.params.id
  if (typeof id === "string") return id
  if (Array.isArray(id) && id[0]) return id[0]
  return ""
})

const { data: pageData, pending, error, refresh } = await useAsyncData(
  () => `trip-detail-${tripId.value}`,
  async () => {
    if (!tripId.value) {
      await navigateTo("/profile", { replace: true })
      return null
    }

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date, user_id")
      .eq("id", tripId.value)
      .maybeSingle()

    if (tripErr || !trip) {
      await navigateTo("/profile", { replace: true })
      return null
    }

    const { data: photos, error: photosErr } = await supabase
      .from("photos")
      .select("id, image_url, created_at, latitude, longitude, place_name")
      .eq("trip_id", tripId.value)
      .order("created_at", { ascending: false })

    if (photosErr) throw photosErr

    return {
      trip: trip as TripDetail,
      photos: (photos ?? []) as PhotoRow[],
    }
  },
  { watch: [tripId] },
)

const fetchError = computed(() => error.value?.message ?? null)

async function onPhotosUploaded() {
  const { data: photos } = await supabase
    .from("photos")
    .select("id, image_url, created_at, latitude, longitude, place_name")
    .eq("trip_id", tripId.value)
    .order("created_at", { ascending: false })

  if (pageData.value && photos) {
    pageData.value = { ...pageData.value, photos: photos as PhotoRow[] }
  }
}

function photoCaption(photo: PhotoRow) {
  const name = photo.place_name?.trim()
  if (name) return name
  if (photo.latitude != null && photo.longitude != null) {
    return `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`
  }
  return ""
}

useHead(() => ({
  title: pageData.value?.trip?.name
    ? `${pageData.value.trip.name} | Filmtrip`
    : "旅程 | Filmtrip",
}))

function formatDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}
</script>

<style lang="scss" scoped>
.trip-detail {
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;

  &__hint {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__error {
    margin: 0;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__header {
    margin-bottom: 2rem;
  }

  &__back {
    display: inline-block;
    margin-bottom: 0.75rem;
    font-size: 0.9375rem;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__dates {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  &__sep {
    margin: 0 0.35rem;
    opacity: 0.6;
  }

  &__section {
    margin-top: 0.5rem;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.65rem;
  }

  &__figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__thumb {
    aspect-ratio: 1;
    width: 100%;
    border-radius: 0.375rem;
    overflow: hidden;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    object-fit: cover;
    display: block;
  }

  &__caption {
    margin: 0;
    font-size: 0.6875rem;
    line-height: 1.3;
    color: var(--color-text-muted);
    word-break: break-word;
  }

  &__empty {
    padding: 2rem 1rem;
    text-align: center;
    border: 1px dashed var(--color-border-strong);
    border-radius: 0.5rem;
    background: var(--color-surface);
  }

  &__empty-text {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }
}
</style>