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
            v-for="row in displayedRows"
            :key="row._rowId"
            class="feed-photo-card"
          >
            <div class="feed-photo-card__author">
              <NuxtLink
                class="feed-photo-card__author-link"
                :to="`/profile/${row.authorUserId}`"
              >
                <span class="feed-photo-card__avatar-wrap">
                  <img
                    v-if="row.profile.avatar_url"
                    class="feed-photo-card__avatar"
                    :src="row.profile.avatar_url"
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
                <span class="feed-photo-card__name">{{ row.displayName }}</span>
              </NuxtLink>
            </div>

            <div class="feed-photo-card__media">
              <img
                class="feed-photo-card__img"
                :src="row.photo.image_url"
                alt=""
                loading="lazy"
                decoding="async"
              >
            </div>

            <p
              v-if="row.addressLine"
              class="feed-photo-card__address"
            >
              {{ row.addressLine }}
            </p>

            <div class="feed-photo-card__actions">
              <a
                v-if="row.hasCoords"
                class="feed-photo-card__btn feed-photo-card__btn--map"
                :href="googleMapsUrl(row.photo.latitude!, row.photo.longitude!)"
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
                :to="`/trips/${row.trip.id}`"
              >
                查看旅程
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
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue"
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

/** 列表列（含 Vue 用唯一 key；允許同照片多列） */
type FeedDisplayRow = FeedItem & { _rowId: string }

const BATCH_SIZE = 20
const MAX_PHOTOS_PER_TRIP = 3
/** 同一作者在每批（20 筆）內最多幾張 */
const MAX_PHOTOS_PER_AUTHOR_PER_BATCH = 3

const supabase = useSupabaseClient()

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

function googleMapsUrl(lat: number, lng: number) {
  const q = encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

const {
  data: feedData,
  pending,
  error: loadError,
  refresh: refreshFeedData,
} = await useAsyncData("feed-public-photos-pool", async () => {
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

  return items
})

const baseFeedItems = computed(() => feedData.value ?? [])
const fetchError = computed(() => loadError.value?.message ?? "")

const pool = ref<FeedItem[]>([])
const displayedRows = ref<FeedDisplayRow[]>([])
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

watch(feedHomeReshuffleTick, async () => {
  feedClientReady.value = false
  await refreshFeedData()
  await initFeedFromCurrentData()
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

onMounted(async () => {
  await initFeedFromCurrentData()
  feedClientReady.value = true
  await nextTick()
  setupFeedIntersectionObserver()
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
  intersectionObserver = null
})
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

.feed-page__sentinel {
  height: 1px;
  margin-top: 0.5rem;
  pointer-events: none;
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
