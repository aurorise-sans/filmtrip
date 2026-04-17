<template>
  <div class="map-page">
    <header class="map-page__header">
      <NuxtLink class="map-page__back" to="/profile">← 個人</NuxtLink>
      <h1 class="map-page__title">照片地圖</h1>
    </header>

    <p v-if="fetchError" class="map-page__error" role="alert">{{ fetchError }}</p>

    <div
      v-show="!fetchError"
      class="map-page__body"
    >
      <div ref="mapContainerEl" class="map-page__canvas" />
      <div v-if="loading" class="map-page__overlay" aria-busy="true">
        <span class="map-page__overlay-text">載入中…</span>
      </div>
    </div>

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
          <button type="button" class="map-page__modal-close" @click="closeTripModal">
            關閉
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
        <ul v-else class="map-page__photo-grid">
          <li v-for="photo in tripPhotos" :key="photo.id" class="map-page__photo-grid-item">
            <img :src="photo.imageUrl" alt="" loading="lazy" decoding="async">
          </li>
        </ul>

        <div class="map-page__modal-actions">
          <button type="button" class="map-page__go-trip-btn" @click="goToTripPage">
            前往旅程頁
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  ssr: false,
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

let map: MapLibreMap | null = null
const markers: MapLibreMarker[] = []
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
  onViewTrip: (id: string) => void
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

  const action = document.createElement("button")
  action.type = "button"
  action.className = "map-page__popup-action"
  action.textContent = "查看旅程"
  action.addEventListener("click", () => onViewTrip(tripId))

  root.append(img, caption, action)
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
}

async function openTripModal(tripId: string) {
  selectedTripId.value = tripId
  tripPhotos.value = []
  tripPhotosError.value = ""
  tripPhotosLoading.value = true

  const { data, error } = await supabase
    .from("photos")
    .select("id, image_url")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })

  if (selectedTripId.value !== tripId) return

  if (error) {
    tripPhotosError.value = error.message
    tripPhotosLoading.value = false
    return
  }

  tripPhotos.value = (data ?? []).map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
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
      }).setDOMContent(buildPopupContent(p.imageUrl, p.tripName, p.tripId, openTripModal))

      const marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map!)

      markers.push(marker)
    }
  })
})

onBeforeUnmount(() => {
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
  min-height: 100vh;
  height: 100vh;
  background: var(--color-bg);
}

.map-page__header {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.map-page__back {
  font-size: 0.875rem;
  color: var(--color-accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.map-page__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
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
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  padding: 0.375rem 0.625rem;
  cursor: pointer;
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
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 0.5rem;
}

.map-page__photo-grid-item img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
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
