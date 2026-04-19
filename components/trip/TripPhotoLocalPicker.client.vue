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
      :disabled="reading"
      @click="openPicker"
    >
      {{
        reading
          ? "讀取中…"
          : pendingItems.length
            ? "繼續加入照片"
            : "選擇照片"
      }}
    </button>

    <p v-if="noticeMessage" class="photo-upload__notice">{{ noticeMessage }}</p>
    <p v-if="errorMessage" class="photo-upload__error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="pendingItems.length" class="photo-upload__review">
      <p class="photo-upload__review-title">
        已選取 {{ pendingItems.length }} 張，請確認地點資訊（完成建立時才會上傳）
      </p>
      <VueDraggable
        v-model="draggablePending"
        tag="div"
        class="photo-upload__draggable-list"
        :animation="150"
        :filter="'.photo-upload-row__nofilter'"
        :prevent-on-filter="false"
      >
        <div
          v-for="(item, index) in draggablePending"
          :key="item.key"
          class="photo-upload-row"
        >
          <div
            class="photo-upload-row__thumb"
            @click="previewLightboxIndex = index"
          >
            <img
              class="photo-upload-row__img"
              :src="item.previewUrl"
              alt=""
            />
          </div>
          <div class="photo-upload-row__body">
            <p class="photo-upload-row__addr">
              {{ locationSummary(item) }}
            </p>
            <button
              type="button"
              class="photo-upload-row__loc photo-upload-row__nofilter"
              @click="openLocationPicker(item, locationPickerKindFor(item))"
            >
              {{ locationButtonLabel(item) }}
            </button>
          </div>
          <button
            type="button"
            class="photo-upload-row__del photo-upload-row__nofilter"
            aria-label="移除此照片"
            @click="removeItem(item.key)"
          >
            ✕
          </button>
        </div>
      </VueDraggable>
      <div class="photo-upload__review-actions photo-upload__review-actions--single">
        <button
          type="button"
          class="photo-upload__btn photo-upload__btn--ghost"
          :disabled="reading"
          @click="cancelReview"
        >
          清除全部
        </button>
      </div>
    </div>

    <PhotoLocationPicker
      v-if="locationPickerItemKey"
      :key="locationPickerItemKey"
      :title="locationPickerTitle"
      :initial-lat="locationPickerInitialLat"
      :initial-lng="locationPickerInitialLng"
      @confirm="onPhotoLocationConfirm"
      @cancel="locationPickerItemKey = null"
    />

    <ClientOnly>
      <PhotoLightbox
        v-if="previewLightboxIndex !== null"
        :photos="photoLightboxUrls"
        :initial-index="previewLightboxIndex"
        @close="previewLightboxIndex = null"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import exifr from "exifr"
import { VueDraggable } from "vue-draggable-plus"
import type { LocalPendingPhotoItem } from "~/types/tripPhotoLocal"
import { fetchReverseDisplayName } from "~/utils/reverseGeocode"

const MAX_FILES = 36

const fileInputRef = ref<HTMLInputElement | null>(null)
const reading = ref(false)
const noticeMessage = ref("")
const errorMessage = ref("")

const pendingItems = ref<LocalPendingPhotoItem[]>([])

const draggablePending = computed({
  get: () => pendingItems.value,
  set: (next: LocalPendingPhotoItem[]) => {
    pendingItems.value = next
  },
})

const previewLightboxIndex = ref<number | null>(null)
const photoLightboxUrls = computed(() =>
  pendingItems.value.map((i) => i.previewUrl),
)

const locationPickerItemKey = ref<string | null>(null)
const locationPickerTitle = ref("選擇地點")
const locationPickerInitialLat = ref<number | null>(null)
const locationPickerInitialLng = ref<number | null>(null)
const locationPickerKind = ref<"adjust" | "pick">("pick")

function locationSummary(item: LocalPendingPhotoItem) {
  const name = item.placeName.trim()
  if (name) return name
  if (item.lat != null && item.lng != null) {
    return coordLabel(item.lat, item.lng)
  }
  return "尚未選擇地點"
}

function locationButtonLabel(item: LocalPendingPhotoItem) {
  if (
    item.hasGps &&
    item.lat != null &&
    item.lng != null
  ) {
    return "調整地點"
  }
  if (
    item.lat != null &&
    item.lng != null &&
    item.placeName.trim()
  ) {
    return "更改"
  }
  return "選擇地點"
}

function locationPickerKindFor(
  item: LocalPendingPhotoItem,
): "adjust" | "pick" {
  return item.hasGps &&
    item.lat != null &&
    item.lng != null
    ? "adjust"
    : "pick"
}

function openLocationPicker(item: LocalPendingPhotoItem, kind: "adjust" | "pick") {
  locationPickerKind.value = kind
  locationPickerTitle.value = kind === "adjust" ? "調整地點" : "選擇地點"
  locationPickerInitialLat.value = item.lat
  locationPickerInitialLng.value = item.lng
  locationPickerItemKey.value = item.key
}

async function onPhotoLocationConfirm(lat: number, lng: number) {
  const key = locationPickerItemKey.value
  const kind = locationPickerKind.value
  locationPickerItemKey.value = null
  if (!key) return

  const item = pendingItems.value.find((i) => i.key === key)
  if (!item) return

  item.lat = lat
  item.lng = lng

  if (kind === "pick") {
    const name = await fetchReverseDisplayName(lat, lng)
    item.placeName = name ?? coordLabel(lat, lng)
  }
}

function coordLabel(lat: number, lng: number) {
  return `${formatCoord(lat)}，${formatCoord(lng)}`
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
  previewLightboxIndex.value = null
  const item = pendingItems.value.find((i) => i.key === key)
  if (item) URL.revokeObjectURL(item.previewUrl)
  if (locationPickerItemKey.value === key) {
    locationPickerItemKey.value = null
  }
  pendingItems.value = pendingItems.value.filter((i) => i.key !== key)
}

function cancelReview() {
  previewLightboxIndex.value = null
  locationPickerItemKey.value = null
  revokePreviews()
  noticeMessage.value = ""
  errorMessage.value = ""
  if (fileInputRef.value) {
    fileInputRef.value.value = ""
  }
}

onBeforeUnmount(() => {
  revokePreviews()
})

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

  const next: LocalPendingPhotoItem[] = []

  for (const file of files) {
    const key = crypto.randomUUID()
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

    const compressed = await compressImage(file)
    const previewUrl = URL.createObjectURL(compressed)

    const hasGps = lat !== null && lng !== null
    next.push({
      key,
      file: compressed,
      previewUrl,
      lat,
      lng,
      hasGps,
      placeName: "",
    })
  }

  const gpsItems = next.filter(
    (item): item is LocalPendingPhotoItem & { lat: number; lng: number } =>
      item.hasGps &&
      item.lat != null &&
      item.lng != null &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng),
  )

  await Promise.all(
    gpsItems.map(async (item) => {
      const name = await fetchReverseDisplayName(item.lat, item.lng)
      item.placeName = name ?? ""
    }),
  )

  pendingItems.value = [...pendingItems.value, ...next]
  reading.value = false
  input.value = ""
}

function formatCoord(n: number) {
  return n.toFixed(5)
}

/** 供建立旅程頁在送出前檢查 */
function validateLocations(): boolean {
  errorMessage.value = ""
  for (const item of pendingItems.value) {
    if (
      !item.hasGps &&
      (item.lat == null ||
        item.lng == null ||
        !item.placeName.trim())
    ) {
      errorMessage.value = "請為無 GPS 的照片選擇地點。"
      return false
    }
  }
  return true
}

async function getPendingItems(): Promise<readonly LocalPendingPhotoItem[]> {
  const needName = pendingItems.value.filter(
    (item) =>
      item.hasGps &&
      item.lat != null &&
      item.lng != null &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng) &&
      !item.placeName.trim(),
  )
  if (needName.length) {
    await Promise.all(
      needName.map(async (item) => {
        const name = await fetchReverseDisplayName(item.lat!, item.lng!)
        item.placeName = name ?? ""
      }),
    )
  }
  return pendingItems.value
}

function clearError() {
  errorMessage.value = ""
}

defineExpose({
  validateLocations,
  getPendingItems,
  cancelReview,
  clearError,
})
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

.photo-upload__draggable-list {
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--color-surface);
}

.photo-upload-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  min-height: 80px;
  padding: 0.5rem 0.65rem;
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);
  cursor: grab;
  touch-action: manipulation;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    cursor: grabbing;
  }
}

.photo-upload-row__thumb {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-border);
  cursor: pointer;
}

.photo-upload-row__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  vertical-align: middle;
}

.photo-upload-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  justify-content: center;
}

.photo-upload-row__addr {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.photo-upload-row__loc {
  align-self: flex-start;
  margin: 0;
  padding: 0.2rem 0.5rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-accent);
  background: transparent;
  border: 1px solid rgba(37, 99, 235, 0.35);
  border-radius: 0.25rem;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.06);
    border-color: var(--color-accent);
  }
}

.photo-upload-row__del {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;

  &:hover {
    color: var(--color-danger);
    background: rgba(220, 38, 38, 0.08);
  }
}

.photo-upload__review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);

  &--single {
    justify-content: flex-start;
  }
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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
