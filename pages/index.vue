<template>
  <div class="feed-page">
    <p v-if="fetchError" class="feed-page__error" role="alert">
      {{ fetchError }}
    </p>

    <template v-else>
      <p v-if="pending" class="feed-page__state">載入中…</p>
      <p
        v-else-if="!feedItems.length"
        class="feed-page__state feed-page__state--muted"
      >
        目前沒有公開照片。
      </p>

      <ul v-else class="feed-page__list">
        <li
          v-for="item in feedItems"
          :key="item.photo.id"
          class="feed-photo-card"
        >
          <div class="feed-photo-card__author">
            <NuxtLink
              class="feed-photo-card__author-link"
              :to="`/profile/${item.authorUserId}`"
            >
              <span class="feed-photo-card__avatar-wrap">
                <img
                  v-if="item.profile.avatar_url"
                  class="feed-photo-card__avatar"
                  :src="item.profile.avatar_url"
                  alt=""
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                >
                <User
                  v-else
                  class="feed-photo-card__avatar-icon"
                  :size="22"
                  aria-hidden="true"
                />
              </span>
              <span class="feed-photo-card__name">{{ item.displayName }}</span>
            </NuxtLink>
          </div>

          <div class="feed-photo-card__media">
            <img
              class="feed-photo-card__img"
              :src="item.photo.image_url"
              alt=""
              loading="lazy"
              decoding="async"
            >
          </div>

          <p
            v-if="item.addressLine"
            class="feed-photo-card__address"
          >
            {{ item.addressLine }}
          </p>

          <div class="feed-photo-card__actions">
            <a
              v-if="item.hasCoords"
              class="feed-photo-card__btn feed-photo-card__btn--map"
              :href="googleMapsUrl(item.photo.latitude!, item.photo.longitude!)"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Map
            </a>
            <button
              v-else
              type="button"
              class="feed-photo-card__btn feed-photo-card__btn--map feed-photo-card__btn--disabled"
              disabled
            >
              Google Map
            </button>
            <NuxtLink
              class="feed-photo-card__btn feed-photo-card__btn--trip"
              :to="`/trips/${item.trip.id}`"
            >
              查看旅程
            </NuxtLink>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { User } from "lucide-vue-next"
import { resolveUserDisplayName } from "~/utils/resolveUserDisplayName"

type TripEmbed = {
  id: string
  name: string
  is_public: boolean
}

type PhotoRow = {
  id: string
  image_url: string
  latitude: number | null
  longitude: number | null
  place_name: string | null
  user_id: string
  trip_id: string
  trips: TripEmbed
}

type ProfileRow = {
  id: string
  avatar_url: string | null
  display_name: string | null
  email: string | null
}

type FeedItem = {
  /** 照片列 `photos.user_id`，與登入者無關；連結作者頁必用此欄 */
  authorUserId: string
  photo: Pick<
    PhotoRow,
    "id" | "image_url" | "latitude" | "longitude" | "place_name"
  >
  trip: { id: string; name: string }
  profile: ProfileRow
  displayName: string
  addressLine: string | null
  hasCoords: boolean
}

const supabase = useSupabaseClient()

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 對應需求：優先 location / address；此專案目前以 place_name 儲存地點文字 */
function photoAddressLine(photo: {
  place_name?: string | null
  location?: string | null
  address?: string | null
}): string | null {
  const loc = typeof photo.location === "string" ? photo.location.trim() : ""
  const addr = typeof photo.address === "string" ? photo.address.trim() : ""
  const place = photo.place_name?.trim() ?? ""
  const line = loc || addr || place
  return line.length ? line : null
}

function hasValidCoords(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false
  return true
}

function googleMapsUrl(lat: number, lng: number) {
  const q = encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

const { data: feedData, pending, error: loadError } = await useAsyncData(
  "feed-public-photos",
  async () => {
    const { data: photoRows, error: pErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, user_id, trip_id, trips!inner(id, name, is_public)",
      )
      .eq("trips.is_public", true)

    if (pErr) throw pErr

    const rows = (photoRows ?? []) as PhotoRow[]
    if (!rows.length) return [] as FeedItem[]

    const userIds = [...new Set(rows.map((r) => r.user_id))]
    const { data: profRows, error: prErr } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, email")
      .in("id", userIds)

    if (prErr) throw prErr

    const profileMap = new Map(
      (profRows ?? []).map((p) => [p.id, p as ProfileRow]),
    )

    const items: FeedItem[] = rows.map((row) => {
      const authorUserId = row.user_id
      const profile = profileMap.get(authorUserId) ?? {
        id: authorUserId,
        avatar_url: null,
        display_name: null,
        email: null,
      }
      const displayName = resolveUserDisplayName({
        profileDisplayName: profile.display_name,
        email: profile.email,
      })
      const lat = row.latitude
      const lng = row.longitude
      return {
        authorUserId,
        photo: {
          id: row.id,
          image_url: row.image_url,
          latitude: lat,
          longitude: lng,
          place_name: row.place_name,
        },
        trip: { id: row.trips.id, name: row.trips.name },
        profile,
        displayName,
        addressLine: photoAddressLine(row),
        hasCoords: hasValidCoords(lat, lng),
      }
    })

    return shuffleInPlace(items)
  },
)

const feedItems = computed(() => feedData.value ?? [])
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

.feed-photo-card {
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  padding: 0.85rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feed-photo-card__author-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  text-decoration: none;
  color: inherit;

  &:hover .feed-photo-card__name {
    color: var(--color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 0.35rem;
  }
}

.feed-photo-card__avatar-wrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid var(--color-border);
}

.feed-photo-card__avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-photo-card__avatar-icon {
  color: var(--color-text-muted);
}

.feed-photo-card__name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.35;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.feed-photo-card__media {
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.06);
}

.feed-photo-card__img {
  display: block;
  width: 100%;
  height: auto;
}

.feed-photo-card__address {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.feed-photo-card__actions {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: stretch;
}

.feed-photo-card__btn {
  flex: 1;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0.4rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  border-radius: 0.5rem;
  border: 1px solid rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.06);
  color: var(--color-accent);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover:not(.feed-photo-card__btn--disabled) {
    background: rgba(37, 99, 235, 0.12);
    border-color: var(--color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.feed-photo-card__btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
