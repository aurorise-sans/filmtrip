<template>
  <Teleport to="body">
    <div class="photo-loc" role="dialog" aria-modal="true" :aria-label="title">
      <div class="photo-loc__panel">
        <h2 class="photo-loc__title">{{ title }}</h2>

        <div class="photo-loc__search">
          <input
            v-model="searchQuery"
            class="photo-loc__search-input"
            type="search"
            maxlength="200"
            placeholder="搜尋地點…"
            autocomplete="off"
            @input="onSearchInput"
          />
          <ul
            v-if="shouldShowSearchList"
            class="photo-loc__search-list"
            role="listbox"
          >
            <li
              v-if="searchLoading"
              class="photo-loc__search-item photo-loc__search-item--muted"
            >
              搜尋中…
            </li>
            <li
              v-for="feature in searchResults"
              :key="feature.id"
              class="photo-loc__search-item"
            >
              <button
                type="button"
                class="photo-loc__search-pick"
                @mousedown.prevent="selectSearchResult(feature)"
              >
                {{ feature.display_name }}
              </button>
            </li>
          </ul>
        </div>

        <div ref="mapContainerEl" class="photo-loc__map" />

        <div class="photo-loc__coords">
          緯度 {{ formatCoord(pickedLat) }}　經度 {{ formatCoord(pickedLng) }}
        </div>

        <div class="photo-loc__actions">
          <button type="button" class="photo-loc__btn photo-loc__btn--ghost" @click="emit('cancel')">
            取消
          </button>
          <button type="button" class="photo-loc__btn photo-loc__btn--primary" @click="onConfirm">
            確認
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { OPENFREEMAP_LIBERTY_STYLE, waitForMapLibreGl } from "~/utils/maplibreClient"

const props = defineProps<{
  initialLat: number | null
  initialLng: number | null
  title: string
}>()

const emit = defineEmits<{
  confirm: [lat: number, lng: number]
  cancel: []
}>()

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

const TW_CENTER_LNG = 121
const TW_CENTER_LAT = 24
const TW_ZOOM = 7
const POINT_ZOOM = 14

const mapContainerEl = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
let marker: MapLibreMarker | null = null

const hasInitial = computed(
  () =>
    props.initialLat != null &&
    props.initialLng != null &&
    Number.isFinite(props.initialLat) &&
    Number.isFinite(props.initialLng),
)

const pickedLat = ref(
  hasInitial.value ? (props.initialLat as number) : TW_CENTER_LAT,
)
const pickedLng = ref(
  hasInitial.value ? (props.initialLng as number) : TW_CENTER_LNG,
)

const searchQuery = ref("")
const searchResults = ref<NominatimGeocodeResult[]>([])
const searchLoading = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const shouldShowSearchList = computed(() => {
  if (searchLoading.value) return true
  return searchResults.value.length > 0
})

function formatCoord(n: number) {
  return n.toFixed(5)
}

function onConfirm() {
  emit("confirm", pickedLat.value, pickedLng.value)
}

function scheduleSearch(q: string) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    void fetchSearch(q)
  }, 400)
}

function onSearchInput() {
  scheduleSearch(searchQuery.value)
}

async function fetchSearch(query: string) {
  const q = query.trim()
  if (q.length < 2) {
    searchResults.value = []
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  try {
    const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) {
      searchResults.value = []
      return
    }
    const data = (await res.json()) as unknown[]
    const features: NominatimGeocodeResult[] = []
    if (Array.isArray(data)) {
      data.forEach((item, i) => {
        if (item && typeof item === "object") {
          const n = normalizeNominatimResult(item as Record<string, unknown>, i)
          if (n) features.push(n)
        }
      })
    }
    searchResults.value = features
  } catch {
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

function selectSearchResult(feature: NominatimGeocodeResult) {
  pickedLat.value = feature.lat
  pickedLng.value = feature.lng
  searchQuery.value = feature.display_name
  searchResults.value = []
  searchLoading.value = false

  if (map && marker) {
    marker.setLngLat([feature.lng, feature.lat])
    map.flyTo({
      center: [feature.lng, feature.lat],
      zoom: POINT_ZOOM,
      essential: true,
    })
  }
}

onMounted(() => {
  void nextTick(async () => {
    if (!mapContainerEl.value) return

    let maplibregl: MapLibreGlobal
    try {
      maplibregl = await waitForMapLibreGl()
    } catch {
      return
    }

    const lng = hasInitial.value ? (props.initialLng as number) : TW_CENTER_LNG
    const lat = hasInitial.value ? (props.initialLat as number) : TW_CENTER_LAT
    const zoom = hasInitial.value ? POINT_ZOOM : TW_ZOOM

    pickedLng.value = lng
    pickedLat.value = lat

    map = new maplibregl.Map({
      container: mapContainerEl.value,
      style: OPENFREEMAP_LIBERTY_STYLE,
      center: [lng, lat],
      zoom,
    })

    marker = new maplibregl.Marker({ color: "#2563eb", draggable: true })
      .setLngLat([lng, lat])
      .addTo(map)

    marker.on("dragend", () => {
      if (!marker) return
      const ll = marker.getLngLat()
      pickedLat.value = ll.lat
      pickedLng.value = ll.lng
    })

    map.once("load", () => {
      map?.resize()
    })
  })
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  marker?.remove()
  marker = null
  map?.remove()
  map = null
})
</script>

<style lang="scss" scoped>
.photo-loc {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(0, 0, 0, 0.45);
}

.photo-loc__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-bg);
}

.photo-loc__title {
  margin: 0;
  padding: 0.75rem 1rem 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
}

.photo-loc__search {
  position: relative;
  padding: 0.65rem 1rem 0.5rem;
  flex-shrink: 0;
}

.photo-loc__search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem 0.55rem;
  font: inherit;
  font-size: 0.9375rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
}

.photo-loc__search-list {
  position: absolute;
  z-index: 2;
  left: 1rem;
  right: 1rem;
  top: calc(100% - 2px);
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  max-height: 12rem;
  overflow-y: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.photo-loc__search-item {
  margin: 0;

  &--muted {
    padding: 0.4rem 0.65rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
}

.photo-loc__search-pick {
  display: block;
  width: 100%;
  padding: 0.45rem 0.65rem;
  font: inherit;
  font-size: 0.8125rem;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    background: rgba(37, 99, 235, 0.08);
  }
}

.photo-loc__map {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.photo-loc__coords {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}

.photo-loc__actions {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 1rem 1rem;
  border-top: 1px solid var(--color-border);
}

.photo-loc__btn {
  cursor: pointer;
  padding: 0.45rem 1rem;
  font: inherit;
  font-size: 0.875rem;
  border-radius: 0.375rem;

  &--ghost {
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }

  &--primary {
    color: #fff;
    background: var(--color-accent);
    border: none;

    &:hover {
      background: var(--color-accent-hover);
    }
  }
}
</style>
