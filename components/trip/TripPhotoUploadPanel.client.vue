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
      {{ reading ? "讀取中…" : uploading ? "上傳中…" : "上傳照片" }}
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
                地點名稱（無 GPS）
              </label>
              <input
                :id="`place-${item.key}`"
                v-model="item.placeName"
                class="photo-upload__place-input"
                type="text"
                maxlength="200"
                placeholder="例如：台北車站"
                autocomplete="off"
              />
            </template>
          </div>
        </li>
      </ul>
      <div class="photo-upload__review-actions">
        <button
          type="button"
          class="photo-upload__btn photo-upload__btn--ghost"
          :disabled="reading"
          @click="cancelReview"
        >
          取消
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
  userId: string
}>()

const emit = defineEmits<{
  uploaded: []
}>()

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
}

const pendingItems = ref<PendingItem[]>([])

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

function cancelReview() {
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
  if (!list?.length) {
    return
  }

  errorMessage.value = ""
  noticeMessage.value = ""

  let files = Array.from(list).filter((f) => f.type.startsWith("image/"))
  if (!files.length) {
    errorMessage.value = "請選擇圖片檔案。"
    input.value = ""
    return
  }

  if (files.length > MAX_FILES) {
    noticeMessage.value = `已選擇超過 ${MAX_FILES} 張，僅會上傳前 ${MAX_FILES} 張。`
    files = files.slice(0, MAX_FILES)
  }

  reading.value = true
  revokePreviews()

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

    next.push({
      key,
      file,
      previewUrl,
      lat,
      lng,
      hasGps,
      placeName: "",
    })
  }

  pendingItems.value = next
  reading.value = false
  input.value = ""
}

function formatCoord(n: number) {
  return n.toFixed(5)
}

async function submitUpload() {
  errorMessage.value = ""

  for (const item of pendingItems.value) {
    if (!item.hasGps && !item.placeName.trim()) {
      errorMessage.value = "請為無 GPS 的照片填寫地點名稱。"
      return
    }
  }

  if (!pendingItems.value.length) {
    return
  }

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
      const safeExt = /^\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext)
        ? ext
        : ".jpg"
      const objectPath = `${props.userId}/${props.tripId}/${crypto.randomUUID()}${safeExt}`

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(objectPath, item.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: item.file.type || "image/jpeg",
        })

      if (upErr) {
        throw new Error(upErr.message)
      }

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(objectPath)

      inserts.push({
        trip_id: props.tripId,
        user_id: props.userId,
        image_url: pub.publicUrl,
        latitude: item.hasGps ? item.lat : null,
        longitude: item.hasGps ? item.lng : null,
        place_name: item.hasGps ? null : item.placeName.trim(),
      })
    }

    const { error: insErr } = await supabase.from("photos").insert(inserts)

    if (insErr) {
      throw new Error(insErr.message)
    }

    cancelReview()
    emit("uploaded")
  } catch (e) {
    errorMessage.value =
      e instanceof Error ? e.message : "上傳失敗，請稍後再試。"
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
  max-height: min(50vh, 22rem);
  overflow-y: auto;
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
