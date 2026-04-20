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
        </div>
        <div class="nearby-page__below-map nearby-page__section--padded">
          <p class="nearby-page__address">
            {{ addressLine ?? "無地址資訊" }}
          </p>
          <a
            class="nearby-page__gmaps"
            :href="googleMapsUrl(centerPhoto.latitude!, centerPhoto.longitude!)"
            target="_blank"
            rel="noopener noreferrer"
          >
            在 Google Maps 開啟
          </a>
        </div>
        <ul class="nearby-page__grid" aria-label="附近照片">
          <li
            v-for="p in nearbyThumbs"
            :key="p.id"
            class="nearby-page__cell"
          >
            <NuxtLink
              class="nearby-page__thumb-link"
              :to="`/photos/${p.id}`"
            >
              <img
                class="nearby-page__thumb-img"
                :src="p.image_url"
                alt=""
                loading="lazy"
                decoding="async"
              >
            </NuxtLink>
          </li>
        </ul>
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
import { nextTick } from "vue"
import { OPENFREEMAP_LIBERTY_STYLE, waitForMapLibreGl } from "~/utils/maplibreClient"
import { haversineDistanceMeters } from "~/utils/haversine"

const RADIUS_M = 500

const route = useRoute()

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
  trip_id: string
  trips: TripEmbed
}

const supabase = useSupabaseClient()

const {
  data: bundle,
  pending,
  error: loadErr,
} = await useAsyncData(
  () => `nearby-${photoId.value}`,
  async () => {
    const id = photoId.value
    if (!id) {
      return { center: null as PhotoWithTrip | null, pool: [] as PhotoWithTrip[] }
    }

    const { data: centerRow, error: cErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, trip_id, trips!inner(id, name, is_public)",
      )
      .eq("id", id)
      .maybeSingle()

    if (cErr) throw cErr

    const center = centerRow as PhotoWithTrip | null
    if (!center || !center.trips?.is_public) {
      return { center: null, pool: [] as PhotoWithTrip[] }
    }

    const { data: poolRows, error: pErr } = await supabase
      .from("photos")
      .select(
        "id, image_url, latitude, longitude, place_name, trip_id, trips!inner(id, name, is_public)",
      )
      .eq("trips.is_public", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (pErr) throw pErr

    return {
      center,
      pool: (poolRows ?? []) as PhotoWithTrip[],
    }
  },
  { watch: [photoId] },
)

const centerPhoto = computed(() => bundle.value?.center ?? null)
const pool = computed(() => bundle.value?.pool ?? [])

const loadError = computed(() => loadErr.value?.message ?? "")

function photoAddressLine(photo: {
  place_name?: string | null
}): string | null {
  const place = photo.place_name?.trim() ?? ""
  return place.length ? place : null
}

const addressLine = computed(() =>
  centerPhoto.value ? photoAddressLine(centerPhoto.value) : null,
)

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

function googleMapsUrl(lat: number, lng: number) {
  const q = encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

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

/** 網格：觸發照片置頂，其餘為 500 公尺內其他公開照片 */
const nearbyThumbs = computed((): PhotoWithTrip[] => {
  const c = centerPhoto.value
  if (!c || c.latitude == null || c.longitude == null) return []
  return [c, ...nearbyPhotos.value]
})

const mapContainer = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
const markers: MapLibreMarker[] = []

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
      mapContainer.value,
      nearbyPhotos.value.length,
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

    map.addControl(new maplibregl.NavigationControl(), "top-right")

    const mCenter = new maplibregl.Marker({ color: "#dc2626" })
      .setLngLat([clng, clat])
      .addTo(map)
    markers.push(mCenter)

    for (const p of nearbyPhotos.value) {
      if (p.latitude == null || p.longitude == null) continue
      const mk = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([p.longitude, p.latitude])
        .addTo(map)
      markers.push(mk)
    }

    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([clng, clat])
    for (const p of nearbyPhotos.value) {
      if (p.latitude != null && p.longitude != null) {
        bounds.extend([p.longitude, p.latitude])
      }
    }
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
  padding: 1rem 0 2rem;
}

.nearby-page__section--padded {
  padding-left: 1.25rem;
  padding-right: 1.25rem;
  box-sizing: border-box;
}

.nearby-page__map-bleed {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  box-sizing: border-box;
}

.nearby-page__below-map {
  padding-top: 0.75rem;
  padding-bottom: 0.85rem;
  box-sizing: border-box;
}

.nearby-page__hint {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text);

  &--muted {
    color: var(--color-text-muted);
  }

  &--below-grid {
    margin-top: 0.5rem;
  }
}

.nearby-page__error {
  margin: 0 1.25rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border-radius: 0.375rem;
}

.nearby-page__address {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--color-text);
}

.nearby-page__gmaps {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-accent);
  text-decoration: none;
  border: 1px solid rgba(37, 99, 235, 0.35);
  border-radius: 0.5rem;
  background: rgba(37, 99, 235, 0.06);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.1);
    border-color: var(--color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.nearby-page__map {
  width: 100%;
  height: min(52vh, 22rem);
  border-radius: 0;
  overflow: hidden;
  border: none;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: rgba(15, 23, 42, 0.06);
}

.nearby-page__map-fallback {
  margin: 0;
  padding: 2rem 1rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: center;
  border: none;
  border-top: 1px dashed var(--color-border);
  border-bottom: 1px dashed var(--color-border);
}

.nearby-page__grid {
  list-style: none;
  margin: 0;
  padding: 0 1.25rem;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.nearby-page__cell {
  margin: 0;
  aspect-ratio: 1;
  border-radius: 0.35rem;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.06);
}

.nearby-page__thumb-link {
  display: block;
  width: 100%;
  height: 100%;
}

.nearby-page__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
</style>
