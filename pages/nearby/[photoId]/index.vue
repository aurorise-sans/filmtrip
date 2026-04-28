<template>
  <div class="nearby-page">
    <p v-if="pending" class="nearby-page__hint nearby-page__section--padded">
      載入中…
    </p>
    <p v-else-if="loadError" class="nearby-page__error" role="alert">
      {{ loadError }}
    </p>
    <template v-else-if="centerPhoto">
      <p
        v-if="!hasCenterCoords"
        class="nearby-page__hint nearby-page__section--padded"
      >
        此照片沒有座標，無法顯示附近地圖。
      </p>
      <template v-else>
        <div class="nearby-page__map-bleed">
          <ClientOnly>
            <div ref="mapContainer" class="nearby-page__map" />
            <template #fallback>
              <div class="nearby-page__map-fallback">地圖載入中…</div>
            </template>
          </ClientOnly>

          <div class="nearby-page__map-actions" role="group" aria-label="地圖操作">
            <NuxtLink
              class="nearby-page__map-action nearby-page__map-action--public text-body-small-medium"
              :to="mapPageWithCoordsTo"
            >
              在公開地圖上瀏覽
            </NuxtLink>
            <a
              class="nearby-page__map-action nearby-page__map-action--gmaps text-body-small-medium"
              :href="googleMapsUrl(centerPhoto.latitude!, centerPhoto.longitude!)"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Map
            </a>
            <button
              type="button"
              class="nearby-page__map-center"
              aria-label="重新置中"
              @click="recenterMapToCenter"
            >
              <Crosshair :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>

        <section class="nearby-page__section nearby-page__section--location">
          <p class="nearby-page__location-title text-display-large-bold">
            {{ locationPrimaryLine }}
          </p>
          <p
            v-if="locationSecondaryLine"
            class="nearby-page__location-subtitle text-body-medium"
          >
            {{ locationSecondaryLine }}
          </p>
        </section>

        <section class="nearby-page__section nearby-page__section--trip">
          <p class="nearby-page__trip-label text-body-medium-medium">所屬旅程</p>
          <NuxtLink class="nearby-page__trip-row" :to="`/trips/${centerPhoto.trip_id}`">
            <span class="nearby-page__trip-cover">
              <img
                v-if="tripCoverUrl"
                :src="tripCoverUrl"
                alt=""
                loading="lazy"
                decoding="async"
              >
            </span>
            <span class="nearby-page__trip-copy">
              <span class="nearby-page__trip-name text-display-xs-bold">
                {{ centerPhoto.trips.name }}
              </span>
              <span class="nearby-page__trip-owner text-body-small">
                {{ tripOwnerName }}
              </span>
            </span>
            <ChevronRight :size="24" aria-hidden="true" class="nearby-page__trip-chevron" />
          </NuxtLink>
        </section>

        <section class="nearby-page__section nearby-page__section--grid-title">
          <p class="nearby-page__grid-title text-body-medium-medium">500公尺內的照片</p>
        </section>

        <div class="nearby-page__grid-bleed">
          <ul class="nearby-page__grid" aria-label="附近照片">
            <li
              v-for="p in nearbyThumbs"
              :key="p.id"
              class="nearby-page__cell"
            >
              <button
                type="button"
                class="nearby-page__thumb-link"
                :aria-label="`查看附近照片串流，起始照片 ${p.id}`"
                @click="goNearbyFeed(p.id)"
              >
                <img
                  class="nearby-page__thumb-img"
                  :src="p.image_url"
                  alt=""
                  loading="lazy"
                  decoding="async"
                >
              </button>
            </li>
          </ul>
        </div>
        <p
          v-if="!nearbyPhotos.length"
          class="nearby-page__hint nearby-page__hint--muted nearby-page__section--padded nearby-page__hint--below-grid"
        >
          附近沒有其他公開照片。
        </p>
      </template>
    </template>
    <p
      v-else-if="!pending && !loadError"
      class="nearby-page__hint nearby-page__section--padded"
    >
      找不到此照片或旅程未公開。
    </p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, watch } from "vue"
import { ChevronRight, Crosshair } from "lucide-vue-next"
import { OPENFREEMAP_LIBERTY_STYLE, waitForMapLibreGl } from "~/utils/maplibreClient"
import { haversineDistanceMeters } from "~/utils/haversine"

const RADIUS_M = 500

useHeader({
  left: "back",
  center: "地點",
})

const route = useRoute()
const applyNearbyHeader = () => {
  useHeader({
    left: "back",
    center: "地點",
  })
}

watch(
  () => route.fullPath,
  () => {
    applyNearbyHeader()
  },
  { immediate: true },
)

const photoId = computed(() => {
  const raw = route.params.photoId
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : ""
})

type TripEmbed = { id: string; name: string; is_public: boolean }

type PhotoWithTrip = {
  id: string
  image_url: string
  latitude: number | null
  longitude: number | null
  place_name: string | null
  country: string | null
  city: string | null
  trip_id: string
  user_id: string
  trips: TripEmbed
}

type NearbyBundle = {
  center: PhotoWithTrip | null
  pool: PhotoWithTrip[]
  tripCoverUrl: string | null
  tripOwnerName: string | null
}

const supabase = useSupabaseClient()

const {
  data: bundle,
  pending,
  error: loadErr,
} = await useAsyncData(
  () => `nearby-${photoId.value}`,
  async (): Promise<NearbyBundle> => {
    const id = photoId.value
    if (!id) {
      return {
        center: null,
        pool: [],
        tripCoverUrl: null,
        tripOwnerName: null,
      }
    }

    const { data: centerRow, error: cErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, country, city, trip_id, user_id, trips!inner(id, name, is_public)",
      )
      .eq("id", id)
      .maybeSingle()

    if (cErr) throw cErr

    const center = centerRow as PhotoWithTrip | null
    if (!center || !center.trips?.is_public) {
      return {
        center: null,
        pool: [],
        tripCoverUrl: null,
        tripOwnerName: null,
      }
    }

    const [{ data: poolRows, error: pErr }, { data: coverRow, error: coverErr }, { data: ownerRow, error: ownerErr }] =
      await Promise.all([
        supabase
          .from("photos")
          .select(
            "id, image_url, latitude, longitude, place_name, country, city, trip_id, user_id, trips!inner(id, name, is_public)",
          )
          .eq("trips.is_public", true)
          .not("latitude", "is", null)
          .not("longitude", "is", null),
        supabase
          .from("photos")
          .select("image_url")
          .eq("trip_id", center.trip_id)
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", center.user_id)
          .maybeSingle(),
      ])

    if (pErr) throw pErr
    if (coverErr) {
      console.warn("[nearby] 無法載入旅程封面", coverErr)
    }
    if (ownerErr) {
      console.warn("[nearby] 無法載入旅程作者", ownerErr)
    }

    return {
      center,
      pool: (poolRows ?? []) as PhotoWithTrip[],
      tripCoverUrl: coverRow?.image_url ?? null,
      tripOwnerName: ownerRow?.display_name ?? null,
    }
  },
  { watch: [photoId] },
)

const centerPhoto = computed(() => bundle.value?.center ?? null)
const pool = computed(() => bundle.value?.pool ?? [])
const tripCoverUrl = computed(() => bundle.value?.tripCoverUrl ?? null)
const tripOwnerName = computed(() => {
  const name = bundle.value?.tripOwnerName?.trim() ?? ""
  return name || "使用者"
})

const loadError = computed(() => loadErr.value?.message ?? "")

const hasCenterCoords = computed(() => {
  const p = centerPhoto.value
  if (!p) return false
  return (
    p.latitude != null &&
    p.longitude != null &&
    !Number.isNaN(p.latitude) &&
    !Number.isNaN(p.longitude)
  )
})

const locationPrimaryLine = computed(() => {
  const p = centerPhoto.value
  if (!p) return "無地址資訊"
  const country = p.country?.trim() ?? ""
  const city = p.city?.trim() ?? ""
  const place = p.place_name?.trim() ?? ""
  if (country && city) return `${country}・${city}`
  return place || "無地址資訊"
})

const locationSecondaryLine = computed(() => {
  const p = centerPhoto.value
  if (!p) return null
  const country = p.country?.trim() ?? ""
  const city = p.city?.trim() ?? ""
  const place = p.place_name?.trim() ?? ""
  if (!country || !city) return null
  return place || null
})

function googleMapsUrl(lat: number, lng: number) {
  const q = encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

/** 帶經緯度讓 /map 初始飛到該點（query 為 tab / lat / lng） */
const mapPageWithCoordsTo = computed(() => {
  const p = centerPhoto.value
  if (
    !p ||
    p.latitude == null ||
    p.longitude == null ||
    Number.isNaN(p.latitude) ||
    Number.isNaN(p.longitude)
  ) {
    return {
      path: "/map",
      query: {
        tab: "public",
      },
    }
  }
  return {
    path: "/map",
    query: {
      tab: "public",
      lat: String(p.latitude),
      lng: String(p.longitude),
    },
  }
})

const nearbyPhotos = computed(() => {
  const c = centerPhoto.value
  if (!c || c.latitude == null || c.longitude == null) return []
  const clat = c.latitude
  const clng = c.longitude
  const out: PhotoWithTrip[] = []
  for (const row of pool.value) {
    if (row.latitude == null || row.longitude == null) continue
    if (row.id === c.id) continue
    const d = haversineDistanceMeters(
      clat,
      clng,
      row.latitude,
      row.longitude,
    )
    if (d <= RADIUS_M) {
      out.push(row)
    }
  }
  return out
})

/** 網格：僅 500 公尺內其他公開照片（不含當前照片） */
const nearbyThumbs = computed((): PhotoWithTrip[] => nearbyPhotos.value)

function goNearbyFeed(startPhotoId: string) {
  const centerPhotoId = centerPhoto.value?.id
  if (!centerPhotoId) return
  void navigateTo({
    path: `/nearby/${centerPhotoId}/feed`,
    query: { start: startPhotoId },
  })
}

const mapContainer = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
const markers: MapLibreMarker[] = []

function recenterMapToCenter() {
  const p = centerPhoto.value
  if (!map || !p || p.latitude == null || p.longitude == null) return
  map.flyTo({
    center: [p.longitude, p.latitude],
    zoom: 14,
    duration: 0,
  })
}

function createCenterPhotoMarkerElement(
  imageUrl: string,
  targetPhotoId: string,
): HTMLElement {
  const root = document.createElement("div")
  root.className = "nearby-page__map-marker-anchor"

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "nearby-page__map-marker"
  btn.setAttribute("aria-label", "查看此照片")

  const img = document.createElement("img")
  img.className = "nearby-page__map-marker-img"
  img.src = imageUrl
  img.alt = ""
  img.loading = "lazy"
  img.decoding = "async"
  btn.appendChild(img)

  btn.addEventListener("click", (e) => {
    e.stopPropagation()
    void navigateTo(`/photos/${targetPhotoId}`)
  })

  root.appendChild(btn)
  return root
}

function circlePolygon(
  lng: number,
  lat: number,
  radiusMeters: number,
  steps = 72,
): { type: "Polygon"; coordinates: [number, number][][] } {
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * 2 * Math.PI
    const dLat = (radiusMeters * Math.sin(ang)) / 111_320
    const dLng =
      (radiusMeters * Math.cos(ang)) /
      (111_320 * Math.cos((lat * Math.PI) / 180))
    ring.push([lng + dLng, lat + dLat])
  }
  return {
    type: "Polygon",
    coordinates: [ring],
  }
}

onBeforeUnmount(() => {
  for (const m of markers) {
    m.remove()
  }
  markers.length = 0
  map?.remove()
  map = null
})

watch(
  () =>
    [
      hasCenterCoords.value,
      centerPhoto.value?.id,
      centerPhoto.value?.image_url,
      mapContainer.value,
    ] as const,
  async () => {
    if (!import.meta.client) return
    if (!hasCenterCoords.value || !centerPhoto.value || !mapContainer.value) {
      return
    }
    await nextTick()
    const c = centerPhoto.value
    const clng = c.longitude!
    const clat = c.latitude!

    for (const m of markers) {
      m.remove()
    }
    markers.length = 0
    map?.remove()
    map = null

    let maplibregl: MapLibreGlobal
    try {
      maplibregl = await waitForMapLibreGl()
    } catch {
      return
    }

    const el = mapContainer.value
    map = new maplibregl.Map({
      container: el,
      style: OPENFREEMAP_LIBERTY_STYLE,
      center: [clng, clat],
      zoom: 14,
      attributionControl: false,
    })

    const markerEl = createCenterPhotoMarkerElement(c.image_url, c.id)
    const mCenter = new maplibregl.Marker({
      element: markerEl,
      anchor: "bottom",
    })
      .setLngLat([clng, clat])
      .addTo(map)
    markers.push(mCenter)

    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([clng, clat])
    const ring = circlePolygon(clng, clat, RADIUS_M).coordinates[0]!
    for (const coord of ring) {
      bounds.extend(coord as [number, number])
    }

    map.on("load", () => {
      if (!map) return
      const mapLoaded = map
      const poly = circlePolygon(clng, clat, RADIUS_M)
      const mapAny = map as unknown as {
        addSource: (id: string, src: Record<string, unknown>) => void
        addLayer: (layer: Record<string, unknown>) => void
      }
      mapAny.addSource("nearby-radius", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: poly,
          properties: {},
        },
      })
      mapAny.addLayer({
        id: "nearby-radius-fill",
        type: "fill",
        source: "nearby-radius",
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.06,
        },
      })
      mapAny.addLayer({
        id: "nearby-radius-line",
        type: "line",
        source: "nearby-radius",
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-opacity": 0.35,
        },
      })
      try {
        mapLoaded.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 })
      } catch {
        mapLoaded.resize()
      }
    })
  },
  { immediate: true, flush: "post" },
)
</script>

<style lang="scss" scoped>
.nearby-page {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 0 0 1rem;
}

.nearby-page__section--padded {
  padding-left: 1rem;
  padding-right: 1rem;
  box-sizing: border-box;
}

.nearby-page__hint {
  margin: 0;
  color: var(--color-gray-900);

  &--muted {
    color: var(--color-gray-500);
  }

  &--below-grid {
    margin-top: 0.75rem;
  }
}

.nearby-page__error {
  margin: 0 1rem;
  padding: 0.65rem 0.75rem;
  color: var(--color-red-500);
  background: color-mix(in srgb, var(--color-red-500) 12%, var(--color-white));
  border-radius: 0.375rem;
}

.nearby-page__map-bleed {
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  box-sizing: border-box;
}

.nearby-page__map {
  width: 100%;
  height: 280px;
  border: none;
  background: var(--color-gray-100);
}

.nearby-page__map-fallback {
  margin: 0;
  height: 280px;
  display: grid;
  place-items: center;
  color: var(--color-gray-500);
  background: var(--color-gray-100);
}

.nearby-page__map-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.nearby-page__map-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  text-decoration: none;
  border-radius: 999px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &--public {
    color: var(--color-white);
    background: var(--color-gray-900);
  }

  &--gmaps {
    color: var(--color-gray-900);
    background: var(--color-white);
    border: 1px solid var(--color-gray-100);
  }
}

.nearby-page__map-center {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gray-900);
  background: var(--color-white);
  border: none;
  border-radius: 999px;
  cursor: pointer;
}

.nearby-page__section {
  box-sizing: border-box;
  width: 100%;
}

.nearby-page__section--location,
.nearby-page__section--trip {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-gray-100);
}

.nearby-page__location-title {
  margin: 0;
  color: var(--color-gray-900);
}

.nearby-page__location-subtitle {
  margin: 4px 0 0;
  color: var(--color-gray-500);
}

.nearby-page__trip-label {
  margin: 0 0 8px;
  color: var(--color-gray-700);
}

.nearby-page__trip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  color: inherit;
}

.nearby-page__trip-cover {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-gray-100);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.nearby-page__trip-copy {
  flex: 1;
  min-width: 0;
  margin: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nearby-page__trip-name {
  color: var(--color-gray-900);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nearby-page__trip-owner {
  color: var(--color-gray-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nearby-page__trip-chevron {
  flex-shrink: 0;
  color: var(--color-gray-900);
}

.nearby-page__section--grid-title {
  padding: 12px 16px;
}

.nearby-page__grid-title {
  margin: 0;
  color: var(--color-gray-500);
}

.nearby-page__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.nearby-page__grid-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}

.nearby-page__cell {
  margin: 0;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-gray-100);
}

.nearby-page__thumb-link {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.nearby-page__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>

<!-- 地圖標記為 MapLibre 掛載的 DOM，需非 scoped；外層固定尺寸供 MapLibre 計算錨點 -->
<style lang="scss">
.nearby-page__map-marker-anchor {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.nearby-page__map-marker {
  position: absolute;
  top: 0;
  left: 0;
  width: 60px;
  height: 60px;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border: none;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  background: rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.28);
}

.nearby-page__map-marker-img {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 3px solid #fff;
  object-fit: cover;
  object-position: center;
  vertical-align: middle;
}

.nearby-page__map-marker:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

</style>
