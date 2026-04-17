<template>
  <div class="photo-upload">
    <input
      ref="fileInputRef"
      class="photo-upload__input"
      type="file"
      accept="image/*"
      multiple
      @change="onFilesSelected"
    />

    <button
      type="button"
      class="photo-upload__trigger"
      :disabled="uploading || reading"
      @click="openPicker"
    >
      {{ reading ? "讀取中…" : uploading ? "上傳中…" : pendingItems.length ? "繼續加入照片" : "上傳照片" }}
    </button>

    <p v-if="noticeMessage" class="photo-upload__notice">{{ noticeMessage }}</p>
    <p v-if="errorMessage" class="photo-upload__error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="pendingItems.length && !uploading" class="photo-upload__review">
      <p class="photo-upload__review-title">
        已選取 {{ pendingItems.length }} 張，請確認地點資訊
      </p>
      <ul class="photo-upload__list">
        <li
          v-for="item in pendingItems"
          :key="item.key"
          class="photo-upload__row"
        >
          <img
            class="photo-upload__thumb"
            :src="item.previewUrl"
            alt=""
          />
          <div class="photo-upload__meta">
            <template v-if="item.hasGps">
              <span class="photo-upload__badge">已偵測 GPS</span>
              <span class="photo-upload__coords">
                {{ formatCoord(item.lat!) }}，{{ formatCoord(item.lng!) }}
              </span>
            </template>
            <template v-else>
              <label class="photo-upload__label" :for="`place-${item.key}`">
                搜尋地點（無 GPS）
              </label>
              <div class="photo-upload__geocode">
                <input
                  :id="`place-${item.key}`"
                  class="photo-upload__place-input"
                  type="search"
                  maxlength="200"
                  placeholder="輸入關鍵字搜尋…"
                  autocomplete="off"
                  :value="item.geocodeQuery"
                  @input="onGeocodeInput(item, ($event.target as HTMLInputElement).value)"
                />
                <ul
                  v-if="shouldShowGeocodeDropdown(item.key)"
                  class="photo-upload__geocode-list"
                  role="listbox"
                >
                  <li v-if="geocodeLoading[item.key]" class="photo-upload__geocode-item photo-upload__geocode-item--muted">
                    搜尋中…
                  </li>
                  <li
                    v-for="feature in geocodeResultsForKey(item.key)"
                    :key="feature.id"
                    class="photo-upload__geocode-item"
                  >
                    <button
                      type="button"
                      class="photo-upload__geocode-pick"
                      @mousedown.prevent="selectGeocodeResult(item, feature)"
                    >
                      {{ feature.place_name }}
                    </button>
                  </li>
                </ul>
              </div>
              <span
                v-if="item.lat != null && item.lng != null && item.placeName"
                class="photo-upload__coords photo-upload__geocode-selected"
              >
                {{ item.placeName }} · {{ formatCoord(item.lat) }}，{{ formatCoord(item.lng) }}
              </span>
            </template>
          </div>
          <button
            type="button"
            class="photo-upload__remove"
            @click="removeItem(item.key)"
          >
            ✕
          </button>
        </li>
      </ul>
      <div class="photo-upload__review-actions">
        <button
          type="button"
          class="photo-upload__btn photo-upload__btn--ghost"
          :disabled="reading"
          @click="cancelReview"
        >
          取消全部
        </button>
        <button
          type="button"
          class="photo-upload__btn photo-upload__btn--primary"
          :disabled="reading"
          @click="submitUpload"
        >
          開始上傳
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import exifr from "exifr"

const MAX_FILES = 36

const props = defineProps<{
  tripId: string
}>()

const emit = defineEmits<{
  uploaded: []
}>()

const config = useRuntimeConfig()
const supabase = useSupabaseClient()

const fileInputRef = ref<HTMLInputElement | null>(null)
const reading = ref(false)
const uploading = ref(false)
const noticeMessage = ref("")
const errorMessage = ref("")

type PendingItem = {
  key: string
  file: File
  previewUrl: string
  lat: number | null
  lng: number | null
  hasGps: boolean
  placeName: string
  /** 無 GPS：搜尋框內容 */
  geocodeQuery: string
}

type MapboxGeocodeFeature = {
  id: string
  place_name: string
  center: [number, number]
}

/** Mapbox 回傳的 feature 可能只有 geometry.coordinates，未必帶 center */
function normalizeGeocodeFeature(raw: Record<string, unknown>): MapboxGeocodeFeature | null {
  const idRaw = raw.id
  const id =
    typeof idRaw === "string" || typeof idRaw === "number"
      ? String(idRaw)
      : `feat-${Math.random().toString(36).slice(2)}`

  let lng: number | undefined
  let lat: number | undefined

  const c = raw.center
  if (Array.isArray(c) && c.length >= 2) {
    const a = Number(c[0])
    const b = Number(c[1])
    if (Number.isFinite(a) && Number.isFinite(b)) {
      lng = a
      lat = b
    }
  }

  if (lng === undefined || lat === undefined) {
    const geom = raw.geometry as { coordinates?: unknown } | undefined
    const coords = geom?.coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const a = Number(coords[0])
      const b = Number(coords[1])
      if (Number.isFinite(a) && Number.isFinite(b)) {
        lng = a
        lat = b
      }
    }
  }

  if (lng === undefined || lat === undefined) return null

  const placeName =
    typeof raw.place_name === "string"
      ? raw.place_name
      : typeof raw.text === "string"
        ? raw.text
        : ""

  if (!placeName.trim()) return null

  return { id, place_name: placeName, center: [lng, lat] }
}

const pendingItems = ref<PendingItem[]>([])

const geocodeResults = ref<Record<string, MapboxGeocodeFeature[]>>({})
const geocodeLoading = ref<Record<string, boolean>>({})
const geocodeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

function geocodeResultsForKey(key: string) {
  return geocodeResults.value[key] ?? []
}

function shouldShowGeocodeDropdown(key: string) {
  if (geocodeLoading.value[key]) return true
  return (geocodeResults.value[key]?.length ?? 0) > 0
}

function clearGeocodeTimers() {
  for (const t of geocodeDebounceTimers.values()) {
    clearTimeout(t)
  }
  geocodeDebounceTimers.clear()
}

function clearGeocodeStateForKey(key: string) {
  const pending = geocodeDebounceTimers.get(key)
  if (pending) clearTimeout(pending)
  geocodeDebounceTimers.delete(key)
  const { [key]: _r, ...restResults } = geocodeResults.value
  const { [key]: _l, ...restLoading } = geocodeLoading.value
  geocodeResults.value = restResults
  geocodeLoading.value = restLoading
}

function openPicker() {
  errorMessage.value = ""
  noticeMessage.value = ""
  fileInputRef.value?.click()
}

function revokePreviews() {
  for (const item of pendingItems.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
  pendingItems.value = []
}

function removeItem(key: string) {
  const item = pendingItems.value.find((i) => i.key === key)
  if (item) URL.revokeObjectURL(item.previewUrl)
  clearGeocodeStateForKey(key)
  pendingItems.value = pendingItems.value.filter((i) => i.key !== key)
}

function cancelReview() {
  clearGeocodeTimers()
  geocodeResults.value = {}
  geocodeLoading.value = {}
  revokePreviews()
  noticeMessage.value = ""
  errorMessage.value = ""
  if (fileInputRef.value) {
    fileInputRef.value.value = ""
  }
}

onBeforeUnmount(() => {
  clearGeocodeTimers()
  revokePreviews()
})

async function fetchGeocodeResults(key: string, query: string) {
  const token = config.public.mapboxToken as string
  if (!token?.trim()) {
    errorMessage.value = "未設定 Mapbox Token（NUXT_PUBLIC_MAPBOX_TOKEN）。"
    geocodeResults.value = { ...geocodeResults.value, [key]: [] }
    geocodeLoading.value = { ...geocodeLoading.value, [key]: false }
    return
  }

  const q = query.trim()
  if (q.length < 2) {
    geocodeResults.value = { ...geocodeResults.value, [key]: [] }
    geocodeLoading.value = { ...geocodeLoading.value, [key]: false }
    return
  }

  geocodeLoading.value = { ...geocodeLoading.value, [key]: true }
  errorMessage.value = ""

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&limit=5`
    const res = await fetch(url)
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(errText || `Geocoding 請求失敗（${res.status}）`)
    }
    const data = (await res.json()) as { features?: Record<string, unknown>[] }
    const features: MapboxGeocodeFeature[] = []
    for (const f of data.features ?? []) {
      const n = normalizeGeocodeFeature(f)
      if (n) features.push(n)
    }
    geocodeResults.value = { ...geocodeResults.value, [key]: features }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "地點搜尋失敗。"
    geocodeResults.value = { ...geocodeResults.value, [key]: [] }
  } finally {
    geocodeLoading.value = { ...geocodeLoading.value, [key]: false }
  }
}

function scheduleGeocodeSearch(key: string, query: string) {
  const prev = geocodeDebounceTimers.get(key)
  if (prev) clearTimeout(prev)
  geocodeDebounceTimers.set(
    key,
    setTimeout(() => {
      geocodeDebounceTimers.delete(key)
      void fetchGeocodeResults(key, query)
    }, 400)
  )
}

function onGeocodeInput(item: PendingItem, value: string) {
  item.geocodeQuery = value
  item.placeName = ""
  item.lat = null
  item.lng = null
  scheduleGeocodeSearch(item.key, value)
}

function selectGeocodeResult(item: PendingItem, feature: MapboxGeocodeFeature) {
  const [lng, lat] = feature.center
  item.placeName = feature.place_name
  item.lat = lat
  item.lng = lng
  item.geocodeQuery = feature.place_name
  geocodeResults.value = { ...geocodeResults.value, [item.key]: [] }
  geocodeLoading.value = { ...geocodeLoading.value, [item.key]: false }
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const list = input.files
  if (!list?.length) return

  errorMessage.value = ""
  noticeMessage.value = ""

  let files = Array.from(list).filter((f) => f.type.startsWith("image/"))
  if (!files.length) {
    errorMessage.value = "請選擇圖片檔案。"
    input.value = ""
    return
  }

  const remaining = MAX_FILES - pendingItems.value.length
  if (remaining <= 0) {
    noticeMessage.value = `已達 ${MAX_FILES} 張上限。`
    input.value = ""
    return
  }

  if (files.length > remaining) {
    noticeMessage.value = `已選擇超過上限，僅加入前 ${remaining} 張。`
    files = files.slice(0, remaining)
  }

  reading.value = true

  const next: PendingItem[] = []

  for (const file of files) {
    const key = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)
    let lat: number | null = null
    let lng: number | null = null
    try {
      const gps = await exifr.gps(file)
      if (gps && typeof gps === "object") {
        const g = gps as { latitude?: number; longitude?: number }
        const la = g.latitude
        const ln = g.longitude
        if (
          typeof la === "number" &&
          typeof ln === "number" &&
          Number.isFinite(la) &&
          Number.isFinite(ln)
        ) {
          lat = la
          lng = ln
        }
      }
    } catch {
      /* 無 EXIF 或無法解析 */
    }

    const hasGps = lat !== null && lng !== null
    next.push({ key, file, previewUrl, lat, lng, hasGps, placeName: "", geocodeQuery: "" })
  }

  pendingItems.value = [...pendingItems.value, ...next]
  reading.value = false
  input.value = ""
}

function formatCoord(n: number) {
  return n.toFixed(5)
}

async function submitUpload() {
  errorMessage.value = ""

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  const uploadUserId = authUser?.id ?? ""
  console.log("[TripPhotoUpload] submitUpload userId:", uploadUserId, authError?.message ?? "")

  if (!uploadUserId) {
    errorMessage.value = "請先登入"
    return
  }

  for (const item of pendingItems.value) {
    if (
      !item.hasGps &&
      (item.lat == null ||
        item.lng == null ||
        !item.placeName.trim())
    ) {
      errorMessage.value = "請為無 GPS 的照片從搜尋結果中選擇地點。"
      return
    }
  }

  if (!pendingItems.value.length) return

  uploading.value = true

  const inserts: {
    trip_id: string
    user_id: string
    image_url: string
    latitude: number | null
    longitude: number | null
    place_name: string | null
  }[] = []

  try {
    for (const item of pendingItems.value) {
      const match = item.file.name.match(/(\.[^.]+)$/)
      const ext = (match ? match[1] : ".jpg").toLowerCase()
      const safeExt = /^\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext) ? ext : ".jpg"
      const objectPath = `${uploadUserId}/${props.tripId}/${crypto.randomUUID()}${safeExt}`

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(objectPath, item.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: item.file.type || "image/jpeg",
        })

      if (upErr) throw new Error(upErr.message)

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(objectPath)

      inserts.push({
        trip_id: props.tripId,
        user_id: uploadUserId,
        image_url: pub.publicUrl,
        latitude: item.lat,
        longitude: item.lng,
        place_name: item.hasGps ? null : item.placeName.trim(),
      })
    }

    const { error: insErr } = await supabase.from("photos").insert(inserts)
    if (insErr) throw new Error(insErr.message)

    cancelReview()
    emit("uploaded")
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "上傳失敗，請稍後再試。"
  } finally {
    uploading.value = false
  }
}
</script>

<style lang="scss" scoped>
.photo-upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.photo-upload__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.photo-upload__trigger {
  cursor: pointer;
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
  background: var(--color-accent);
  border: none;
  border-radius: 0.5rem;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.photo-upload__notice {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.photo-upload__error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
}

.photo-upload__review {
  width: 100%;
  max-width: 36rem;
  margin-top: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
}

.photo-upload__review-title {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.photo-upload__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* 不可對此層設 overflow: auto，否則會裁切子層絕對定位的 Geocoding 下拉清單 */
  overflow: visible;
}

.photo-upload__row {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
}

.photo-upload__thumb {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 0.25rem;
  flex-shrink: 0;
  background: var(--color-border);
}

.photo-upload__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.photo-upload__remove {
  flex-shrink: 0;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;

  &:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }
}

.photo-upload__badge {
  display: inline-block;
  width: fit-content;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #065f46;
  background: #d1fae5;
  border-radius: 0.25rem;
}

.photo-upload__coords {
  color: var(--color-text-muted);
  word-break: break-all;
}

.photo-upload__label {
  font-weight: 500;
  color: var(--color-text);
}

.photo-upload__geocode {
  position: relative;
  width: 100%;
}

.photo-upload__geocode-list {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  max-height: 11rem;
  overflow-y: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.photo-upload__geocode-item {
  margin: 0;

  &--muted {
    padding: 0.35rem 0.65rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
}

.photo-upload__geocode-pick {
  display: block;
  width: 100%;
  padding: 0.4rem 0.65rem;
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

.photo-upload__geocode-selected {
  display: block;
  margin-top: 0.15rem;
}

.photo-upload__place-input {
  width: 100%;
  padding: 0.4rem 0.5rem;
  font: inherit;
  font-size: 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.375rem;

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
}

.photo-upload__review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.photo-upload__btn {
  cursor: pointer;
  padding: 0.4rem 0.85rem;
  font: inherit;
  font-size: 0.875rem;
  border-radius: 0.375rem;

  &--ghost {
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.04);
    }
  }

  &--primary {
    color: #fff;
    background: var(--color-accent);
    border: none;

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>