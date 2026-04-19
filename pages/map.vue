<template>
  <div class="map-page">
    <p v-if="fetchError" class="map-page__error" role="alert">{{ fetchError }}</p>

    <template v-if="!fetchError">
      <div class="map-page__search">
        <div class="map-page__geocode">
          <label class="map-page__geocode-label">
            <span class="map-page__geocode-sr">搜尋地點</span>
            <input
              v-model="geocodeQuery"
              class="map-page__geocode-input"
              type="search"
              maxlength="200"
              placeholder="搜尋地點…"
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
              class="map-page__geocode-item map-page__geocode-item--muted"
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
                class="map-page__geocode-pick"
                @mousedown.prevent="selectGeocodeResult(feature)"
              >
                {{ feature.display_name }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="map-page__body">
        <div ref="mapContainerEl" class="map-page__canvas" />
        <div v-if="loading" class="map-page__overlay" aria-busy="true">
          <span class="map-page__overlay-text">載入中…</span>
        </div>
      </div>
    </template>

    <p
      v-if="!fetchError && !loading && !photoPoints.length"
      class="map-page__empty-banner"
    >
      尚無含座標的照片。請在旅程中上傳含 GPS 或已搜尋地點的照片。
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
import { GalleryHorizontal, LayoutGrid, X } from "lucide-vue-next"

definePageMeta({
  ssr: false,
})

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
const markers: MapLibreMarker[] = []
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

const DEFAULT_MAP_CENTER: [number, number] = [121.5, 24.25]
const DEFAULT_MAP_ZOOM = 6.5
const GEOCODE_FLY_ZOOM = 16

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
          resolve({ center: [longitude, latitude], zoom: 12 })
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

async function waitForMapLibreGl(timeoutMs = 15_000): Promise<MapLibreGlobal> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const m = typeof window !== "undefined" && window.maplibregl
    if (m) return m
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("MapLibre GL 未能載入，請檢查網路或 CDN。")
}

function buildPopupContent(
  imageUrl: string,
  tripName: string,
  tripId: string,
  onViewTrip: (id: string) => void,
  coords: { lat: number; lng: number } | null
) {
  const root = document.createElement("div")
  root.className = "map-page__popup-inner"

  const img = document.createElement("img")
  img.className = "map-page__popup-img"
  img.src = imageUrl
  img.alt = ""
  img.loading = "lazy"
  img.decoding = "async"

  const caption = document.createElement("p")
  caption.className = "map-page__popup-trip"
  caption.textContent = tripName

  root.append(img, caption)

  const hasCoords =
    coords !== null &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng)
  if (hasCoords) {
    const { lat, lng } = coords
    const mapsAction = document.createElement("button")
    mapsAction.type = "button"
    mapsAction.className = "map-page__popup-maps"
    mapsAction.textContent = "Google Maps"
    mapsAction.addEventListener("click", () => {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank")
    })
    root.appendChild(mapsAction)
  }

  const action = document.createElement("button")
  action.type = "button"
  action.className = "map-page__popup-action"
  action.textContent = "查看旅程"
  action.addEventListener("click", () => onViewTrip(tripId))

  root.appendChild(action)
  return root
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

onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const { data: publicRows, error: publicErr } = await supabase
    .from("photos")
    .select("id, trip_id, image_url, latitude, longitude, trips!inner(is_public)")
    .eq("trips.is_public", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (publicErr) {
    fetchError.value = publicErr.message
    loading.value = false
    return
  }

  let ownRows: PhotoRowBase[] = []
  if (userId) {
    const { data: own, error: ownErr } = await supabase
      .from("photos")
      .select("id, trip_id, image_url, latitude, longitude")
      .eq("user_id", userId)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (ownErr) {
      fetchError.value = ownErr.message
      loading.value = false
      return
    }
    ownRows = (own ?? []) as PhotoRowBase[]
  }

  const mergedById = new Map<string, PhotoRowBase>()
  for (const r of publicRows ?? []) {
    const row = r as PhotoRowBase
    mergedById.set(row.id, row)
  }
  for (const r of ownRows) {
    mergedById.set(r.id, r)
  }

  const list = [...mergedById.values()].filter(
    (r): r is typeof r & { latitude: number; longitude: number } =>
      typeof r.latitude === "number" &&
      typeof r.longitude === "number" &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude)
  )

  const tripIds = [...new Set(list.map((r) => r.trip_id))]
  let nameByTrip = new Map<string, string>()
  if (tripIds.length) {
    const { data: trips, error: tripsErr } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date")
      .in("id", tripIds)

    if (tripsErr) {
      fetchError.value = tripsErr.message
      loading.value = false
      return
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
      ])
    )
  }

  photoPoints.value = list.map((r) => ({
    id: r.id,
    tripId: r.trip_id,
    imageUrl: r.image_url,
    lng: r.longitude,
    lat: r.latitude,
    tripName: nameByTrip.get(r.trip_id) ?? "未知旅程",
  }))

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

  const initialView = await getInitialMapViewFromGeolocation()

  map = new maplibregl.Map({
    container: mapContainerEl.value,
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: initialView.center,
    zoom: initialView.zoom,
    attributionControl: false,
  })

  map.addControl(new maplibregl.NavigationControl(), "top-right")

  map.on("load", () => {
    if (!map) return
    loading.value = false

    const pts = photoPoints.value
    for (const p of pts) {
      const popup = new maplibregl.Popup({
        offset: 18,
        maxWidth: "240px",
        closeButton: true,
        closeOnClick: true,
      }).setDOMContent(
        buildPopupContent(p.imageUrl, p.tripName, p.tripId, openTripModal, {
          lat: p.lat,
          lng: p.lng,
        })
      )

      const marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map!)

      markers.push(marker)
    }
  })
})

onBeforeUnmount(() => {
  document.body.style.overflow = ""
  if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer)
  if (geocodeBlurTimer) clearTimeout(geocodeBlurTimer)
  removeGeocodeSearchMarker()
  for (const m of markers) {
    m.remove()
  }
  markers.length = 0
  map?.remove()
  map = null
})
</script>

<style lang="scss" scoped>
.map-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* 約等於 100dvh 減去 default layout 頂部導覽列（還原全域鎖捲動後避免與 header 疊加高度） */
  height: calc(100dvh - 3.25rem);
  max-height: calc(100dvh - 3.25rem);
  overflow: hidden;
  background: var(--color-bg);
}

.map-page__search {
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  padding: 0.65rem 1rem;
  background: #fff;
  border-bottom: 1px solid var(--color-border);
}

.map-page__geocode {
  position: relative;
  width: 100%;
  z-index: 5;
}

.map-page__body {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.map-page__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 250, 250, 0.72);
  pointer-events: none;
}

.map-page__overlay-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.map-page__empty-banner {
  flex-shrink: 0;
  margin: 0;
  padding: 0.5rem 1.25rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.map-page__error {
  margin: 0;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.map-page__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-page__geocode-label {
  display: block;
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
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0.4rem 0.55rem;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
}

.map-page__geocode-list {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 6;
  list-style: none;
  margin: 0.28rem 0 0;
  padding: 0.2rem 0;
  max-height: 14rem;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
  -webkit-overflow-scrolling: touch;
}

.map-page__geocode-item {
  margin: 0;
}

.map-page__geocode-item--muted {
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.map-page__geocode-pick {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.4rem 0.65rem;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--color-text);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: rgba(37, 99, 235, 0.08);
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

/* Popup 內容掛到 body，需非 scoped 區塊 */
</style>

<style lang="scss">
.maplibregl-popup {
  z-index: 10;
}

.map-page__popup-inner {
  padding: 0.25rem;
}

.map-page__popup-img {
  display: block;
  width: 200px;
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  vertical-align: middle;
}

.map-page__popup-trip {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
}

.map-page__popup-maps {
  margin-top: 0.5rem;
  background: transparent;
  border: 1px solid #2563eb;
  color: #2563eb;
  border-radius: 0.45rem;
  padding: 0.38rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.map-page__popup-action {
  margin-top: 0.5rem;
  border: none;
  border-radius: 0.45rem;
  background: #2563eb;
  color: #fff;
  padding: 0.38rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}
</style>
