<template>
  <div class="feed-page">
    <p v-if="fetchError" class="feed-page__error" role="alert">
      {{ fetchError }}
    </p>

    <template v-else>
      <p v-if="pending" class="feed-page__state">載入中…</p>
      <p
        v-else-if="!feedTrips.length"
        class="feed-page__state feed-page__state--muted"
      >
        目前沒有公開旅程。
      </p>

      <ul v-else class="feed-page__list">
        <li
          v-for="trip in feedTrips"
          :key="trip.id"
          class="feed-card"
        >
          <div class="feed-card__head">
            <div class="feed-card__head-main">
              <p class="feed-card__trip-name">
                {{ trip.name }}
              </p>
              <p class="feed-card__dates">
                <time :datetime="trip.start_date">{{ formatDate(trip.start_date) }}</time>
                <span class="feed-card__date-sep" aria-hidden="true">—</span>
                <time :datetime="trip.end_date">{{ formatDate(trip.end_date) }}</time>
              </p>
            </div>
            <NuxtLink
              class="feed-card__more"
              :to="`/trips/${trip.id}`"
            >
              查看更多
            </NuxtLink>
          </div>

          <div class="feed-card__strip-wrap">
            <ul
              v-if="sortedPhotos(trip).length"
              class="feed-card__strip"
              role="list"
              aria-label="旅程照片"
            >
              <li
                v-for="photo in sortedPhotos(trip)"
                :key="photo.id"
                class="feed-card__strip-item"
              >
                <img
                  class="feed-card__strip-img"
                  :src="photo.image_url"
                  alt=""
                  loading="lazy"
                  decoding="async"
                >
              </li>
            </ul>
            <p
              v-else
              class="feed-card__strip-empty"
            >
              尚無照片
            </p>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
type FeedPhotoRow = {
  id: string
  image_url: string
  created_at: string
}

type FeedTripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  photos: FeedPhotoRow[] | null
}

const supabase = useSupabaseClient()

function sortedPhotos(trip: FeedTripRow): FeedPhotoRow[] {
  const photos = trip.photos
  if (!photos?.length) return []
  return [...photos].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

const { data: trips, pending, error: loadError } = await useAsyncData(
  "feed-public-trips",
  async () => {
    const { data: tripRows, error: tripErr } = await supabase
      .from("trips")
      .select(
        "id, name, start_date, end_date, photos(id, image_url, created_at)",
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })

    if (tripErr) throw tripErr

    return (tripRows ?? []) as FeedTripRow[]
  },
)

const feedTrips = computed(() => (trips.value ?? []) as FeedTripRow[])

/** 與個人檔案頁 `profile.vue` 的 formatDate 一致 */
function formatDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(d.getTime())) {
    return isoDate
  }
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}

const fetchError = computed(() => loadError.value?.message ?? "")
</script>

<style lang="scss" scoped>
.feed-page {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.5rem;
}

.feed-page__error {
  margin: 0;
  padding: 0.75rem 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.feed-page__state {
  margin: 0;
  padding: 1rem 0;
  font-size: 0.9375rem;
  color: var(--color-text);

  &--muted {
    color: var(--color-text-muted);
  }
}

.feed-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.feed-card {
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
}

.feed-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.feed-card__head-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
  flex: 1;
}

.feed-card__strip-wrap {
  width: 100%;
}

.feed-card__strip {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.45rem;
  height: 200px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.feed-card__strip-item {
  flex: 0 0 auto;
  height: 100%;
  margin: 0;
  display: flex;
  align-items: stretch;
  border-radius: 8px;
  overflow: hidden;
}

.feed-card__strip-img {
  display: block;
  height: 100%;
  width: auto;
  max-height: 100%;
  object-fit: cover;
  vertical-align: middle;
}

.feed-card__strip-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  min-height: 200px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.04);
}

.feed-card__trip-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.35;
}

.feed-card__dates {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.feed-card__date-sep {
  margin: 0 0.25rem;
  opacity: 0.6;
}

.feed-card__more {
  flex-shrink: 0;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-accent);
  text-decoration: none;
  border-radius: 0.5rem;
  border: 1px solid rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.06);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.12);
    border-color: var(--color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}
</style>
