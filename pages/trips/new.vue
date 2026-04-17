<template>
  <div class="trip-new" :class="{ 'trip-new--wide': step === 2 }">
    <header class="trip-new__header">
      <h1 class="trip-new__title">建立旅程</h1>
      <p v-if="step === 1" class="trip-new__subtitle">
        填寫基本資訊後，可接著上傳照片與地點。
      </p>
      <p v-else class="trip-new__subtitle">
        旅程已建立，加入照片即可在地圖上呈現足跡。
      </p>
    </header>

    <ol class="trip-new__progress" aria-label="建立流程" role="tablist">
      <li
        class="trip-new__progress-item"
        :class="{
          'trip-new__progress-item--current': step === 1,
          'trip-new__progress-item--done': step > 1,
        }"
      >
        <button
          type="button"
          class="trip-new__progress-btn"
          role="tab"
          :aria-selected="step === 1"
          @click="goToStep(1)"
        >
          <span class="trip-new__progress-num" aria-hidden="true">1</span>
          旅程資訊
        </button>
      </li>
      <li
        class="trip-new__progress-item"
        :class="{ 'trip-new__progress-item--current': step === 2 }"
      >
        <button
          type="button"
          class="trip-new__progress-btn"
          role="tab"
          :aria-selected="step === 2"
          :disabled="!createdTripId"
          @click="goToStep(2)"
        >
          <span class="trip-new__progress-num" aria-hidden="true">2</span>
          上傳照片
        </button>
      </li>
    </ol>

    <!-- 步驟一 -->
    <form
      v-show="step === 1"
      class="trip-new__form"
      @submit.prevent="onStep1Submit"
    >
      <div class="trip-new__field">
        <label class="trip-new__label" for="trip-name">旅程名稱</label>
        <input
          id="trip-name"
          v-model="name"
          class="trip-new__input"
          type="text"
          name="name"
          autocomplete="off"
          maxlength="200"
          required
          placeholder="例如：京都五天四夜"
          :readonly="isStep1Locked"
          :disabled="isStep1Locked"
        />
      </div>

      <div class="trip-new__row">
        <div class="trip-new__field">
          <label class="trip-new__label" for="trip-start">開始日期</label>
          <input
            id="trip-start"
            v-model="startDate"
            class="trip-new__input"
            type="date"
            name="start_date"
            required
            :disabled="isStep1Locked"
          />
        </div>
        <div class="trip-new__field">
          <label class="trip-new__label" for="trip-end">結束日期</label>
          <input
            id="trip-end"
            v-model="endDate"
            class="trip-new__input"
            type="date"
            name="end_date"
            required
            :disabled="isStep1Locked"
          />
        </div>
      </div>

      <div class="trip-new__field trip-new__field--visibility">
        <span id="trip-visibility-label" class="trip-new__label">旅程可見性</span>
        <div
          class="trip-new__radios"
          role="radiogroup"
          aria-labelledby="trip-visibility-label"
        >
          <label class="trip-new__radio-label">
            <input
              v-model="isPublic"
              class="trip-new__radio"
              type="radio"
              name="is_public"
              :value="true"
              :disabled="isStep1Locked"
            />
            <span>公開（顯示在公開地圖）</span>
          </label>
          <label class="trip-new__radio-label">
            <input
              v-model="isPublic"
              class="trip-new__radio"
              type="radio"
              name="is_public"
              :value="false"
              :disabled="isStep1Locked"
            />
            <span>隱藏（只有自己看得到）</span>
          </label>
        </div>
      </div>

      <p v-if="errorMessage" class="trip-new__error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="trip-new__actions">
        <NuxtLink class="trip-new__cancel" to="/">取消</NuxtLink>
        <button
          class="trip-new__submit"
          type="submit"
          :disabled="savingStep1 || !userId"
        >
          下一步
        </button>
      </div>
    </form>

    <!-- 步驟二 -->
    <div v-show="step === 2" class="trip-new__step2">
      <div class="trip-new__confirm card-like">
        <p class="trip-new__confirm-label">旅程名稱</p>
        <p class="trip-new__confirm-name">{{ createdTripName }}</p>
      </div>

      <div v-if="createdTripId" class="trip-new__upload-wrap card-like">
        <h2 class="trip-new__upload-heading">上傳照片</h2>
        <TripPhotoUploadPanel :trip-id="createdTripId" @uploaded="onPhotosUploaded" />

        <div class="trip-new__uploaded">
          <p class="trip-new__uploaded-title">已上傳照片</p>
          <p v-if="photosLoading" class="trip-new__uploaded-hint">載入中…</p>
          <p v-else-if="photosError" class="trip-new__uploaded-error" role="alert">
            {{ photosError }}
          </p>
          <p v-else-if="!uploadedPhotos.length" class="trip-new__uploaded-hint">
            尚未上傳照片
          </p>
          <div v-else class="trip-new__uploaded-grid">
            <figure
              v-for="photo in uploadedPhotos"
              :key="photo.id"
              class="trip-new__uploaded-figure"
            >
              <button
                type="button"
                class="trip-new__uploaded-delete"
                :disabled="deletingPhotoId === photo.id"
                @click="deleteUploadedPhoto(photo)"
              >
                {{ deletingPhotoId === photo.id ? "…" : "✕" }}
              </button>
              <img
                class="trip-new__uploaded-thumb"
                :src="photo.image_url"
                :alt="photo.place_name?.trim() || '旅程照片'"
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </div>

      <p v-if="step2Error" class="trip-new__error" role="alert">
        {{ step2Error }}
      </p>

      <div class="trip-new__actions trip-new__actions--step2">
        <button
          type="button"
          class="trip-new__ghost"
          :disabled="finishing"
          @click="goToTripDetail"
        >
          跳過，之後再上傳
        </button>
        <button
          type="button"
          class="trip-new__submit"
          :disabled="finishing"
          @click="goToTripDetail"
        >
          {{ finishing ? "前往中…" : "完成" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JwtPayload } from "@supabase/supabase-js"

const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()

const step = ref<1 | 2>(1)
const name = ref("")
const startDate = ref("")
const endDate = ref("")
const isPublic = ref(true)
const errorMessage = ref("")
const savingStep1 = ref(false)

const createdTripId = ref<string | null>(null)
const createdTripName = ref("")
const step2Error = ref("")
const finishing = ref(false)
const photosLoading = ref(false)
const photosError = ref("")
const deletingPhotoId = ref<string | null>(null)

type UploadedPhoto = {
  id: string
  image_url: string
  place_name: string | null
}

const uploadedPhotos = ref<UploadedPhoto[]>([])
const isStep1Locked = computed(() => Boolean(createdTripId.value))

const userId = computed(() => {
  const claims = userClaims.value as JwtPayload | null
  return claims?.sub ?? null
})

async function onStep1Submit() {
  errorMessage.value = ""

  if (createdTripId.value) {
    step.value = 2
    return
  }

  if (!userId.value) {
    errorMessage.value = "無法取得使用者資訊，請重新登入。"
    return
  }

  const trimmed = name.value.trim()
  if (!trimmed) {
    errorMessage.value = "請輸入旅程名稱。"
    return
  }

  if (!startDate.value || !endDate.value) {
    errorMessage.value = "請選擇開始與結束日期。"
    return
  }

  if (endDate.value < startDate.value) {
    errorMessage.value = "結束日期不可早於開始日期。"
    return
  }

  savingStep1.value = true

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: userId.value,
      name: trimmed,
      start_date: startDate.value,
      end_date: endDate.value,
      is_public: isPublic.value,
    })
    .select("id")
    .single()

  savingStep1.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  if (!data?.id) {
    errorMessage.value = "建立成功但無法取得旅程編號，請稍後再試。"
    return
  }

  await refreshNuxtData("profile-trips")

  createdTripId.value = data.id
  createdTripName.value = trimmed
  step2Error.value = ""
  uploadedPhotos.value = []
  photosError.value = ""
  step.value = 2
  await fetchUploadedPhotos(data.id)

  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}

async function fetchUploadedPhotos(tripId: string) {
  photosLoading.value = true
  photosError.value = ""
  const { data, error } = await supabase
    .from("photos")
    .select("id, image_url, place_name, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })

  photosLoading.value = false

  if (error) {
    photosError.value = "無法載入已上傳照片，請稍後再試。"
    return
  }

  uploadedPhotos.value = (data ?? []) as UploadedPhoto[]
}

async function onPhotosUploaded() {
  const id = createdTripId.value
  if (!id) return
  await fetchUploadedPhotos(id)
}

function extractPhotoObjectPath(imageUrl: string): string | null {
  const marker = "/storage/v1/object/public/photos/"
  const parseFrom = (value: string) => {
    const clean = value.split("?")[0]?.split("#")[0] ?? ""
    const idx = clean.indexOf(marker)
    if (idx === -1) return null
    const path = clean.slice(idx + marker.length).trim()
    return path ? decodeURIComponent(path) : null
  }

  try {
    return parseFrom(new URL(imageUrl).pathname)
  } catch {
    return parseFrom(imageUrl)
  }
}

async function deleteUploadedPhoto(photo: UploadedPhoto) {
  const tripId = createdTripId.value
  if (!tripId || deletingPhotoId.value) return

  photosError.value = ""
  deletingPhotoId.value = photo.id

  try {
    const objectPath = extractPhotoObjectPath(photo.image_url)
    if (!objectPath) {
      throw new Error("找不到圖片儲存路徑")
    }

    const { error: storageErr } = await supabase.storage
      .from("photos")
      .remove([objectPath])
    if (storageErr) throw new Error(storageErr.message)

    const { error: dbErr } = await supabase
      .from("photos")
      .delete()
      .eq("id", photo.id)
      .eq("trip_id", tripId)
    if (dbErr) throw new Error(dbErr.message)

    await fetchUploadedPhotos(tripId)
  } catch (e) {
    photosError.value = e instanceof Error ? `刪除失敗：${e.message}` : "刪除失敗，請稍後再試。"
  } finally {
    deletingPhotoId.value = null
  }
}

async function goToTripDetail() {
  step2Error.value = ""
  const id = createdTripId.value
  if (!id) {
    step2Error.value = "找不到旅程編號，請重新建立。"
    return
  }

  finishing.value = true
  try {
    await refreshNuxtData("profile-trips")
    await navigateTo(`/trips/${id}`)
  } catch {
    step2Error.value = "無法前往旅程頁面，請稍後再試。"
  } finally {
    finishing.value = false
  }
}

function goToStep(targetStep: 1 | 2) {
  if (targetStep === 2 && !createdTripId.value) {
    errorMessage.value = "請先完成旅程資訊並建立旅程。"
    return
  }
  step.value = targetStep
  errorMessage.value = ""
  step2Error.value = ""
}

useHead({
  title: "建立旅程 | Filmtrip",
})
</script>

<style lang="scss" scoped>
.trip-new {
  max-width: 28rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  transition: max-width 0.2s ease;

  &--wide {
    max-width: 56rem;
  }

  &__header {
    margin-bottom: 1.25rem;
  }

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__progress {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin: 0 0 1.5rem;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--color-surface);
  }

  &__progress-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.65rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted);
    border-right: 1px solid var(--color-border);

    &:last-child {
      border-right: none;
    }

    &--current {
      color: var(--color-text);
      background: rgba(37, 99, 235, 0.06);
    }

    &--done {
      color: var(--color-text);
    }
  }

  &__progress-btn {
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
  }

  &__progress-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 999px;
    background: var(--color-border);
    color: var(--color-text-muted);
  }

  &__progress-item--current .trip-new__progress-num {
    background: var(--color-accent);
    color: #fff;
  }

  &__progress-item--done .trip-new__progress-num {
    background: var(--color-accent);
    color: #fff;
  }

  &__form {
    padding: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .card-like {
    padding: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  &__confirm {
    margin-bottom: 1rem;
  }

  &__confirm-label {
    margin: 0 0 0.35rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  &__confirm-name {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: -0.02em;
    word-break: break-word;
  }

  &__upload-wrap {
    margin-bottom: 1.25rem;
  }

  &__upload-heading {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__uploaded {
    margin-top: 1rem;
  }

  &__uploaded-title {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__uploaded-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__uploaded-error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-danger);
  }

  &__uploaded-grid {
    margin-top: 0.65rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.5rem;
  }

  &__uploaded-figure {
    margin: 0;
    position: relative;
  }

  &__uploaded-thumb {
    width: 100%;
    aspect-ratio: 1;
    display: block;
    object-fit: cover;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background: var(--color-border);
  }

  &__uploaded-delete {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    width: 1.45rem;
    height: 1.45rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: rgba(17, 24, 39, 0.82);
    color: #fff;
    font-size: 0.875rem;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover:not(:disabled) {
      background: rgba(17, 24, 39, 0.96);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
  }

  &__row {
    display: grid;
    gap: 1rem;
    margin-bottom: 1.25rem;

    @media (min-width: 480px) {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__radios {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  &__radio-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--color-text);
    cursor: pointer;

    span {
      flex: 1;
    }
  }

  &__radio {
    margin-top: 0.2rem;
    flex-shrink: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  &__input {
    width: 100%;
    padding: 0.5rem 0.65rem;
    font: inherit;
    font-size: 0.9375rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
  }

  &__error {
    margin: 0 0 1rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.25rem;

    &--step2 {
      justify-content: space-between;
      margin-top: 0;
    }
  }

  &__cancel {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-text);
      text-decoration: underline;
    }
  }

  &__ghost {
    cursor: pointer;
    padding: 0.55rem 0.85rem;
    font: inherit;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    transition: color 0.15s ease, background 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--color-text);
      background: rgba(0, 0, 0, 0.04);
    }

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }

  &__submit {
    cursor: pointer;
    padding: 0.55rem 1.1rem;
    font: inherit;
    font-size: 0.9375rem;
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
}
</style>
