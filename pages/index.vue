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
          <div class="feed-card__author">
            <img
              v-if="authorAvatarUrl(trip)"
              class="feed-card__avatar"
              :src="authorAvatarUrl(trip)!"
              alt=""
              width="32"
              height="32"
              loading="lazy"
              decoding="async"
            >
            <User
              v-else
              class="feed-card__avatar feed-card__avatar--icon"
              :size="20"
              aria-hidden="true"
            />
            <span class="feed-card__author-name">{{ authorDisplayName(trip) }}</span>
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

          <div class="feed-card__footer">
            <div class="feed-card__footer-text">
              <p class="feed-card__trip-name">
                {{ trip.name }}
              </p>
              <p class="feed-card__dates">
                {{ formatDateRange(trip.start_date, trip.end_date) }}
              </p>
            </div>
            <NuxtLink
              class="feed-card__more"
              :to="`/trips/${trip.id}`"
            >
              查看更多
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

type FeedPhotoRow = {
  id: string
  image_url: string
  created_at: string
}

type ProfileRow = {
  id: string
  avatar_url: string | null
  display_name: string | null
  email: string | null
}

type FeedTripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  user_id: string
  photos: FeedPhotoRow[] | null
}

const supabase = useSupabaseClient()
const user = useSupabaseUser()

function sortedPhotos(trip: FeedTripRow): FeedPhotoRow[] {
  const photos = trip.photos
  if (!photos?.length) return []
  return [...photos].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function selfMetaString(key: string): string | null {
  const u = user.value
  if (!u || typeof u.user_metadata !== "object" || !u.user_metadata) {
    return null
  }
  const v = (u.user_metadata as Record<string, unknown>)[key]
  return typeof v === "string" && v.trim() ? v : null
}

const { data: trips, pending, error: loadError } = await useAsyncData(
  "feed-public-trips",
  async () => {
    const { data: tripRows, error: tripErr } = await supabase
      .from("trips")
      .select(
        "id, name, start_date, end_date, user_id, photos(id, image_url, created_at)",
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })

    if (tripErr) throw tripErr

    const tripsData = (tripRows ?? []) as FeedTripRow[]
    const userIds = [...new Set(tripsData.map((t) => t.user_id))]

    let profileById = new Map<string, ProfileRow>()
    if (userIds.length) {
      const { data: profileRows, error: profileErr } = await supabase
        .from("profiles")
        .select("id, avatar_url, display_name, email")
        .in("id", userIds)

      if (profileErr) throw profileErr

      profileById = new Map(
        (profileRows ?? []).map((p) => [p.id, p as ProfileRow]),
      )
    }

    return tripsData.map((t) => ({
      ...t,
      _profile: profileById.get(t.user_id) ?? null,
    }))
  },
)

type FeedTripWithProfile = FeedTripRow & {
  _profile: ProfileRow | null
}

const feedTrips = computed(() => (trips.value ?? []) as FeedTripWithProfile[])

function formatDateRange(start: string, end: string) {
  const fmt = (value: string) => {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  }
  return `${fmt(start)} — ${fmt(end)}`
}

function authorAvatarUrl(trip: FeedTripWithProfile): string | null {
  const fromDb = trip._profile?.avatar_url?.trim()
  if (fromDb) return fromDb
  if (user.value?.id === trip.user_id) {
    return selfMetaString("avatar_url")
  }
  return null
}

function authorDisplayName(trip: FeedTripWithProfile): string {
  const p = trip._profile
  const isSelf = user.value?.id === trip.user_id
  return resolveUserDisplayName({
    profileDisplayName: p?.display_name,
    email: p?.email ?? (isSelf ? user.value?.email : null),
    userMetadata: isSelf
      ? ((user.value?.user_metadata ?? null) as Record<string, unknown> | null)
      : null,
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

.feed-card__author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.feed-card__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
  background: rgba(15, 23, 42, 0.06);

  &--icon {
    padding: 0.35rem;
    box-sizing: border-box;
    color: var(--color-text-muted);
  }
}

.feed-card__author-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
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
  height: 280px;
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
  min-height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.04);
}

.feed-card__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem 1rem;
}

.feed-card__footer-text {
  min-width: 0;
  flex: 1;
}

.feed-card__trip-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
  line-height: 1.35;
}

.feed-card__dates {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.feed-card__more {
  flex-shrink: 0;
  align-self: center;
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
