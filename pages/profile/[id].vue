<template>
  <div>
    <template v-if="pending">
      <div class="profile">
        <p class="profile__hint">載入中…</p>
      </div>
    </template>

    <template v-else-if="loadError">
      <div class="profile">
        <p class="profile__error" role="alert">
          {{ loadError }}
        </p>
        <nav class="profile__nav">
          <NuxtLink class="profile__link profile__link--muted" to="/">
            回到首頁
          </NuxtLink>
        </nav>
      </div>
    </template>

    <template v-else-if="notFound">
      <div class="profile profile--missing">
        <p class="profile__hint">找不到此使用者</p>
        <p class="profile__missing-code" aria-hidden="true">404</p>
        <nav class="profile__nav">
          <NuxtLink class="profile__link profile__link--muted" to="/">
            回到首頁
          </NuxtLink>
        </nav>
      </div>
    </template>

    <div v-else-if="profileRow" class="profile">
      <div class="profile__head">
        <h1 class="profile__title">使用者檔案</h1>
      </div>

      <section class="profile__identity" aria-label="使用者資訊">
        <div
          class="profile__avatar-btn profile__avatar-btn--view"
          aria-hidden="true"
        >
          <img
            v-if="profileRow.avatar_url"
            class="profile__avatar-img"
            :src="profileRow.avatar_url"
            alt=""
            width="80"
            height="80"
          >
          <User v-else class="profile__avatar-icon" :size="40" aria-hidden="true" />
        </div>
        <h2 class="profile__display-name">{{ displayName }}</h2>
        <p class="profile__location">{{ locationLine }}</p>
        <p class="profile__trip-count">{{ tripCountLabel }}</p>
      </section>

      <section class="profile__section" aria-labelledby="public-trips-heading">
        <div class="profile__section-head">
          <h2 id="public-trips-heading" class="profile__section-title">
            公開旅程
          </h2>
        </div>

        <p v-if="!tripsList.length" class="profile__hint">
          尚無公開旅程。
        </p>
        <ul v-else class="profile__list">
          <li
            v-for="trip in tripsList"
            :key="trip.id"
            class="profile__trip-card"
          >
            <div class="profile__trip-card-head">
              <div class="profile__trip-card-head-main">
                <p class="profile__trip-card-name">
                  {{ trip.name }}
                </p>
                <p class="profile__trip-card-dates">
                  <time :datetime="trip.start_date">{{ formatDate(trip.start_date) }}</time>
                  <span class="profile__trip-card-date-sep" aria-hidden="true">—</span>
                  <time :datetime="trip.end_date">{{ formatDate(trip.end_date) }}</time>
                </p>
              </div>
              <NuxtLink
                class="profile__trip-card-more"
                :to="`/trips/${trip.id}`"
              >
                查看更多
              </NuxtLink>
            </div>
            <div class="profile__trip-card-strip-wrap">
              <ul
                v-if="sortedPhotos(trip).length"
                class="profile__trip-card-strip"
                role="list"
                aria-label="旅程照片"
              >
                <li
                  v-for="photo in sortedPhotos(trip)"
                  :key="photo.id"
                  class="profile__trip-card-strip-item"
                >
                  <img
                    class="profile__trip-card-strip-img"
                    :src="photo.image_url"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  >
                </li>
              </ul>
              <p
                v-else
                class="profile__trip-card-strip-empty"
              >
                尚無照片
              </p>
            </div>
          </li>
        </ul>
      </section>

      <nav class="profile__nav">
        <NuxtLink class="profile__link profile__link--muted" to="/">
          回到首頁
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User } from "lucide-vue-next"
import { resolveUserDisplayName } from "~/utils/resolveUserDisplayName"

type TripPhotoRow = {
  id: string
  image_url: string
  created_at: string
  sort_order: number
}

type TripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
  photos: TripPhotoRow[] | null
}

type ProfilePublicRow = {
  id: string
  avatar_url: string | null
  display_name: string | null
  city: string | null
  country: string | null
  email: string | null
}

type PublicProfileBundle = {
  profile: ProfilePublicRow | null
  trips: TripRow[]
}

const route = useRoute()
const supabase = useSupabaseClient()

const userId = computed(() => {
  const raw = route.params.id
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : ""
})

const { data: bundle, pending, error: loadErr } = await useAsyncData(
  () => `profile-public-${userId.value}`,
  async (): Promise<PublicProfileBundle> => {
    const id = userId.value
    if (!id) {
      return { profile: null, trips: [] }
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, city, country, email")
      .eq("id", id)
      .maybeSingle()

    if (pErr) throw pErr
    if (!profile) {
      return { profile: null, trips: [] }
    }

    const { data: tripRows, error: tErr } = await supabase
      .from("trips")
      .select(
        "id, name, start_date, end_date, created_at, photos(id, image_url, created_at, sort_order)",
      )
      .eq("user_id", id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })

    if (tErr) throw tErr
    return {
      profile: profile as ProfilePublicRow,
      trips: (tripRows ?? []) as TripRow[],
    }
  },
  { watch: [userId] },
)

const profileRow = computed(() => bundle.value?.profile ?? null)
const tripsList = computed(() => bundle.value?.trips ?? [])

const loadError = computed(() => loadErr.value?.message ?? "")
const notFound = computed(
  () => !pending.value && !loadErr.value && !profileRow.value,
)

const displayName = computed(() =>
  resolveUserDisplayName({
    profileDisplayName: profileRow.value?.display_name,
    email: profileRow.value?.email ?? null,
  }),
)

const locationLine = computed(() => {
  const city = profileRow.value?.city?.trim()
  const country = profileRow.value?.country?.trim()
  if (city && country) {
    return `${city}, ${country}`
  }
  if (city) {
    return city
  }
  if (country) {
    return country
  }
  return "尚未設定居住地"
})

const tripCountLabel = computed(() => `${tripsList.value.length} 筆旅程`)

function sortedPhotos(trip: TripRow): TripPhotoRow[] {
  const photos = trip.photos
  if (!photos?.length) return []
  return [...photos].sort((a, b) => a.sort_order - b.sort_order)
}

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
</script>

<style lang="scss" scoped>
/* 與 `profile.vue` 個人檔案頁對齊（旅程卡片與版面） */
.profile {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;

  &--missing {
    text-align: center;
  }

  &__head {
    margin-bottom: 0.5rem;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
    gap: 0.35rem;
  }

  &__avatar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    padding: 0;
    margin-bottom: 0.5rem;
    overflow: hidden;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 50%;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;

    &--view {
      cursor: default;
      pointer-events: none;
    }
  }

  &__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-icon {
    color: var(--color-text-muted);
  }

  &__display-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__location {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__trip-count {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__missing-code {
    margin: 0.35rem 0 0;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  &__section {
    margin-bottom: 2rem;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

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

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__trip-card {
    border-radius: 0.75rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  }

  &__trip-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  &__trip-card-head-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    min-width: 0;
    flex: 1;
  }

  &__trip-card-strip-wrap {
    width: 100%;
  }

  &__trip-card-strip {
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

  &__trip-card-strip-item {
    flex: 0 0 auto;
    height: 100%;
    margin: 0;
    display: flex;
    align-items: stretch;
    border-radius: 8px;
    overflow: hidden;
  }

  &__trip-card-strip-img {
    display: block;
    height: 100%;
    width: auto;
    max-height: 100%;
    object-fit: cover;
    vertical-align: middle;
  }

  &__trip-card-strip-empty {
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

  &__trip-card-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text);
    line-height: 1.35;
  }

  &__trip-card-dates {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__trip-card-date-sep {
    margin: 0 0.25rem;
    opacity: 0.6;
  }

  &__trip-card-more {
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

  &__nav {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__link {
    font-size: 0.9375rem;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &--muted {
      color: var(--color-text-muted);
    }
  }
}
</style>
