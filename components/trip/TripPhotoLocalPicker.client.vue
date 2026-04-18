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
            <template v-if="item.hasGps && item.lat != null && item.lng != null">
              <span class="photo-upload__badge">已偵測 GPS</span>
              <div class="photo-upload__mini-wrap">
                <div
                  :key="`mmap-${item.key}-${item.lat}-${item.lng}`"
                  class="photo-upload__mini-map-host"
                  :ref="(el) => bindMiniMap(item.key, el as HTMLElement | null, item.lng!, item.lat!)"
                />
                <button
                  type="button"
                  class="photo-upload__mini-edit"
                  @click="openLocationPicker(item, 'adjust')"
                >
                  調整地點
                </button>
              </div>
            </template>
            <template v-else>
              <div v-if="item.lat != null && item.lng != null && item.placeName" class="photo-upload__place-row">
                <span class="photo-upload__place-name">{{ item.placeName }}</span>
                <button
                  type="button"
                  class="photo-upload__place-change"
                  @click="openLocationPicker(item, 'pick')"
                >
                  更改
                </button>
              </div>
              <button
                v-else
                type="button"
                class="photo-upload__pick-place"
                @click="openLocationPicker(item, 'pick')"
              >
                選擇地點
              </button>
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
  </div>
</template>

<script setup lang="ts">
import exifr from "exifr"
import type { LocalPendingPhotoItem } from "~/types/tripPhotoLocal"
import { mountReadonlyLocationMap } from "~/utils/maplibreClient"

const MAX_FILES = 36

const fileInputRef = ref<HTMLInputElement | null>(null)
const reading = ref(false)
const noticeMessage = ref("")
const errorMessage = ref("")

const pendingItems = ref<LocalPendingPhotoItem[]>([])

const miniCleanups = new Map<string, () => void>()

const locationPickerItemKey = ref<string | null>(null)
const locationPickerTitle = ref("選擇地點")
const locationPickerInitialLat = ref<number | null>(null)
const locationPickerInitialLng = ref<number | null>(null)
const locationPickerKind = ref<"adjust" | "pick">("pick")

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
    try {
      const res = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      )
      if (res.ok) {
        const data = (await res.json()) as { display_name?: string }
        const name = typeof data.display_name === "string" ? data.display_name.trim() : ""
        item.placeName = name || coordLabel(lat, lng)
      } else {
        item.placeName = coordLabel(lat, lng)
      }
    } catch {
      item.placeName = coordLabel(lat, lng)
    }
  }
}

function coordLabel(lat: number, lng: number) {
  return `${formatCoord(lat)}，${formatCoord(lng)}`
}

async function bindMiniMap(
  key: string,
  el: HTMLElement | null,
  lng: number,
  lat: number,
) {
  miniCleanups.get(key)?.()
  miniCleanups.delete(key)
  if (!el) return
  try {
    const destroy = await mountReadonlyLocationMap(el, lng, lat)
    miniCleanups.set(key, destroy)
  } catch {
    /* 小地圖載入失敗時略過 */
  }
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
  miniCleanups.get(key)?.()
  miniCleanups.delete(key)
  if (locationPickerItemKey.value === key) {
    locationPickerItemKey.value = null
  }
  pendingItems.value = pendingItems.value.filter((i) => i.key !== key)
}

function cancelReview() {
  for (const d of miniCleanups.values()) d()
  miniCleanups.clear()
  locationPickerItemKey.value = null
  revokePreviews()
  noticeMessage.value = ""
  errorMessage.value = ""
  if (fileInputRef.value) {
    fileInputRef.value.value = ""
  }
}

onBeforeUnmount(() => {
  for (const d of miniCleanups.values()) d()
  miniCleanups.clear()
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
    next.push({ key, file, previewUrl, lat, lng, hasGps, placeName: "" })
  }

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

function getPendingItems(): readonly LocalPendingPhotoItem[] {
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

.photo-upload__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  gap: 0.35rem;
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

.photo-upload__mini-wrap {
  position: relative;
  width: 100%;
  height: 120px;
  border-radius: 0.375rem;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-border);
}

.photo-upload__mini-map-host {
  width: 100%;
  height: 100%;
}

.photo-upload__mini-edit {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  z-index: 2;
  cursor: pointer;
  padding: 0.2rem 0.45rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

  &:hover {
    background: #fff;
    border-color: var(--color-accent);
  }
}

.photo-upload__place-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.photo-upload__place-name {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  word-break: break-word;
}

.photo-upload__place-change {
  flex-shrink: 0;
  cursor: pointer;
  padding: 0.15rem 0.45rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--color-accent);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;

  &:hover {
    border-color: var(--color-accent);
  }
}

.photo-upload__pick-place {
  cursor: pointer;
  align-self: flex-start;
  padding: 0.4rem 0.75rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #fff;
  background: var(--color-accent);
  border: none;
  border-radius: 0.375rem;

  &:hover {
    background: var(--color-accent-hover);
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
