<template>
  <div class="trip-new" :class="{ 'trip-new--wide': step === 2 }">
    <header class="trip-new__header">
      <h1 class="trip-new__title">建立旅程</h1>
      <p v-if="step === 1" class="trip-new__subtitle">
        填寫旅程資訊與封面後，下一步選擇照片；全部確認後才會建立旅程並上傳。
      </p>
      <p v-else class="trip-new__subtitle">
        照片僅在本機預覽，按下「完成」後會建立旅程並一次上傳。
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
          @click="goToStep(2)"
        >
          <span class="trip-new__progress-num" aria-hidden="true">2</span>
          選擇照片
        </button>
      </li>
    </ol>

    <!-- 步驟一 -->
    <form
      v-show="step === 1"
      class="trip-new__form"
      @submit.prevent="onStep1Next"
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
            />
            <span>隱藏（只有自己看得到）</span>
          </label>
        </div>
      </div>

      <ClientOnly>
        <div class="trip-new__cover-block">
          <h2 class="trip-new__section-heading">封面照片</h2>
          <p class="trip-new__cover-hint">
            選一張代表此旅程的圖片（可選，不需 GPS）。送出建立時才會上傳。
          </p>
          <figure v-if="coverPreviewUrl" class="trip-new__cover-figure">
            <img
              class="trip-new__cover-img"
              :src="coverPreviewUrl"
              alt="旅程封面預覽"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <input
            ref="coverFileInputRef"
            class="trip-new__cover-input"
            type="file"
            accept="image/*"
            tabindex="-1"
            aria-hidden="true"
            @change="onCoverFileSelected"
          />
          <div class="trip-new__cover-actions">
            <button
              type="button"
              class="trip-new__cover-btn"
              :disabled="!userId"
              @click="openCoverFilePicker"
            >
              {{ coverFile ? "更換封面" : "選擇封面照片" }}
            </button>
            <button
              v-if="coverFile"
              type="button"
              class="trip-new__cover-clear"
              @click="clearCoverSelection"
            >
              移除封面
            </button>
          </div>
        </div>
      </ClientOnly>

      <p v-if="errorMessage" class="trip-new__error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="trip-new__actions">
        <NuxtLink class="trip-new__cancel" to="/">取消</NuxtLink>
        <button
          class="trip-new__submit"
          type="submit"
          :disabled="!userId"
        >
          下一步
        </button>
      </div>
    </form>

    <!-- 步驟二 -->
    <div v-show="step === 2" class="trip-new__step2">
      <div class="trip-new__confirm card-like">
        <p class="trip-new__confirm-label">旅程名稱</p>
        <p class="trip-new__confirm-name">{{ name.trim() || "（未命名）" }}</p>
      </div>

      <div class="trip-new__upload-wrap card-like">
        <ClientOnly>
          <TripPhotoLocalPicker ref="localPickerRef" />
          <template #fallback>
            <p class="trip-new__picker-fallback">載入選圖元件中…</p>
          </template>
        </ClientOnly>
      </div>

      <p v-if="step2Error" class="trip-new__error" role="alert">
        {{ step2Error }}
      </p>

      <div class="trip-new__actions trip-new__actions--step2">
        <button
          type="button"
          class="trip-new__ghost"
          :disabled="finishing"
          @click="goToStep(1)"
        >
          上一步
        </button>
        <button
          type="button"
          class="trip-new__submit"
          :disabled="finishing || !userId"
          @click="onComplete"
        >
          {{ finishing ? "建立並上傳中…" : "完成" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JwtPayload } from "@supabase/supabase-js"
import type { LocalPendingPhotoItem } from "~/types/tripPhotoLocal"

const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()

const step = ref<1 | 2>(1)
const name = ref("")
const startDate = ref("")
const endDate = ref("")
const isPublic = ref(true)
const errorMessage = ref("")
const step2Error = ref("")
const finishing = ref(false)

const coverFile = ref<File | null>(null)
const coverPreviewUrl = ref<string | null>(null)
let coverPreviewRevoke: (() => void) | null = null

const coverFileInputRef = ref<HTMLInputElement | null>(null)
const localPickerRef = ref<{
  validateLocations: () => boolean
  getPendingItems: () => readonly LocalPendingPhotoItem[]
  clearError: () => void
} | null>(null)

const userId = computed(() => {
  const claims = userClaims.value as JwtPayload | null
  return claims?.sub ?? null
})

function revokeCoverPreview() {
  if (coverPreviewRevoke) {
    coverPreviewRevoke()
    coverPreviewRevoke = null
  }
  coverPreviewUrl.value = null
}

function openCoverFilePicker() {
  coverFileInputRef.value?.click()
}

function onCoverFileSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file?.type.startsWith("image/")) return
  revokeCoverPreview()
  coverFile.value = file
  const url = URL.createObjectURL(file)
  coverPreviewUrl.value = url
  coverPreviewRevoke = () => URL.revokeObjectURL(url)
}

function clearCoverSelection() {
  coverFile.value = null
  revokeCoverPreview()
}

function validateStep1Fields(): string | null {
  const trimmed = name.value.trim()
  if (!trimmed) return "請輸入旅程名稱。"
  if (!startDate.value || !endDate.value) return "請選擇開始與結束日期。"
  if (endDate.value < startDate.value) return "結束日期不可早於開始日期。"
  return null
}

function onStep1Next() {
  errorMessage.value = ""
  const err = validateStep1Fields()
  if (err) {
    errorMessage.value = err
    return
  }
  step.value = 2
  step2Error.value = ""
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}

async function goToStep(targetStep: 1 | 2) {
  errorMessage.value = ""
  step2Error.value = ""
  if (targetStep === 2) {
    const err = validateStep1Fields()
    if (err) {
      errorMessage.value = err
      return
    }
  }
  step.value = targetStep
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}

function storagePathForPhoto(user: string, trip: string, file: File) {
  const match = file.name.match(/(\.[^.]+)$/)
  const ext = (match ? match[1] : ".jpg").toLowerCase()
  const safeExt = /^\.(jpe?g|png|gif|webp|heic|heif)$/i.test(ext) ? ext : ".jpg"
  return `${user}/${trip}/${crypto.randomUUID()}${safeExt}`
}

async function onComplete() {
  step2Error.value = ""
  const err1 = validateStep1Fields()
  if (err1) {
    step2Error.value = err1
    return
  }

  if (!userId.value) {
    step2Error.value = "無法取得使用者資訊，請重新登入。"
    return
  }

  const picker = localPickerRef.value
  if (!picker) {
    step2Error.value = "選圖元件尚未就緒，請重新整理頁面。"
    return
  }

  picker.clearError()
  if (!picker.validateLocations()) {
    return
  }

  const items = [...picker.getPendingItems()]
  const uid = userId.value

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  const uploadUserId = authUser?.id ?? ""
  if (!uploadUserId || authError) {
    step2Error.value = "請先登入。"
    return
  }

  finishing.value = true

  let tripId: string | null = null
  const uploadedPhotoPaths: string[] = []
  let coverStoragePath: string | null = null

  try {
    const trimmed = name.value.trim()
    const { data: tripRow, error: tripErr } = await supabase
      .from("trips")
      .insert({
        user_id: uid,
        name: trimmed,
        start_date: startDate.value,
        end_date: endDate.value,
        is_public: isPublic.value,
      })
      .select("id")
      .single()

    if (tripErr) throw new Error(tripErr.message)
    if (!tripRow?.id) throw new Error("建立成功但無法取得旅程編號。")

    tripId = tripRow.id
    coverStoragePath = `covers/${uploadUserId}/${tripId}.jpg`

    if (coverFile.value) {
      await uploadTripCoverAndUpdateRow(supabase, {
        userId: uploadUserId,
        tripId,
        file: coverFile.value,
      })
    } else {
      coverStoragePath = null
    }

    const inserts: {
      trip_id: string
      user_id: string
      image_url: string
      latitude: number | null
      longitude: number | null
      place_name: string | null
    }[] = []

    for (const item of items) {
      const objectPath = storagePathForPhoto(uploadUserId, tripId, item.file)
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(objectPath, item.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: item.file.type || "image/jpeg",
        })
      if (upErr) throw new Error(upErr.message)

      uploadedPhotoPaths.push(objectPath)

      const { data: pub } = supabase.storage.from("photos").getPublicUrl(objectPath)
      inserts.push({
        trip_id: tripId,
        user_id: uploadUserId,
        image_url: pub.publicUrl,
        latitude: item.lat,
        longitude: item.lng,
        place_name: item.hasGps ? null : item.placeName.trim(),
      })
    }

    if (inserts.length) {
      const { error: insErr } = await supabase.from("photos").insert(inserts)
      if (insErr) throw new Error(insErr.message)
    }

    await refreshNuxtData("profile-trips")
    await navigateTo(`/trips/${tripId}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "建立失敗，請稍後再試。"

    if (uploadedPhotoPaths.length) {
      await supabase.storage.from("photos").remove(uploadedPhotoPaths)
    }
    if (coverStoragePath && tripId) {
      await supabase.storage.from("photos").remove([coverStoragePath])
    }
    if (tripId) {
      await supabase.from("trips").delete().eq("id", tripId)
    }

    step2Error.value = `建立失敗，已還原：${msg}`
  } finally {
    finishing.value = false
  }
}

onBeforeUnmount(() => {
  revokeCoverPreview()
})

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

  &__picker-fallback {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__section-heading {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__cover-block {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--color-border);
  }

  &__cover-hint {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  &__cover-figure {
    margin: 0 0 0.75rem;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-border);
  }

  &__cover-img {
    display: block;
    width: 100%;
    max-height: 14rem;
    object-fit: cover;
    vertical-align: middle;
  }

  &__cover-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  &__cover-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  &__cover-btn {
    padding: 0.45rem 0.9rem;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    color: #fff;
    background: var(--color-accent);
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: filter 0.15s ease;

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }

  &__cover-clear {
    padding: 0.45rem 0.75rem;
    font: inherit;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;

    &:hover {
      color: var(--color-text);
      border-color: var(--color-text-muted);
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
    transition:
      color 0.15s ease,
      background 0.15s ease;

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
