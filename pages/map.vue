<template>
  <div class="map-page">
    <div class="map-page__tabs" role="tablist" aria-label="地圖範圍">
      <button
        type="button"
        class="map-page__tab"
        :class="{ 'map-page__tab--active': mapTab === 'public' }"
        role="tab"
        :aria-selected="mapTab === 'public'"
        @click="onMapTabClick('public')"
      >
        <span
          :class="
            mapTab === 'public'
              ? 'text-body-medium-bold'
              : 'text-body-medium'
          "
        >公開地圖</span>
      </button>
      <button
        type="button"
        class="map-page__tab"
        :class="{ 'map-page__tab--active': mapTab === 'personal' }"
        role="tab"
        :aria-selected="mapTab === 'personal'"
        @click="onMapTabClick('personal')"
      >
        <span
          :class="
            mapTab === 'personal'
              ? 'text-body-medium-bold'
              : 'text-body-medium'
          "
        >個人地圖</span>
      </button>
    </div>

    <p
      v-if="fetchError"
      class="map-page__error text-body-medium"
      role="alert"
    >
      {{ fetchError }}
    </p>

    <template v-if="!fetchError || mapReady">
      <div class="map-page__body">
        <div class="map-page__search-float">
          <div class="map-page__geocode">
            <label class="map-page__geocode-row">
              <Search
                class="map-page__geocode-icon"
                :size="16"
                aria-hidden="true"
              />
              <span class="map-page__geocode-sr">搜尋地點</span>
              <input
                v-model="geocodeQuery"
                class="map-page__geocode-input text-body-small"
                type="search"
                maxlength="200"
                placeholder="搜尋地點"
                autocomplete="off"
                aria-autocomplete="list"
                :aria-expanded="geocodeListOpen"
                aria-controls="map-geocode-list"
                @input="onGeocodeInput"
                @focus="onGeocodeFocus"
                @blur="onGeocodeBlur"
                @keydown.esc.stop="onGeocodeEscape"
              />
            </label>
            <ul
              v-if="geocodeListOpen"
              id="map-geocode-list"
              class="map-page__geocode-list"
              role="listbox"
            >
              <li
                v-if="geocodeLoading"
                class="map-page__geocode-item map-page__geocode-item--muted text-body-small"
              >
                搜尋中…
              </li>
              <li
                v-for="feature in geocodeResults"
                :key="feature.id"
                class="map-page__geocode-item"
                role="option"
              >
                <button
                  type="button"
                  class="map-page__geocode-pick text-body-small"
                  @mousedown.prevent="selectGeocodeResult(feature)"
                >
                  {{ feature.display_name }}
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div ref="mapContainerEl" class="map-page__canvas" />
        <div class="map-page__locate-stack">
          <button
            type="button"
            class="map-page__locate-btn"
            aria-label="定位到目前位置"
            @click="onLocateMeClick"
          >
            <Locate :size="16" aria-hidden="true" />
          </button>
          <p
            v-if="locateError"
            class="map-page__locate-hint text-body-small"
            role="alert"
          >
            {{ locateError }}
          </p>
        </div>
        <div
          v-if="loading || pointsReloading"
          class="map-page__overlay"
          aria-busy="true"
        >
          <span class="map-page__overlay-text text-body-medium">載入中…</span>
        </div>
      </div>
    </template>

    <p
      v-if="!fetchError && !loading && !pointsReloading && !photoPoints.length"
      class="map-page__empty-banner text-body-small"
    >
      {{
        mapTab === "public"
          ? "尚無公開且含座標的照片。"
          : "尚無你含座標的照片。請在旅程中上傳含 GPS 或已搜尋地點的照片。"
      }}
    </p>

    <div
      v-if="isTripModalOpen"
      class="map-page__modal-backdrop"
      role="presentation"
      @click.self="closeTripModal"
    >
      <section
        class="map-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-modal-title"
      >
        <header class="map-page__modal-header">
          <h2 id="trip-modal-title" class="map-page__modal-title">
            {{ selectedTrip?.name ?? "未知旅程" }}
          </h2>
          <button
            type="button"
            class="map-page__modal-close"
            aria-label="關閉"
            @click="closeTripModal"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <p class="map-page__modal-date">
          旅程日期：{{ selectedTripDateLabel }}
        </p>

        <div v-if="tripPhotosLoading" class="map-page__modal-state">
          載入照片中…
        </div>
        <p v-else-if="tripPhotosError" class="map-page__modal-error" role="alert">
          {{ tripPhotosError }}
        </p>
        <p v-else-if="!tripPhotos.length" class="map-page__modal-state">
          這趟旅程尚無照片。
        </p>
        <template v-else>
          <div
            class="map-page__photo-view-toggle"
            role="group"
            aria-label="照片瀏覽模式"
          >
            <button
              type="button"
              class="map-page__photo-view-btn"
              :class="{
                'map-page__photo-view-btn--active': tripModalPhotoLayout === 'strip',
              }"
              aria-label="橫向滑動瀏覽"
              :aria-pressed="tripModalPhotoLayout === 'strip'"
              @click="tripModalPhotoLayout = 'strip'"
            >
              <GalleryHorizontal :size="16" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="map-page__photo-view-btn"
              :class="{
                'map-page__photo-view-btn--active': tripModalPhotoLayout === 'grid',
              }"
              aria-label="方格瀏覽"
              :aria-pressed="tripModalPhotoLayout === 'grid'"
              @click="tripModalPhotoLayout = 'grid'"
            >
              <LayoutGrid :size="16" aria-hidden="true" />
            </button>
          </div>
          <ul
            class="map-page__photo-grid"
            :class="
              tripModalPhotoLayout === 'grid'
                ? 'map-page__photo-grid--view-grid'
                : 'map-page__photo-grid--view-strip'
            "
          >
            <li
              v-for="(photo, photoIndex) in tripPhotos"
              :key="photo.id"
              class="map-page__photo-grid-item"
            >
              <button
                type="button"
                class="map-page__photo-grid-hit"
                :aria-label="`檢視第 ${photoIndex + 1} 張照片`"
                @click="openTripPhotoLightbox(photoIndex)"
              >
                <img :src="photo.imageUrl" alt="" loading="lazy" decoding="async">
              </button>
            </li>
          </ul>
        </template>

        <div class="map-page__modal-actions">
          <button type="button" class="map-page__go-trip-btn" @click="goToTripPage">
            前往旅程頁
          </button>
        </div>
      </section>
    </div>

    <PhotoLightbox
      v-if="tripPhotoLightboxOpen && tripPhotoLightboxUrls.length"
      :photos="tripPhotoLightboxUrls"
      :captions="tripPhotoLightboxCaptions"
      :initial-index="tripPhotoLightboxInitialIndex"
      @close="tripPhotoLightboxOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import {
  GalleryHorizontal,
  LayoutGrid,
  Locate,
  Search,
  X,
} from "lucide-vue-next"
import { onBeforeRouteLeave } from "vue-router"

const MAP_VIEW_STORAGE_KEY = "filmtrip-map-camera"

definePageMeta({
  ssr: false,
  /** 避免 router 強制捲到頂（地圖頁由 body overflow 控制捲動） */
  scrollToTop: false,
})

type MapCameraRestore = {
  lng: number
  lat: number
  zoom: number
}

/** 離開地圖後 SPA 返回時還原視角（整頁重新整理時以 sessionStorage 備援） */
const mapCameraRestore = useState<MapCameraRestore | null>(
  "map-camera-restore",
  () => null,
)

/** 與 `plugins/map-enter-from.client.ts` 共用：進入 /map 前所在頁 path */
const mapEnterFrom = useState<string | null>("map-enter-from", () => null)

function isValidMapCamera(s: MapCameraRestore): boolean {
  return (
    Number.isFinite(s.lng) &&
    Number.isFinite(s.lat) &&
    Number.isFinite(s.zoom) &&
    s.lat >= -90 &&
    s.lat <= 90 &&
    s.lng >= -180 &&
    s.lng <= 180 &&
    s.zoom >= 0 &&
    s.zoom <= 24
  )
}

function persistMapCameraState() {
  if (import.meta.server) return
  if (!map) return
  const c = map.getCenter()
  const z = map.getZoom()
  const snap: MapCameraRestore = {
    lng: c.lng,
    lat: c.lat,
    zoom: z,
  }
  mapCameraRestore.value = snap
  try {
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(snap))
  } catch {
    /* ignore */
  }
}

/**
 * 優先讀 useState，其次 sessionStorage；讀取後清空 useState 並移除 session。
 */
function pickMapCameraRestore(): MapCameraRestore | null {
  if (import.meta.server) return null

  if (mapCameraRestore.value != null) {
    const s = mapCameraRestore.value
    mapCameraRestore.value = null
    try {
      sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (isValidMapCamera(s)) return s
  }

  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(MAP_VIEW_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw == null) return null
  try {
    sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      "lng" in parsed &&
      "lat" in parsed &&
      "zoom" in parsed
    ) {
      const s = parsed as MapCameraRestore
      if (isValidMapCamera(s)) return s
    }
  } catch {
    return null
  }
  return null
}

function clearStoredMapCamera() {
  mapCameraRestore.value = null
  try {
    sessionStorage.removeItem(MAP_VIEW_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** 從 /photos/:id 返回地圖時才恢復上次視角（其餘含 Navbar 視為新進入並定位） */
function isRestoreMapViewEntry(fromPath: string | null | undefined): boolean {
  if (fromPath == null || fromPath === "") return false
  return /^\/photos\/[^/]+\/?$/.test(fromPath)
}

const route = useRoute()

const user = useSupabaseUser()

/** 公開地圖：含座標的公開旅程照片；個人地圖：登入者含座標照片（含私人旅程） */
type MapTabMode = "public" | "personal"
const mapTab = ref<MapTabMode>("public")

const DEFAULT_MAP_CENTER: [number, number] = [121.5, 24.25]
const DEFAULT_MAP_ZOOM = 6.5
const GEOCODE_FLY_ZOOM = 16
/** 大於等於此 zoom 時每張照片各一個縮圖標記，不聚合 */
const PHOTO_MARKERS_FULL_DETAIL_ZOOM = 16
/** 從 /map?lat=&lng=、定位按鈕、Navbar 地圖再點、初始定位成功時的目標 zoom */
const QUERY_PHOTO_FLY_ZOOM = 16

function parseMapQueryLatLng(): { lat: number; lng: number } | null {
  const lat = Number(route.query.lat)
  const lng = Number(route.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

const hasQueryLatLng = computed(() => parseMapQueryLatLng() != null)

function applyMapHeader() {
  useHeader({
    left: hasQueryLatLng.value ? "back" : null,
    center: "地圖",
  })
}

watch(
  () => route.fullPath,
  () => {
    applyMapHeader()
  },
  { immediate: true },
)

/** 僅地圖頁鎖住 body 捲動 */
onMounted(() => {
  document.body.style.overflow = "hidden"
})

type PhotoPoint = {
  id: string
  tripId: string
  imageUrl: string
  lng: number
  lat: number
  tripName: string
}

type TripSummary = {
  id: string
  name: string
  startDate: string
  endDate: string
}

type TripPhoto = {
  id: string
  imageUrl: string
  placeName: string | null
}

const supabase = useSupabaseClient()

const mapContainerEl = ref<HTMLElement | null>(null)
const loading = ref(true)
/** 地圖 `load` 後為 true，供 Tab 載入失敗時仍顯示地圖本體 */
const mapReady = ref(false)
const pointsReloading = ref(false)
const locateError = ref("")
let locateErrorClearTimer: ReturnType<typeof setTimeout> | null = null
const fetchError = ref("")
const photoPoints = ref<PhotoPoint[]>([])
const selectedTripId = ref<string | null>(null)
const tripPhotos = ref<TripPhoto[]>([])
const tripPhotosLoading = ref(false)
const tripPhotosError = ref("")
const tripPhotoLightboxOpen = ref(false)
const tripPhotoLightboxInitialIndex = ref(0)
const tripModalPhotoLayout = ref<"grid" | "strip">("strip")

const tripPhotoLightboxUrls = computed(() =>
  tripPhotos.value.map((p) => p.imageUrl),
)
const tripPhotoLightboxCaptions = computed(() =>
  tripPhotos.value.map((p) => p.placeName ?? ""),
)

let map: MapLibreMap | null = null
/** Tab 切換後更新標記時使用（與 map load 時相同引用） */
let maplibreglModule: MapLibreGlobal | null = null
const markers: MapLibreMarker[] = []
/** `moveend` 時重算照片聚合標記，卸載時需 off */
let photoMarkersMoveEndHandler: (() => void) | null = null
let geocodeSearchMarker: MapLibreMarker | null = null
let tripSummaryById = new Map<string, TripSummary>()

const isTripModalOpen = computed(() => selectedTripId.value !== null)
const selectedTrip = computed(() => {
  const id = selectedTripId.value
  if (!id) return null
  return tripSummaryById.get(id) ?? null
})
const selectedTripDateLabel = computed(() => {
  if (!selectedTrip.value) return "未知"
  return `${formatDate(selectedTrip.value.startDate)} - ${formatDate(selectedTrip.value.endDate)}`
})

type NominatimGeocodeResult = {
  id: string
  display_name: string
  lat: number
  lng: number
}

function normalizeNominatimResult(
  raw: Record<string, unknown>,
  index: number,
): NominatimGeocodeResult | null {
  const lat = parseFloat(String(raw.lat ?? ""))
  const lng = parseFloat(String((raw.lon ?? raw.lng) ?? ""))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const display_name =
    typeof raw.display_name === "string" ? raw.display_name : ""
  if (!display_name.trim()) return null

  const idRaw = raw.place_id ?? raw.osm_id ?? index
  const id =
    typeof idRaw === "string" || typeof idRaw === "number"
      ? String(idRaw)
      : `feat-${index}`

  return { id, display_name, lat, lng }
}

const geocodeQuery = ref("")
const geocodeResults = ref<NominatimGeocodeResult[]>([])
const geocodeLoading = ref(false)
let geocodeDebounceTimer: ReturnType<typeof setTimeout> | null = null
let geocodeBlurTimer: ReturnType<typeof setTimeout> | null = null
let geocodeReqId = 0

const geocodeListOpen = computed(() => {
  if (geocodeLoading.value) return true
  return geocodeResults.value.length > 0
})

function scheduleGeocodeSearch(q: string) {
  if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer)
  geocodeDebounceTimer = setTimeout(() => {
    geocodeDebounceTimer = null
    void fetchGeocodeSearch(q)
  }, 400)
}

function onGeocodeInput() {
  scheduleGeocodeSearch(geocodeQuery.value)
}

function onGeocodeFocus() {
  if (geocodeBlurTimer) {
    clearTimeout(geocodeBlurTimer)
    geocodeBlurTimer = null
  }
}

function onGeocodeBlur() {
  if (geocodeBlurTimer) clearTimeout(geocodeBlurTimer)
  geocodeBlurTimer = setTimeout(() => {
    geocodeBlurTimer = null
    geocodeResults.value = []
    geocodeLoading.value = false
  }, 200)
}

function onGeocodeEscape() {
  geocodeResults.value = []
  geocodeLoading.value = false
}

function removeGeocodeSearchMarker() {
  if (geocodeSearchMarker) {
    geocodeSearchMarker.remove()
    geocodeSearchMarker = null
  }
}

async function fetchGeocodeSearch(query: string) {
  const q = query.trim()
  if (q.length < 2) {
    geocodeReqId++
    geocodeResults.value = []
    geocodeLoading.value = false
    removeGeocodeSearchMarker()
    return
  }

  const id = ++geocodeReqId
  removeGeocodeSearchMarker()
  geocodeLoading.value = true
  try {
    const data = await $fetch<unknown[]>("/api/places/search", {
      query: { q },
    })
    if (id !== geocodeReqId) return
    const features: NominatimGeocodeResult[] = []
    if (Array.isArray(data)) {
      data.forEach((item, i) => {
        if (item && typeof item === "object") {
          const n = normalizeNominatimResult(item as Record<string, unknown>, i)
          if (n) features.push(n)
        }
      })
    }
    geocodeResults.value = features
  } catch {
    if (id !== geocodeReqId) return
    geocodeResults.value = []
  } finally {
    if (id === geocodeReqId) geocodeLoading.value = false
  }
}

function selectGeocodeResult(feature: NominatimGeocodeResult) {
  geocodeQuery.value = feature.display_name
  geocodeResults.value = []
  geocodeLoading.value = false

  if (!map) return
  const M = typeof window !== "undefined" && window.maplibregl
  if (!M) return

  removeGeocodeSearchMarker()
  geocodeSearchMarker = new M.Marker({ color: "#ef4444" })
    .setLngLat([feature.lng, feature.lat])
    .addTo(map)

  map.flyTo({
    center: [feature.lng, feature.lat],
    zoom: GEOCODE_FLY_ZOOM,
    essential: true,
  })
}

watch(geocodeQuery, (v) => {
  if (!String(v).trim()) removeGeocodeSearchMarker()
})

function getInitialMapViewFromGeolocation(): Promise<{
  center: [number, number]
  zoom: number
}> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
          resolve({ center: [longitude, latitude], zoom: QUERY_PHOTO_FLY_ZOOM })
        } else {
          resolve({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
        }
      },
      () => {
        resolve({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    )
  })
}

async function resolveMapInitialView(): Promise<{
  center: [number, number]
  zoom: number
}> {
  const queryCenter = parseMapQueryLatLng()
  if (queryCenter) {
    clearStoredMapCamera()
    return {
      center: [queryCenter.lng, queryCenter.lat],
      zoom: QUERY_PHOTO_FLY_ZOOM,
    }
  }

  const from = mapEnterFrom.value

  if (isRestoreMapViewEntry(from)) {
    const restored = pickMapCameraRestore()
    if (restored) {
      return {
        center: [restored.lng, restored.lat],
        zoom: restored.zoom,
      }
    }
    return getInitialMapViewFromGeolocation()
  }

  if (from == null || from === "") {
    const restored = pickMapCameraRestore()
    if (restored) {
      return {
        center: [restored.lng, restored.lat],
        zoom: restored.zoom,
      }
    }
    clearStoredMapCamera()
    return getInitialMapViewFromGeolocation()
  }

  clearStoredMapCamera()
  return getInitialMapViewFromGeolocation()
}

function showLocateError(message: string) {
  locateError.value = message
  if (locateErrorClearTimer) clearTimeout(locateErrorClearTimer)
  locateErrorClearTimer = setTimeout(() => {
    locateError.value = ""
    locateErrorClearTimer = null
  }, 4000)
}

function onLocateMeClick() {
  if (!map) {
    showLocateError("地圖尚未載入")
    return
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    showLocateError("此環境不支援定位")
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!map) return
      const { longitude, latitude } = pos.coords
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        showLocateError("無法取得有效座標")
        return
      }
      locateError.value = ""
      map.flyTo({
        center: [longitude, latitude],
        zoom: QUERY_PHOTO_FLY_ZOOM,
        essential: true,
      })
    },
    () => {
      showLocateError("無法取得定位，請確認已允許瀏覽器權限")
    },
    { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
  )
}

/**
 * Navbar 從 /map?lat&lng 回到純 /map（無 query）時，同頁組件常不重掛載，需清除備援並飛回定位。
 */
watch(
  () => [route.path, route.query.lat, route.query.lng] as const,
  async () => {
    if (route.path !== "/map") return
    if (!map) return
    if (parseMapQueryLatLng()) return
    clearStoredMapCamera()
    const v = await getInitialMapViewFromGeolocation()
    map.flyTo({
      center: v.center,
      zoom: v.zoom,
      essential: true,
    })
  },
)

/** 與 layouts/default.vue 共用：已在 /map 時再點 Navbar 地圖 → 重新定位 */
const mapNavRelocateTick = useState("map-nav-relocate-tick", () => 0)

watch(mapNavRelocateTick, async () => {
  if (!map) return
  clearStoredMapCamera()
  const v = await getInitialMapViewFromGeolocation()
  map.flyTo({
    center: v.center,
    zoom: v.zoom,
    essential: true,
  })
})

async function waitForMapLibreGl(timeoutMs = 15_000): Promise<MapLibreGlobal> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const m = typeof window !== "undefined" && window.maplibregl
    if (m) return m
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("MapLibre GL 未能載入，請檢查網路或 CDN。")
}

type AggregatedMapPhoto = {
  lng: number
  lat: number
  imageUrl: string
  photoId: string
  count: number
}

/** 依目前 zoom 決定畫面上聚合半徑（像素）：zoom 越低半徑越大、越容易合併 */
function clusterRadiusPxForZoom(zoom: number): number {
  return Math.min(96, Math.max(36, 120 - zoom * 5))
}

/**
 * 以畫面像素距離聚合（union-find）。zoom ≥ PHOTO_MARKERS_FULL_DETAIL_ZOOM 時不聚合。
 */
function clusterPhotoPointsForViewport(
  points: PhotoPoint[],
  zoom: number,
  project: (lngLat: [number, number]) => { x: number; y: number },
): AggregatedMapPhoto[] {
  if (points.length === 0) return []
  if (zoom >= PHOTO_MARKERS_FULL_DETAIL_ZOOM) {
    return points.map((p) => ({
      lng: p.lng,
      lat: p.lat,
      imageUrl: p.imageUrl,
      photoId: p.id,
      count: 1,
    }))
  }

  const R = clusterRadiusPxForZoom(zoom)
  const R2 = R * R
  const projected = points.map((p) => {
    const pt = project([p.lng, p.lat])
    return { x: pt.x, y: pt.y, p }
  })

  const n = projected.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }

  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = projected[i].x - projected[j].x
      const dy = projected[i].y - projected[j].y
      if (dx * dx + dy * dy <= R2) union(i, j)
    }
  }

  const byRoot = new Map<number, typeof projected>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!byRoot.has(r)) byRoot.set(r, [])
    byRoot.get(r)!.push(projected[i])
  }

  const out: AggregatedMapPhoto[] = []
  for (const group of byRoot.values()) {
    const count = group.length
    const first = group[0].p
    let lng = 0
    let lat = 0
    for (const { p } of group) {
      lng += p.lng
      lat += p.lat
    }
    lng /= count
    lat /= count
    out.push({
      lng,
      lat,
      imageUrl: first.imageUrl,
      photoId: first.id,
      count,
    })
  }
  return out
}

function clearPhotoMarkers() {
  for (const m of markers) {
    m.remove()
  }
  markers.length = 0
}

function createMapPhotoMarkerElement(
  imageUrl: string,
  photoId: string,
  count: number,
  onClusterClick: (() => void) | null,
): HTMLElement {
  const el = document.createElement("div")
  const safeUrl = imageUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  el.style.width = "60px"
  el.style.height = "60px"
  el.style.backgroundImage = `url("${safeUrl}")`
  el.style.backgroundSize = "cover"
  el.style.backgroundPosition = "center"
  el.style.borderRadius = "8px"
  el.style.border = "2px solid white"
  el.style.cursor = "pointer"
  el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)"
  el.setAttribute("role", "button")
  el.setAttribute("tabindex", "0")
  el.setAttribute(
    "aria-label",
    count > 1 ? `此位置有 ${count} 張照片，點擊放大` : "開啟照片",
  )

  el.addEventListener("click", (e) => {
    e.stopPropagation()
    if (count > 1 && onClusterClick) {
      onClusterClick()
      return
    }
    void navigateTo(`/photos/${photoId}`)
  })

  if (count > 1) {
    el.style.position = "relative"
    const badge = document.createElement("div")
    badge.textContent = String(count)
    badge.style.position = "absolute"
    badge.style.bottom = "-4px"
    badge.style.right = "-4px"
    badge.style.top = "auto"
    badge.style.minWidth = "1.1rem"
    badge.style.padding = "2px 5px"
    badge.style.fontSize = "10px"
    badge.style.fontWeight = "700"
    badge.style.lineHeight = "1.2"
    badge.style.color = "#fff"
    badge.style.textAlign = "center"
    badge.style.background = "var(--color-gray-900)"
    badge.style.border = "2px solid #fff"
    badge.style.borderRadius = "999px"
    badge.style.boxShadow = "0 1px 4px rgba(15,23,42,0.25)"
    badge.style.pointerEvents = "none"
    el.appendChild(badge)
  }

  return el
}

function updatePhotoMarkers(maplibregl: MapLibreGlobal) {
  if (!map) return
  clearPhotoMarkers()
  const pts = photoPoints.value
  if (!pts.length) return

  const mapProj = map as unknown as {
    getZoom: () => number
    project: (lngLat: [number, number]) => { x: number; y: number }
  }
  const z = mapProj.getZoom()
  const aggregated = clusterPhotoPointsForViewport(pts, z, (lngLat) =>
    mapProj.project(lngLat),
  )

  for (const p of aggregated) {
    const onCluster =
      p.count > 1
        ? () => {
            if (!map) return
            const zz = (
              map as unknown as { getZoom: () => number }
            ).getZoom()
            map.flyTo({
              center: [p.lng, p.lat],
              zoom: Math.min(zz + 2, 24),
              essential: true,
            })
          }
        : null

    const el = createMapPhotoMarkerElement(
      p.imageUrl,
      p.photoId,
      p.count,
      onCluster,
    )
    const marker = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
    })
      .setLngLat([p.lng, p.lat])
      .addTo(map)
    markers.push(marker)
  }
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

function closeTripModal() {
  selectedTripId.value = null
  tripPhotos.value = []
  tripPhotosLoading.value = false
  tripPhotosError.value = ""
  tripPhotoLightboxOpen.value = false
  tripModalPhotoLayout.value = "strip"
}

function openTripPhotoLightbox(index: number) {
  tripPhotoLightboxInitialIndex.value = index
  tripPhotoLightboxOpen.value = true
}

async function openTripModal(tripId: string) {
  selectedTripId.value = tripId
  tripPhotos.value = []
  tripPhotosError.value = ""
  tripPhotosLoading.value = true

  const { data, error } = await supabase
    .from("photos")
    .select("id, image_url, place_name")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true })

  if (selectedTripId.value !== tripId) return

  if (error) {
    tripPhotosError.value = error.message
    tripPhotosLoading.value = false
    return
  }

  tripPhotos.value = (data ?? []).map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    placeName: row.place_name,
  }))
  tripPhotosLoading.value = false
}

async function goToTripPage() {
  const tripId = selectedTripId.value
  if (!tripId) return
  closeTripModal()
  await navigateTo(`/trips/${tripId}`)
}

type PhotoRowBase = {
  id: string
  trip_id: string
  image_url: string
  latitude: number | null
  longitude: number | null
}

type TripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
}

async function setPointsFromRows(
  list: PhotoRowBase[],
): Promise<string | null> {
  const withCoords = list.filter(
    (r): r is typeof r & { latitude: number; longitude: number } =>
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude),
  )
  const tripIds = [...new Set(withCoords.map((r) => r.trip_id))]
  let nameByTrip = new Map<string, string>()
  if (tripIds.length) {
    const { data: trips, error: tripsErr } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date")
      .in("id", tripIds)

    if (tripsErr) {
      return tripsErr.message
    }
    const tripRows = (trips ?? []) as TripRow[]
    nameByTrip = new Map(tripRows.map((t) => [t.id, t.name]))
    tripSummaryById = new Map(
      tripRows.map((t) => [
        t.id,
        {
          id: t.id,
          name: t.name,
          startDate: t.start_date,
          endDate: t.end_date,
        },
      ]),
    )
  } else {
    tripSummaryById = new Map()
  }
  photoPoints.value = withCoords.map((r) => ({
    id: r.id,
    tripId: r.trip_id,
    imageUrl: r.image_url,
    lng: r.longitude,
    lat: r.latitude,
    tripName: nameByTrip.get(r.trip_id) ?? "未知旅程",
  }))
  return null
}

async function loadPhotoPointsForMap(
  tab: MapTabMode,
  userId: string | null,
): Promise<string | null> {
  if (tab === "public") {
    const { data: publicRows, error: publicErr } = await supabase
      .from("photos")
      .select(
        "id, trip_id, image_url, latitude, longitude, trips!inner(is_public)",
      )
      .eq("trips.is_public", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (publicErr) {
      return publicErr.message
    }
    return await setPointsFromRows((publicRows ?? []) as PhotoRowBase[])
  }

  if (!userId) {
    photoPoints.value = []
    tripSummaryById = new Map()
    return null
  }
  const { data: own, error: ownErr } = await supabase
    .from("photos")
    .select("id, trip_id, image_url, latitude, longitude")
    .eq("user_id", userId)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (ownErr) {
    return ownErr.message
  }
  return await setPointsFromRows((own ?? []) as PhotoRowBase[])
}

function onMapTabClick(next: MapTabMode) {
  if (next === "personal" && !user.value) {
    void navigateTo("/login")
    return
  }
  if (mapTab.value === next) return
  mapTab.value = next
  void reloadMapPhotoPoints()
}

async function reloadMapPhotoPoints() {
  pointsReloading.value = true
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    const uid = u?.id ?? null
    const err = await loadPhotoPointsForMap(mapTab.value, uid)
    if (err) {
      fetchError.value = err
      photoPoints.value = []
      if (maplibreglModule) {
        clearPhotoMarkers()
      }
      return
    }
    fetchError.value = ""
    if (maplibreglModule) {
      updatePhotoMarkers(maplibreglModule)
    }
  } finally {
    pointsReloading.value = false
  }
}

onMounted(async () => {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const userId = authUser?.id ?? null

  const dataErr = await loadPhotoPointsForMap(mapTab.value, userId)
  if (dataErr) {
    fetchError.value = dataErr
    loading.value = false
    return
  }

  await nextTick()

  if (!mapContainerEl.value) {
    loading.value = false
    return
  }

  let maplibregl: MapLibreGlobal
  try {
    maplibregl = await waitForMapLibreGl()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : "地圖無法載入"
    loading.value = false
    return
  }

  maplibreglModule = maplibregl

  const initialView = await resolveMapInitialView()

  map = new maplibregl.Map({
    container: mapContainerEl.value,
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: initialView.center,
    zoom: initialView.zoom,
    attributionControl: false,
    touchPitch: true,
    touchZoomRotate: { around: "center" },
  })

  const mapUi = map as unknown as {
    scrollZoom: {
      setWheelZoomRate: (r: number) => void
      setZoomRate: (r: number) => void
    }
    touchZoomRotate: { enable: (o?: { around?: string }) => void }
  }
  mapUi.scrollZoom.setWheelZoomRate(1 / 150)
  mapUi.scrollZoom.setZoomRate(1 / 35)
  mapUi.touchZoomRotate.enable({ around: "center" })

  map.on("load", () => {
    if (!map) return
    loading.value = false
    mapReady.value = true

    photoMarkersMoveEndHandler = () => {
      updatePhotoMarkers(maplibregl)
    }
    map.on("moveend", photoMarkersMoveEndHandler)
    updatePhotoMarkers(maplibregl)
  })
})

onBeforeRouteLeave(() => {
  persistMapCameraState()
})

onBeforeUnmount(() => {
  persistMapCameraState()
  mapReady.value = false
  document.body.style.overflow = ""
  if (locateErrorClearTimer) {
    clearTimeout(locateErrorClearTimer)
    locateErrorClearTimer = null
  }
  if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer)
  if (geocodeBlurTimer) clearTimeout(geocodeBlurTimer)
  removeGeocodeSearchMarker()
  if (map && photoMarkersMoveEndHandler) {
    const m = map as unknown as {
      off: (type: string, listener: () => void) => void
    }
    m.off("moveend", photoMarkersMoveEndHandler)
    photoMarkersMoveEndHandler = null
  }
  clearPhotoMarkers()
  map?.remove()
  map = null
  maplibreglModule = null
})
</script>

<style lang="scss" scoped>
.map-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* default layout 頂部 52px（3.25rem）導覽列 */
  height: calc(100dvh - 3.25rem);
  max-height: calc(100dvh - 3.25rem);
  overflow-x: hidden;
  overflow-y: visible;
  background: var(--color-white);
}

.map-page__tabs {
  display: flex;
  flex-shrink: 0;
  gap: 0.75rem;
  align-items: stretch;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
  background: var(--color-white);
}

.map-page__tab {
  flex: 1 1 0;
  margin: 0;
  padding: 0.5rem 0.25rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-gray-500);
  cursor: pointer;
  box-sizing: border-box;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: 2px;
  }

  &--active {
    border-bottom-color: var(--color-gray-900);
    color: var(--color-gray-900);
  }

  /* Figma Map tab：Body/Medium、Body/Medium-Bold，line-height 100% */
  span {
    line-height: 1;
  }
}

.map-page__body {
  position: relative;
  z-index: 0;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: visible;
  background: var(--color-gray-100);
}

.map-page__search-float {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  z-index: 10;
  pointer-events: none;

  .map-page__geocode {
    pointer-events: auto;
  }
}

.map-page__geocode {
  position: relative;
  width: 100%;
}

.map-page__geocode-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-sizing: border-box;
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: var(--color-white);
  border: 1px solid var(--color-gray-100);
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: text;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:focus-within {
    border-color: var(--color-gray-900);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 1px var(--color-gray-900);
  }
}

.map-page__geocode-icon {
  flex-shrink: 0;
  color: var(--color-gray-200);
}

.map-page__geocode-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.map-page__geocode-input {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  line-height: 1;
  color: var(--color-gray-900);
  background: transparent;
  border: none;
  box-shadow: none;

  &::placeholder {
    color: var(--color-gray-200);
  }

  &:focus {
    outline: none;
  }
}

.map-page__locate-stack {
  position: absolute;
  bottom: calc(3.25rem + env(safe-area-inset-bottom, 0px) + 0.75rem);
  right: calc(0.75rem + env(safe-area-inset-right, 0px));
  z-index: 9;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  max-width: min(220px, 72vw);
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.map-page__locate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 1.75rem;
  height: 1.75rem;
  margin: 0;
  padding: 0;
  color: var(--color-gray-900);
  background: var(--color-white);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--color-gray-100);
  }

  &:focus-visible {
    outline: 2px solid var(--color-gray-900);
    outline-offset: 2px;
  }
}

.map-page__locate-hint {
  margin: 0;
  padding: 0.35rem 0.5rem;
  line-height: 1.35;
  color: var(--color-danger);
  text-align: right;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 0.35rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
}

.map-page__overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 250, 250, 0.72);
  pointer-events: none;
}

.map-page__overlay-text {
  color: var(--color-gray-500);
}

.map-page__empty-banner {
  flex-shrink: 0;
  margin: 0;
  padding: 0.5rem 1.25rem 1rem;
  color: var(--color-gray-500);
}

.map-page__error {
  margin: 0;
  padding: 0.75rem 1.25rem;
  color: var(--color-danger);
}

.map-page__canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.map-page__geocode-list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.28rem);
  z-index: 11;
  list-style: none;
  margin: 0;
  padding: 0.2rem 0;
  max-height: 14rem;
  overflow-y: auto;
  background: var(--color-white);
  border: 1px solid var(--color-gray-100);
  border-radius: 0.5rem;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  -webkit-overflow-scrolling: touch;
}

.map-page__geocode-item {
  margin: 0;
}

.map-page__geocode-item--muted {
  padding: 0.4rem 0.65rem;
  color: var(--color-gray-500);
}

.map-page__geocode-pick {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.4rem 0.65rem;
  border: none;
  background: transparent;
  text-align: left;
  line-height: 1.35;
  color: var(--color-gray-900);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgba(17, 17, 17, 0.06);
  }

  &:focus-visible {
    outline: none;
  }
}

.map-page__modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}

.map-page__modal {
  width: min(760px, 100%);
  max-height: min(85vh, 920px);
  overflow: auto;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
  padding: 1rem;
}

.map-page__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.map-page__modal-title {
  margin: 0;
  font-size: 1.1rem;
}

.map-page__modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 0.5rem;
  padding: 0.4rem;
  cursor: pointer;
  color: var(--color-text);

  &:hover,
  &:focus-visible {
    background: rgba(15, 23, 42, 0.06);
  }
}

.map-page__photo-view-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0;
  margin-bottom: 0.65rem;
  padding: 0.15rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.map-page__photo-view-btn {
  margin: 0;
  padding: 0.35rem 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;

  &:hover {
    color: var(--color-text);
  }

  &--active {
    color: var(--color-text);
    background: rgba(37, 99, 235, 0.1);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25);
  }
}

.map-page__modal-date {
  margin: 0.75rem 0 1rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.map-page__modal-state {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.map-page__modal-error {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.map-page__photo-grid {
  list-style: none;
  margin: 0;
  padding: 0 0 0.25rem;
}

.map-page__photo-grid--view-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.map-page__photo-grid--view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
  overflow: visible;
}

.map-page__photo-grid--view-strip .map-page__photo-grid-item {
  flex: 0 0 auto;
}

.map-page__photo-grid--view-grid .map-page__photo-grid-item {
  min-width: 0;
}

.map-page__photo-grid-hit {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  cursor: pointer;
  box-sizing: border-box;
  overflow: hidden;
}

.map-page__photo-grid--view-strip .map-page__photo-grid-hit {
  height: 140px;
  width: auto;
  background: #000;
}

.map-page__photo-grid--view-grid .map-page__photo-grid-hit {
  aspect-ratio: 1;
  height: auto;
  background: var(--color-surface);
}

.map-page__photo-grid--view-strip .map-page__photo-grid-hit img {
  display: block;
  height: 140px;
  width: auto;
  max-width: none;
  object-fit: contain;
  vertical-align: middle;
}

.map-page__photo-grid--view-grid .map-page__photo-grid-hit img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  vertical-align: middle;
}

.map-page__modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.map-page__go-trip-btn {
  border: none;
  background: var(--color-accent);
  color: #fff;
  border-radius: 0.55rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
}

/* 照片縮圖標記：createMapPhotoMarkerElement 內聯樣式 */
</style>
