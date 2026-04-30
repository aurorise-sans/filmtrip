<template>
  <div class="feed-page">
    <p v-if="fetchError" class="feed-page__error" role="alert">
      {{ fetchError }}
    </p>

    <template v-else>
      <p v-if="pending" class="feed-page__state">載入中…</p>
      <p
        v-else-if="!orderedFeedItems.length"
        class="feed-page__state feed-page__state--muted"
      >
        500 公尺內沒有可顯示的公開照片。
      </p>

      <template v-else>
        <ul class="feed-page__list">
          <li
            v-for="{ row, layout } in displayedRowsWithPhotoLayout"
            :key="row.photo.id"
            class="feed-photo-card"
          >
            <NuxtLink
              class="feed-photo-card__author-row"
              :to="`/profile/${row.authorUserId}`"
              :aria-label="`作者個人頁：${row.displayName}`"
            >
              <span class="feed-photo-card__avatar-wrap">
                <img
                  v-if="row.profile.avatar_url"
                  class="feed-photo-card__avatar-img"
                  :src="row.profile.avatar_url"
                  alt=""
                  width="24"
                  height="24"
                  loading="lazy"
                  decoding="async"
                >
                <User
                  v-else
                  class="feed-photo-card__avatar-fallback"
                  :size="16"
                  aria-hidden="true"
                />
              </span>
              <span class="feed-photo-card__author-name text-display-2xs-bold">
                {{ row.displayName }}
              </span>
            </NuxtLink>

            <NuxtLink
              :class="layout.linkClass"
              :to="`/trips/${row.trip.id}`"
            >
              <img
                :class="layout.imgClass"
                :src="row.photo.image_url"
                alt=""
                loading="lazy"
                decoding="async"
                @load="onFeedPhotoImgLoad($event, row.photo.id)"
              >
            </NuxtLink>

            <div class="feed-photo-card__toolbar">
              <div class="feed-photo-card__actions">
                <button
                  type="button"
                  class="feed-photo-card__icon-btn"
                  :class="{
                    'feed-photo-card__icon-btn--liked': isPhotoLikedByMe(
                      row.photo.id,
                    ),
                  }"
                  aria-label="按讚"
                  :aria-pressed="isPhotoLikedByMe(row.photo.id)"
                  @click="onFeedLikeClick(row.photo.id)"
                >
                  <Heart
                    :size="24"
                    aria-hidden="true"
                    :fill="
                      isPhotoLikedByMe(row.photo.id) ? 'currentColor' : 'none'
                    "
                  />
                </button>
                <button
                  v-if="row.hasCoords"
                  type="button"
                  class="feed-photo-card__icon-btn"
                  aria-label="附近照片地圖"
                  @click="onFeedMapClick(row.photo.id)"
                >
                  <MapIcon :size="24" aria-hidden="true" />
                </button>
                <span
                  v-else
                  class="feed-photo-card__icon-btn feed-photo-card__icon-btn--disabled"
                  aria-disabled="true"
                  aria-label="此照片無座標，無法顯示地圖"
                >
                  <MapIcon :size="24" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  class="feed-photo-card__icon-btn"
                  :class="{
                    'feed-photo-card__icon-btn--bookmarked': isPhotoBookmarkedByMe(
                      row.photo.id,
                    ),
                  }"
                  aria-label="收藏"
                  :aria-pressed="isPhotoBookmarkedByMe(row.photo.id)"
                  @click="onFeedBookmarkClick(row.photo.id)"
                >
                  <Bookmark
                    :size="24"
                    aria-hidden="true"
                    :fill="
                      isPhotoBookmarkedByMe(row.photo.id)
                        ? 'currentColor'
                        : 'none'
                    "
                  />
                </button>
              </div>

              <NuxtLink
                class="feed-photo-card__trip-link"
                :to="`/trips/${row.trip.id}`"
                :aria-label="`旅程：${row.trip.name}`"
              >
                <span class="feed-photo-card__trip-cover">
                  <img
                    v-if="row.trip.coverImageUrl"
                    class="feed-photo-card__trip-cover-img"
                    :src="row.trip.coverImageUrl"
                    alt=""
                    width="24"
                    height="24"
                    loading="lazy"
                    decoding="async"
                  >
                </span>
                <span class="feed-photo-card__trip-name text-display-2xs-bold">
                  {{ row.trip.name }}
                </span>
              </NuxtLink>
            </div>
          </li>
        </ul>

        <p v-if="loadingMore" class="feed-page__state feed-page__state--muted">
          載入更多…
        </p>

        <div
          ref="feedSentinel"
          class="feed-page__sentinel"
          aria-hidden="true"
        />

        <CollectionSheet
          v-if="bookmarkSheetPhotoId"
          :photo-id="bookmarkSheetPhotoId"
          :open="bookmarkSheetOpen"
          :feed-collections="userCollections"
          @close="bookmarkSheetOpen = false"
          @closed="onBookmarkSheetClosed"
          @saved="onBookmarkSaved"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue"
import { onBeforeRouteLeave } from "vue-router"
import { Bookmark, Heart, MapPin as MapIcon, User } from "lucide-vue-next"
import { resolveUserDisplayName } from "~/utils/resolveUserDisplayName"
import { haversineDistanceMeters } from "~/utils/haversine"

const BATCH_SIZE = 10
const LIKE_META_CHUNK = 200
const RADIUS_M = 500

definePageMeta({
  scrollToTop: false,
})

useHeader({
  left: "back",
  center: "附近的照片",
})

const route = useRoute()
const photoId = computed(() => {
  const raw = route.params.photoId
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : ""
})
const startPhotoId = computed(() => {
  const raw = route.query.start
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : ""
})

/** 從地圖標記進入須納入「中心照片」；從 nearby 頁進入則排除中心（維持原邏輯） */
const feedEntryFromMap = computed(
  () =>
    (typeof route.query.from === "string"
      ? route.query.from
      : Array.isArray(route.query.from)
        ? route.query.from[0]
        : "") === "map",
)

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
  created_at: string
  trips: TripEmbed
}

type ProfileRow = {
  id: string
  avatar_url: string | null
  display_name: string | null
  email: string | null
}

type FeedItem = {
  authorUserId: string
  photo: Pick<
    PhotoRow,
    "id" | "image_url" | "latitude" | "longitude" | "place_name" | "created_at"
  >
  trip: { id: string; name: string; coverImageUrl: string | null }
  profile: ProfileRow
  displayName: string
  hasCoords: boolean
}

type NearbyFeedResult = {
  center: PhotoRow | null
  items: FeedItem[]
}

type NearbyFeedSnapshot = {
  key: string
  loadedCount: number
  intrinsic: Record<string, { w: number; h: number }>
}

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const scrollStorageKey = computed(
  () =>
    `filmtrip-nearby-feed-scroll-y:${photoId.value}:${startPhotoId.value}:${
      feedEntryFromMap.value ? "map" : "nearby"
    }`,
)

const nearbyFeedScrollYRestore = useState<number | null>(
  "nearby-feed-scroll-y-restore",
  () => null,
)
const nearbyFeedSnapshot = useState<NearbyFeedSnapshot | null>(
  "nearby-feed-snapshot",
  () => null,
)

const likeCountByPhotoId = ref<Record<string, number>>({})
const likedByMeByPhotoId = ref<Record<string, boolean>>({})
const userCollections = ref<
  { id: string; name: string; created_at: string }[]
>([])
const bookmarkedByMeByPhotoId = ref<Record<string, boolean>>({})

const bookmarkSheetOpen = ref(false)
const bookmarkSheetPhotoId = ref<string | null>(null)

const intrinsicByPhotoId = ref<Record<string, { w: number; h: number }>>({})

const { data, pending, error } = await useAsyncData(
  () =>
    `nearby-feed-${photoId.value}-${feedEntryFromMap.value ? "map" : "nearby"}`,
  async (): Promise<NearbyFeedResult> => {
    const centerId = photoId.value
    const includeCenterInFeed = feedEntryFromMap.value
    if (!centerId) return { center: null, items: [] }

    const { data: centerRow, error: centerErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, user_id, trip_id, created_at, trips!inner(id, name, is_public)",
      )
      .eq("id", centerId)
      .eq("trips.is_public", true)
      .maybeSingle()
    if (centerErr) throw centerErr
    const center = centerRow as PhotoRow | null
    if (!center || center.latitude == null || center.longitude == null) {
      return { center: null, items: [] }
    }

    const { data: allRows, error: allErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, user_id, trip_id, created_at, trips!inner(id, name, is_public)",
      )
      .eq("trips.is_public", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
    if (allErr) throw allErr

    const centerLat = center.latitude
    const centerLng = center.longitude
    const within500m = ((allRows ?? []) as PhotoRow[]).filter((row) => {
      if (row.latitude == null || row.longitude == null) return false
      if (row.id === center.id) {
        return includeCenterInFeed
      }
      const d = haversineDistanceMeters(
        centerLat,
        centerLng,
        row.latitude,
        row.longitude,
      )
      return d <= RADIUS_M
    })

    within500m.sort((a, b) => b.created_at.localeCompare(a.created_at))

    const authorIds = [...new Set(within500m.map((r) => r.user_id))]
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, email")
      .in("id", authorIds)
    if (profileErr) throw profileErr
    const profileMap = new Map(
      (profileRows ?? []).map((p) => [p.id, p as ProfileRow]),
    )

    const tripIds = [...new Set(within500m.map((r) => r.trip_id))]
    const tripCoverByTripId = new Map<string, string>()
    if (tripIds.length) {
      const { data: coverRows, error: coverErr } = await supabase
        .from("photos")
        .select("trip_id, image_url, sort_order")
        .in("trip_id", tripIds)
        .order("sort_order", { ascending: true })
      if (coverErr) throw coverErr
      for (const cr of (coverRows ?? []) as {
        trip_id: string
        image_url: string
        sort_order: number
      }[]) {
        if (!tripCoverByTripId.has(cr.trip_id)) {
          tripCoverByTripId.set(cr.trip_id, cr.image_url)
        }
      }
    }

    const items: FeedItem[] = within500m.map((row) => {
      const profile = profileMap.get(row.user_id) ?? {
        id: row.user_id,
        avatar_url: null,
        display_name: null,
        email: null,
      }
      return {
        authorUserId: row.user_id,
        photo: {
          id: row.id,
          image_url: row.image_url,
          latitude: row.latitude,
          longitude: row.longitude,
          place_name: row.place_name,
          created_at: row.created_at,
        },
        trip: {
          id: row.trips.id,
          name: row.trips.name,
          coverImageUrl: tripCoverByTripId.get(row.trips.id) ?? null,
        },
        profile,
        displayName: resolveUserDisplayName({
          profileDisplayName: profile.display_name,
          email: profile.email,
        }),
        hasCoords:
          row.latitude != null &&
          row.longitude != null &&
          !Number.isNaN(row.latitude) &&
          !Number.isNaN(row.longitude),
      }
    })

    return { center, items }
  },
  { watch: [photoId, feedEntryFromMap] },
)

const fetchError = computed(() => error.value?.message ?? "")
const baseItems = computed(() => data.value?.items ?? [])

const orderedFeedItems = computed(() => {
  const list = baseItems.value
  const start = startPhotoId.value
  if (!start) return list
  const idx = list.findIndex((it) => it.photo.id === start)
  if (idx <= 0) return list
  return [list[idx]!, ...list.slice(0, idx), ...list.slice(idx + 1)]
})

const loadedCount = ref(0)
const loadingMore = ref(false)

const displayedRows = computed(() =>
  orderedFeedItems.value.slice(0, loadedCount.value),
)
const displayedRowsWithPhotoLayout = computed(() =>
  displayedRows.value.map((row) => ({
    row,
    layout: feedPhotoLayout(row.photo.id),
  })),
)

function loadNextBatch() {
  loadedCount.value = Math.min(
    orderedFeedItems.value.length,
    loadedCount.value + BATCH_SIZE,
  )
}

function onFeedPhotoImgLoad(e: Event, photoId: string) {
  const el = e.target
  if (!(el instanceof HTMLImageElement)) return
  const w = el.naturalWidth
  const h = el.naturalHeight
  if (!w || !h) return
  intrinsicByPhotoId.value = {
    ...intrinsicByPhotoId.value,
    [photoId]: { w, h },
  }
}

function feedPhotoMediaClass(photoId: string): "natural" | "crop-2-3" {
  const dims = intrinsicByPhotoId.value[photoId]
  if (!dims) return "natural"
  const { w, h } = dims
  if (!w || !h) return "natural"
  if (w > h) return "natural"
  if (h > w && h / w > 3 / 2) return "crop-2-3"
  return "natural"
}

function feedPhotoLayout(photoId: string) {
  const crop = feedPhotoMediaClass(photoId) === "crop-2-3"
  return {
    linkClass: crop
      ? "feed-photo-card__media feed-photo-card__media--crop-2-3"
      : "feed-photo-card__media feed-photo-card__media--natural",
    imgClass: crop
      ? "feed-photo-card__img feed-photo-card__img--cover"
      : "feed-photo-card__img",
  }
}

function isPhotoLikedByMe(photoId: string): boolean {
  return !!likedByMeByPhotoId.value[photoId]
}

function isPhotoBookmarkedByMe(photoId: string): boolean {
  return !!bookmarkedByMeByPhotoId.value[photoId]
}

async function fetchFeedLikeMeta(photoIds: string[]) {
  const uniq = [...new Set(photoIds)]
  if (!uniq.length) {
    likeCountByPhotoId.value = {}
    likedByMeByPhotoId.value = {}
    return
  }

  const counts: Record<string, number> = {}
  for (let i = 0; i < uniq.length; i += LIKE_META_CHUNK) {
    const chunk = uniq.slice(i, i + LIKE_META_CHUNK)
    const { data: likeRows, error: cErr } = await supabase
      .from("likes")
      .select("photo_id")
      .in("photo_id", chunk)
    if (cErr) throw cErr
    for (const row of likeRows ?? []) {
      const pid = row.photo_id as string
      counts[pid] = (counts[pid] ?? 0) + 1
    }
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const liked: Record<string, boolean> = {}
  if (authUser) {
    for (let i = 0; i < uniq.length; i += LIKE_META_CHUNK) {
      const chunk = uniq.slice(i, i + LIKE_META_CHUNK)
      const { data: mineRows, error: mErr } = await supabase
        .from("likes")
        .select("photo_id")
        .eq("user_id", authUser.id)
        .in("photo_id", chunk)
      if (mErr) throw mErr
      for (const row of mineRows ?? []) {
        liked[row.photo_id as string] = true
      }
    }
  }

  likeCountByPhotoId.value = counts
  likedByMeByPhotoId.value = liked
}

async function fetchUserCollections() {
  const {
    data: { user: u },
  } = await supabase.auth.getUser()
  if (!u) {
    userCollections.value = []
    return
  }
  const { data: rows, error: listErr } = await supabase
    .from("collections")
    .select("id, name, created_at")
    .order("created_at", { ascending: true })
  if (listErr) throw listErr
  userCollections.value = (rows ?? []) as {
    id: string
    name: string
    created_at: string
  }[]
}

async function fetchFeedBookmarkMeta(photoIds: string[]) {
  const uniq = [...new Set(photoIds)]
  if (!uniq.length) {
    bookmarkedByMeByPhotoId.value = {}
    return
  }

  const {
    data: { user: u },
  } = await supabase.auth.getUser()
  if (!u) {
    bookmarkedByMeByPhotoId.value = {}
    return
  }

  const saved: Record<string, boolean> = {}
  for (let i = 0; i < uniq.length; i += LIKE_META_CHUNK) {
    const chunk = uniq.slice(i, i + LIKE_META_CHUNK)
    const { data: itemRows, error: itemErr } = await supabase
      .from("collection_items")
      .select("photo_id")
      .in("photo_id", chunk)
    if (itemErr) throw itemErr
    for (const row of itemRows ?? []) {
      saved[(row as { photo_id: string }).photo_id] = true
    }
  }
  bookmarkedByMeByPhotoId.value = saved
}

async function refreshFeedCollectionContext(photoIds: string[]) {
  await fetchUserCollections()
  await fetchFeedBookmarkMeta(photoIds)
}

async function onFeedLikeClick(targetPhotoId: string) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) {
    await navigateTo("/login")
    return
  }

  const prevLiked = !!likedByMeByPhotoId.value[targetPhotoId]
  const prevCount = likeCountByPhotoId.value[targetPhotoId] ?? 0
  const nextLiked = !prevLiked

  likedByMeByPhotoId.value = {
    ...likedByMeByPhotoId.value,
    [targetPhotoId]: nextLiked,
  }
  likeCountByPhotoId.value = {
    ...likeCountByPhotoId.value,
    [targetPhotoId]: Math.max(0, prevCount + (nextLiked ? 1 : -1)),
  }

  try {
    if (nextLiked) {
      const { error: insErr } = await supabase.from("likes").insert({
        user_id: authUser.id,
        photo_id: targetPhotoId,
      })
      if (insErr) throw insErr
    } else {
      const { error: delErr } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", authUser.id)
        .eq("photo_id", targetPhotoId)
      if (delErr) throw delErr
    }
  } catch {
    likedByMeByPhotoId.value = {
      ...likedByMeByPhotoId.value,
      [targetPhotoId]: prevLiked,
    }
    likeCountByPhotoId.value = {
      ...likeCountByPhotoId.value,
      [targetPhotoId]: prevCount,
    }
  }
}

async function onFeedMapClick(targetPhotoId: string) {
  if (!user.value) {
    await navigateTo("/login")
    return
  }
  await navigateTo(`/nearby/${targetPhotoId}`)
}

async function onFeedBookmarkClick(targetPhotoId: string) {
  if (!user.value) {
    await navigateTo("/login")
    return
  }
  bookmarkSheetPhotoId.value = targetPhotoId
  bookmarkSheetOpen.value = true
}

function onBookmarkSheetClosed() {
  bookmarkSheetPhotoId.value = null
}

async function onBookmarkSaved(payload: {
  photoId: string
  isBookmarked: boolean
}) {
  bookmarkedByMeByPhotoId.value = {
    ...bookmarkedByMeByPhotoId.value,
    [payload.photoId]: payload.isBookmarked,
  }
  try {
    await refreshFeedCollectionContext(orderedFeedItems.value.map((it) => it.photo.id))
  } catch {
    /* ignore */
  }
}

const feedSentinel = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null

function setupFeedIntersectionObserver() {
  intersectionObserver?.disconnect()
  intersectionObserver = null
  const el = feedSentinel.value
  if (!el) return

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        if (pending.value) continue
        if (loadingMore.value) continue
        if (loadedCount.value >= orderedFeedItems.value.length) continue
        loadingMore.value = true
        try {
          loadNextBatch()
        } finally {
          loadingMore.value = false
        }
      }
    },
    {
      root: null,
      rootMargin: "120px",
      threshold: 0,
    },
  )
  intersectionObserver.observe(el)
}

function persistFeedNavigationState() {
  if (import.meta.server) return
  const y = window.scrollY
  nearbyFeedScrollYRestore.value = y
  try {
    sessionStorage.setItem(scrollStorageKey.value, String(y))
  } catch {
    /* ignore */
  }
  nearbyFeedSnapshot.value = {
    key: scrollStorageKey.value,
    loadedCount: loadedCount.value,
    intrinsic: { ...intrinsicByPhotoId.value },
  }
}

onBeforeRouteLeave(() => {
  persistFeedNavigationState()
})

onBeforeUnmount(() => {
  persistFeedNavigationState()
  intersectionObserver?.disconnect()
  intersectionObserver = null
})

function pickScrollRestoreTarget(): number | null {
  if (import.meta.server) return null
  if (nearbyFeedScrollYRestore.value != null) {
    const y = nearbyFeedScrollYRestore.value
    nearbyFeedScrollYRestore.value = null
    if (Number.isFinite(y) && y >= 0) return y
  }
  const raw = sessionStorage.getItem(scrollStorageKey.value)
  if (raw == null) return null
  const y = Number.parseFloat(raw)
  try {
    sessionStorage.removeItem(scrollStorageKey.value)
  } catch {
    /* ignore */
  }
  return Number.isFinite(y) && y >= 0 ? y : null
}

function restoreFeedScrollPosition(targetY: number) {
  if (import.meta.server) return
  let attempts = 0
  const maxAttempts = 90
  const tick = () => {
    attempts += 1
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    const y = Math.min(targetY, maxScroll)
    window.scrollTo({ top: y, left: 0, behavior: "auto" })
    const closeEnough = Math.abs(window.scrollY - y) <= 8
    const tallEnough = maxScroll >= targetY - 16
    if ((closeEnough && tallEnough) || attempts >= maxAttempts) {
      return
    }
    requestAnimationFrame(tick)
  }
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(tick)
    })
  })
}

onMounted(async () => {
  await nextTick()
  const snapshot = nearbyFeedSnapshot.value
  if (snapshot && snapshot.key === scrollStorageKey.value) {
    loadedCount.value = Math.max(
      Math.min(snapshot.loadedCount, orderedFeedItems.value.length),
      Math.min(BATCH_SIZE, orderedFeedItems.value.length),
    )
    intrinsicByPhotoId.value = { ...snapshot.intrinsic }
    nearbyFeedSnapshot.value = null
  } else {
    loadedCount.value = Math.min(BATCH_SIZE, orderedFeedItems.value.length)
  }

  const ids = orderedFeedItems.value.map((it) => it.photo.id)
  if (import.meta.client) {
    await fetchFeedLikeMeta(ids)
    await refreshFeedCollectionContext(ids)
  }

  await nextTick()
  setupFeedIntersectionObserver()
  await nextTick()
  const targetY = pickScrollRestoreTarget()
  if (targetY != null) {
    restoreFeedScrollPosition(targetY)
  }
})
</script>

<style lang="scss" scoped>
.feed-page {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 0;
  background: var(--color-white);
}

.feed-page__error {
  margin: 0;
  padding: 1rem 1rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-red-500);
}

.feed-page__state {
  margin: 0;
  padding: 1rem;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-gray-900);

  &--muted {
    color: var(--color-gray-500);
  }
}

.feed-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.feed-page__sentinel {
  height: 1px;
  pointer-events: none;
}

.feed-photo-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
}

.feed-photo-card__author-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: -2px;
  }
}

.feed-photo-card__avatar-wrap {
  box-sizing: border-box;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gray-100);
}

.feed-photo-card__avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.feed-photo-card__avatar-fallback {
  color: var(--color-gray-500);
}

.feed-photo-card__author-name {
  color: var(--color-gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.feed-photo-card__media {
  display: block;
  width: 100%;
  overflow: hidden;
  background: var(--color-gray-100);
  text-decoration: none;
  color: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: -2px;
  }
}

.feed-photo-card__media--natural {
  aspect-ratio: auto;
}

.feed-photo-card__media--crop-2-3 {
  aspect-ratio: 2 / 3;
}

.feed-photo-card__img {
  display: block;
  width: 100%;
  height: auto;
}

.feed-photo-card__img--cover {
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.feed-photo-card__toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
}

.feed-photo-card__actions {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.feed-photo-card__icon-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0;
  font: inherit;
  color: var(--color-gray-900);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition:
    color 0.15s ease,
    opacity 0.15s ease;

  &:hover:not(.feed-photo-card__icon-btn--disabled) {
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: 2px;
    border-radius: 2px;
  }
}

.feed-photo-card__icon-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.feed-photo-card__icon-btn--liked {
  color: var(--color-red-500);
}

.feed-photo-card__icon-btn--bookmarked {
  color: var(--color-gray-900);
}

.feed-photo-card__trip-link {
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  text-decoration: none;
  color: var(--color-gray-900);
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.feed-photo-card__trip-cover {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-photo-card__trip-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.feed-photo-card__trip-name {
  color: var(--color-gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
