<template>
  <div class="feed-page">
    <p v-if="fetchError" class="feed-page__error" role="alert">
      {{ fetchError }}
    </p>

    <template v-else>
      <p v-if="showBlockingLoading" class="feed-page__state">載入中…</p>
      <p
        v-else-if="!baseFeedItems.length"
        class="feed-page__state feed-page__state--muted"
      >
        目前沒有公開照片。
      </p>

      <template v-else>
        <ul class="feed-page__list">
          <li
            v-for="{ row, layout } in displayedRowsWithPhotoLayout"
            :key="row._rowId"
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
                <span class="feed-photo-card__trip-name text-body-medium-medium">
                  {{ row.trip.name }}
                </span>
              </NuxtLink>
            </div>
          </li>
        </ul>

        <p v-if="loadingMore" class="feed-page__state feed-page__state--muted">
          載入更多…
        </p>

        <!-- 必須在列表／狀態列之後，IntersectionObserver 才會在捲到底時觸發 -->
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
import { Bookmark, Heart, Map as MapIcon, User } from "lucide-vue-next"
import { resolveUserDisplayName } from "~/utils/resolveUserDisplayName"

const FEED_SCROLL_STORAGE_KEY = "filmtrip-feed-scroll-y"

definePageMeta({
  /** 導向首頁時不強制捲到頂，改由 useState / sessionStorage + onMounted 還原 */
  scrollToTop: false,
})

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
  /** trip.coverImageUrl：該旅程內 sort_order 最小的照片（無則 null） */
  trip: { id: string; name: string; coverImageUrl: string | null }
  profile: ProfileRow
  displayName: string
  addressLine: string | null
  hasCoords: boolean
}

/** 列表列（含 Vue 用唯一 key；允許同照片多列） */
type FeedDisplayRow = FeedItem & { _rowId: string }

type FeedListSnapshot = {
  pool: FeedItem[]
  displayedRows: FeedDisplayRow[]
  rowIdSeq: number
  intrinsic: Record<string, { w: number; h: number }>
}

/** 避免離開再回來時 useAsyncData 重打 API */
const feedDataCache = useState<FeedItem[] | null>(
  "feed-public-data-cache",
  () => null,
)

/** 離開 Feed 時保存列表，返回時還原已載入批次 */
const feedListSnapshot = useState<FeedListSnapshot | null>(
  "feed-list-snapshot",
  () => null,
)

/** SPA 返回時的滾動位置（整頁重新整理會清空，另備 sessionStorage） */
const feedScrollYRestore = useState<number | null>(
  "feed-scroll-y-restore",
  () => null,
)

const LIKE_META_CHUNK = 200

const BATCH_SIZE = 20
const MAX_PHOTOS_PER_TRIP = 3
/** 同一作者在每批（20 筆）內最多幾張 */
const MAX_PHOTOS_PER_AUTHOR_PER_BATCH = 3

const supabase = useSupabaseClient()
const user = useSupabaseUser()

/** 各照片按讚總數（UI 暫不顯示，供樂觀更新與資料正確性） */
const likeCountByPhotoId = ref<Record<string, number>>({})
/** 目前登入者是否已對該照片按讚 */
const likedByMeByPhotoId = ref<Record<string, boolean>>({})
/** 目前登入者的收藏夾（Feed 預載；與 Sheet 內查詢一致） */
const userCollections = ref<
  { id: string; name: string; created_at: string }[]
>([])
/** 該照片是否出現在目前使用者的任一收藏夾 */
const bookmarkedByMeByPhotoId = ref<Record<string, boolean>>({})

const bookmarkSheetOpen = ref(false)
const bookmarkSheetPhotoId = ref<string | null>(null)

const feedHomeReshuffleTick = useState("feed-home-reshuffle-tick", () => 0)

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

/** 以圖檔載入後的 natural 尺寸判斷（DB 無寬高欄位） */
const intrinsicByPhotoId = ref<Record<string, { w: number; h: number }>>({})

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

/**
 * 橫式：維持原始比例不裁切。
 * 直式且高寬比 > 3:2（較 2:3 框更「瘦長」）：固定 2:3 + cover 置中裁切。
 * 其餘直式／正方形：維持原始比例不裁切。
 */
function feedPhotoMediaClass(
  photoId: string,
): "natural" | "crop-2-3" {
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

/**
 * 依 Feed 內照片 id 從 DB 載入按讚數與目前使用者是否已按讚。
 * 應在瀏覽器端呼叫（含 onMounted），以取得正確的 auth session。
 */
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
    data: { user },
  } = await supabase.auth.getUser()
  const liked: Record<string, boolean> = {}
  if (user) {
    for (let i = 0; i < uniq.length; i += LIKE_META_CHUNK) {
      const chunk = uniq.slice(i, i + LIKE_META_CHUNK)
      const { data: mineRows, error: mErr } = await supabase
        .from("likes")
        .select("photo_id")
        .eq("user_id", user.id)
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
  const { data: rows, error } = await supabase
    .from("collections")
    .select("id, name, created_at")
    .order("created_at", { ascending: true })
  if (error) throw error
  userCollections.value = (rows ?? []) as {
    id: string
    name: string
    created_at: string
  }[]
}

/**
 * 依 Feed 內照片 id 載入「是否曾被本人加入任一收藏夾」。
 * 僅在瀏覽器端、登入狀態下有意義。
 */
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
    const { data: itemRows, error } = await supabase
      .from("collection_items")
      .select("photo_id")
      .in("photo_id", chunk)
    if (error) throw error
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

async function onFeedLikeClick(photoId: string) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) {
    await navigateTo("/login")
    return
  }

  const uid = authUser.id
  const prevLiked = !!likedByMeByPhotoId.value[photoId]
  const prevCount = likeCountByPhotoId.value[photoId] ?? 0
  const nextLiked = !prevLiked

  likedByMeByPhotoId.value = {
    ...likedByMeByPhotoId.value,
    [photoId]: nextLiked,
  }
  likeCountByPhotoId.value = {
    ...likeCountByPhotoId.value,
    [photoId]: Math.max(0, prevCount + (nextLiked ? 1 : -1)),
  }

  try {
    if (nextLiked) {
      const { error } = await supabase.from("likes").insert({
        user_id: uid,
        photo_id: photoId,
      })
      if (error) throw error
    } else {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", uid)
        .eq("photo_id", photoId)
      if (error) throw error
    }
  } catch {
    likedByMeByPhotoId.value = {
      ...likedByMeByPhotoId.value,
      [photoId]: prevLiked,
    }
    likeCountByPhotoId.value = {
      ...likeCountByPhotoId.value,
      [photoId]: prevCount,
    }
  }
}

async function onFeedMapClick(photoId: string) {
  if (!user.value) {
    await navigateTo("/login")
    return
  }
  await navigateTo(`/nearby/${photoId}`)
}

async function onFeedBookmarkClick(photoId: string) {
  if (!user.value) {
    await navigateTo("/login")
    return
  }
  bookmarkSheetPhotoId.value = photoId
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
    await refreshFeedCollectionContext(
      baseFeedItems.value.map((it) => it.photo.id),
    )
  } catch {
    /* ignore */
  }
}

const {
  data: feedData,
  pending,
  error: loadError,
  refresh: refreshFeedData,
} = await useAsyncData("feed-public-photos-pool", async () => {
  if (import.meta.client && feedDataCache.value !== null) {
    return feedDataCache.value
  }

  const { data: photoRows, error: pErr } = await supabase
    .from("photos")
    .select(
      "id, image_url, latitude, longitude, place_name, user_id, trip_id, trips!inner(id, name, is_public)",
    )
    .eq("trips.is_public", true)

  if (pErr) throw pErr

  const rows = (photoRows ?? []) as PhotoRow[]
  if (!rows.length) {
    feedDataCache.value = []
    return [] as FeedItem[]
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profRows, error: prErr } = await supabase
    .from("profiles")
    .select("id, avatar_url, display_name, email")
    .in("id", userIds)

  if (prErr) throw prErr

  const profileMap = new Map(
    (profRows ?? []).map((p) => [p.id, p as ProfileRow]),
  )

  /**
   * 取每個旅程的封面圖：以 sort_order 升序回所有相關照片，
   * 在 client 端對每個 trip_id 取首筆（即 sort_order 最小者）。
   */
  const tripIds = [...new Set(rows.map((r) => r.trip_id))]
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
      trip: {
        id: row.trips.id,
        name: row.trips.name,
        coverImageUrl: tripCoverByTripId.get(row.trips.id) ?? null,
      },
      profile,
      displayName,
      addressLine: photoAddressLine(row),
      hasCoords: hasValidCoords(lat, lng),
    }
  })

  feedDataCache.value = items
  return items
})

const baseFeedItems = computed(() => feedData.value ?? [])
const fetchError = computed(() => loadError.value?.message ?? "")

const pool = ref<FeedItem[]>([])
const displayedRows = ref<FeedDisplayRow[]>([])

const displayedRowsWithPhotoLayout = computed(() =>
  displayedRows.value.map((row) => ({
    row,
    layout: feedPhotoLayout(row.photo.id),
  })),
)
const feedClientReady = ref(false)
const loadingMore = ref(false)

let rowIdSeq = 0
function nextRowId(): string {
  rowIdSeq += 1
  return `feed-row-${rowIdSeq}-${Math.random().toString(36).slice(2, 11)}`
}

/** 每個旅程隨機最多 3 張，合併為抽樣池 */
function buildPoolFromItems(items: FeedItem[]): FeedItem[] {
  const byTrip = new Map<string, FeedItem[]>()
  for (const it of items) {
    const tid = it.trip.id
    const list = byTrip.get(tid)
    if (list) {
      list.push(it)
    } else {
      byTrip.set(tid, [it])
    }
  }
  const out: FeedItem[] = []
  for (const [, list] of byTrip) {
    shuffleInPlace(list)
    out.push(...list.slice(0, MAX_PHOTOS_PER_TRIP))
  }
  return out
}

function sampleBatchWithReplacement(source: FeedItem[]): FeedDisplayRow[] {
  if (!source.length) return []
  const byAuthor = new Map<string, number>()
  const out: FeedDisplayRow[] = []
  /**
   * 本批目標 BATCH_SIZE 筆；若作者上限導致暫時湊不滿，連續失敗多次後結束本批。
   * 少於 20 筆仍會 push，下一批重新計數，不影響後續無限載入。
   */
  const maxSkipsWithoutAdd = BATCH_SIZE * 200
  let skipsWithoutAdd = 0

  while (out.length < BATCH_SIZE) {
    if (skipsWithoutAdd >= maxSkipsWithoutAdd) {
      break
    }
    const pick = source[Math.floor(Math.random() * source.length)]!
    const aid = pick.authorUserId
    const used = byAuthor.get(aid) ?? 0
    if (used >= MAX_PHOTOS_PER_AUTHOR_PER_BATCH) {
      skipsWithoutAdd += 1
      continue
    }
    skipsWithoutAdd = 0
    byAuthor.set(aid, used + 1)
    out.push({ ...pick, _rowId: nextRowId() })
  }

  return out
}

function appendBatch() {
  const p = pool.value
  if (!p.length) return
  const batch = sampleBatchWithReplacement(p)
  displayedRows.value = displayedRows.value.concat(batch)
}

const showBlockingLoading = computed(() => {
  if (pending.value) return true
  if (!baseFeedItems.value.length) return false
  return !feedClientReady.value
})

async function initFeedFromCurrentData() {
  const items = baseFeedItems.value
  pool.value = buildPoolFromItems(items)
  displayedRows.value = []
  rowIdSeq = 0
  if (pool.value.length) {
    appendBatch()
  }
}

/** 從全域快照還原列表（避免返回 Feed 時只剩第一批、高度不足導致捲動還原失效） */
function applyFeedListSnapshot(snap: FeedListSnapshot) {
  pool.value = snap.pool.map((it) => ({ ...it, profile: { ...it.profile } }))
  displayedRows.value = snap.displayedRows.map((r) => ({ ...r, profile: { ...r.profile } }))
  rowIdSeq = snap.rowIdSeq
  intrinsicByPhotoId.value = { ...snap.intrinsic }
}

watch(feedHomeReshuffleTick, async () => {
  feedClientReady.value = false
  feedDataCache.value = null
  feedListSnapshot.value = null
  feedScrollYRestore.value = null
  try {
    sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  await refreshFeedData()
  await initFeedFromCurrentData()
  if (import.meta.client) {
    const ids = baseFeedItems.value.map((it) => it.photo.id)
    await fetchFeedLikeMeta(ids)
    await refreshFeedCollectionContext(ids)
  }
  feedClientReady.value = true
  await nextTick()
  setupFeedIntersectionObserver()
})

const feedSentinel = ref<HTMLElement | null>(null)
let intersectionObserver: IntersectionObserver | null = null

function setupFeedIntersectionObserver() {
  intersectionObserver?.disconnect()
  intersectionObserver = null

  const el = feedSentinel.value
  if (!el) {
    return
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        if (pending.value) continue
        if (!pool.value.length) continue
        if (loadingMore.value) continue
        loadingMore.value = true
        try {
          appendBatch()
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
  feedScrollYRestore.value = y
  try {
    sessionStorage.setItem(FEED_SCROLL_STORAGE_KEY, String(y))
  } catch {
    /* ignore */
  }
  if (pool.value.length || displayedRows.value.length) {
    feedListSnapshot.value = {
      pool: pool.value.map((it) => ({ ...it, profile: { ...it.profile } })),
      displayedRows: displayedRows.value.map((r) => ({
        ...r,
        profile: { ...r.profile },
      })),
      rowIdSeq,
      intrinsic: { ...intrinsicByPhotoId.value },
    }
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
  if (feedScrollYRestore.value != null) {
    const y = feedScrollYRestore.value
    feedScrollYRestore.value = null
    if (Number.isFinite(y) && y >= 0) return y
  }
  const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY)
  if (raw == null) return null
  const y = Number.parseFloat(raw)
  try {
    sessionStorage.removeItem(FEED_SCROLL_STORAGE_KEY)
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

watch(user, async () => {
  if (!import.meta.client || !baseFeedItems.value.length) return
  const ids = baseFeedItems.value.map((it) => it.photo.id)
  try {
    await fetchFeedLikeMeta(ids)
    await refreshFeedCollectionContext(ids)
  } catch {
    /* ignore */
  }
})

onMounted(async () => {
  await nextTick()
  /** 瀏覽器端 session 就緒後從 DB 重抓按讚（不依賴 SSR / useAsyncData 快取） */
  if (import.meta.client) {
    const ids = baseFeedItems.value.map((it) => it.photo.id)
    await fetchFeedLikeMeta(ids)
    await refreshFeedCollectionContext(ids)
  }

  const snap = feedListSnapshot.value
  const canRestoreList =
    snap &&
    snap.displayedRows.length > 0 &&
    baseFeedItems.value.length > 0

  if (import.meta.dev) {
    console.log("[feed] onMounted scroll / list", {
      scrollUseState: feedScrollYRestore.value,
      sessionScroll: import.meta.client
        ? sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY)
        : null,
      hasListSnapshot: !!snap,
      snapshotRows: snap?.displayedRows.length ?? 0,
      baseItems: baseFeedItems.value.length,
      willRestoreList: !!canRestoreList,
    })
  }

  if (canRestoreList) {
    applyFeedListSnapshot(snap)
    feedListSnapshot.value = null
  } else {
    await initFeedFromCurrentData()
  }

  feedClientReady.value = true
  await nextTick()
  setupFeedIntersectionObserver()
  await nextTick()

  const targetY = pickScrollRestoreTarget()
  if (import.meta.dev) {
    console.log("[feed] scroll target after pick", { targetY })
  }
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

/* === Feed Photo Card === */
.feed-photo-card {
  display: flex;
  flex-direction: column;
  background: var(--color-white);
}

/* Author row（卡片頂部） */
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

/* 照片區（保留 feedPhotoLayout 切換 natural / crop-2-3） */
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

/* Toolbar：左側 actions(讚/地圖/收藏) + 右側 trip 資訊 */
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

/**
 * 依 Figma 設計：icon 容器精確 24×24，無外框 padding。
 * gap 16px 是「icon 邊到下一個 icon 邊」的視覺距離。
 */
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

/* Trip 連結（封面 + 名稱） */
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
