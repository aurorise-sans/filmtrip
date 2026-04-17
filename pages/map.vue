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

const supabase = useSupabaseClient()

const mapContainerEl = ref<HTMLElement | null>(null)
const loading = ref(true)
const fetchError = ref("")
const photoPoints = ref<PhotoPoint[]>([])

let map: MapLibreMap | null = null
const markers: MapLibreMarker[] = []

async function waitForMapLibreGl(timeoutMs = 15_000): Promise<MapLibreGlobal> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const m = typeof window !== "undefined" && window.maplibregl
    if (m) return m
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("MapLibre GL 未能載入，請檢查網路或 CDN。")
}

function buildPopupContent(imageUrl: string, tripName: string) {
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
  return root
}

onMounted(async () => {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    loading.value = false
    await navigateTo("/login")
    return
  }

  const { data: rows, error: photosErr } = await supabase
    .from("photos")
    .select("id, trip_id, image_url, latitude, longitude")
    .eq("user_id", user.id)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (photosErr) {
    fetchError.value = photosErr.message
    loading.value = false
    return
  }

  const list = (rows ?? []).filter(
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
      .select("id, name")
      .in("id", tripIds)

    if (tripsErr) {
      fetchError.value = tripsErr.message
      loading.value = false
      return
    }
    nameByTrip = new Map((trips ?? []).map((t) => [t.id, t.name]))
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

  map = new maplibregl.Map({
    container: mapContainerEl.value,
    style: "https://demotiles.maplibre.org/style.json",
    center: [121.5, 24.25],
    zoom: 6.5,
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
      }).setDOMContent(buildPopupContent(p.imageUrl, p.tripName))

      const marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup)
        .addTo(map!)

      markers.push(marker)
    }

    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 11 })
      return
    }

    if (pts.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      for (const p of pts) {
        bounds.extend([p.lng, p.lat])
      }
      map.fitBounds(bounds, { padding: 72, maxZoom: 12, duration: 0 })
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
</style>
