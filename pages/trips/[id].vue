<template>
  <div
    class="trip-detail"
    :class="{
      'trip-detail--edit-wide': isEditing && editTab === 2,
      'trip-detail--edit-narrow': isEditing && editTab === 1,
    }"
  >
    <p v-if="pending || (!pageData && !fetchError)" class="trip-detail__hint">載入中…</p>
    <p v-else-if="fetchError" class="trip-detail__error" role="alert">
      {{ fetchError }}
    </p>
    <template v-else-if="pageData">
      <header class="trip-detail__header">
        <div class="trip-detail__header-row">
          <NuxtLink class="trip-detail__back" to="/profile">← 返回個人</NuxtLink>
          <div v-if="isOwner" class="trip-detail__header-actions">
            <template v-if="!isEditing">
              <button
                type="button"
                class="trip-detail__btn"
                @click="startEdit"
              >
                編輯
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="trip-detail__btn trip-detail__btn--danger"
                :disabled="savePending || deletePending"
                @click="onDeleteTrip"
              >
                刪除旅程
              </button>
              <button
                type="button"
                class="trip-detail__btn"
                :disabled="savePending || deletePending"
                @click="cancelEdit"
              >
                取消
              </button>
              <button
                type="button"
                class="trip-detail__btn trip-detail__btn--primary"
                :disabled="savePending || deletePending"
                @click="completeEditing"
              >
                完成編輯
              </button>
            </template>
          </div>
        </div>

        <figure
          v-if="pageData.trip.cover_image_url && !isEditing"
          class="trip-detail__cover"
        >
          <img
            class="trip-detail__cover-img"
            :src="pageData.trip.cover_image_url"
            :alt="`「${pageData.trip.name}」封面`"
            loading="eager"
            decoding="async"
          />
        </figure>

        <template v-if="!isEditing">
          <h1 class="trip-detail__title">{{ pageData.trip.name }}</h1>
          <p
            v-if="isOwner"
            class="trip-detail__visibility"
          >
            {{ pageData.trip.is_public ? "🌍 公開" : "🔒 僅自己可見" }}
          </p>
          <p class="trip-detail__dates">
            <time :datetime="pageData.trip.start_date">{{
              formatDate(pageData.trip.start_date)
            }}</time>
            <span class="trip-detail__sep" aria-hidden="true">—</span>
            <time :datetime="pageData.trip.end_date">{{
              formatDate(pageData.trip.end_date)
            }}</time>
          </p>
        </template>
      </header>

      <!-- 編輯模式：Tab 與內容 -->
      <div v-if="isEditing" class="trip-detail__edit-shell">
        <ol class="trip-detail__progress" aria-label="編輯項目" role="tablist">
          <li
            class="trip-detail__progress-item"
            :class="{
              'trip-detail__progress-item--current': editTab === 1,
              'trip-detail__progress-item--done': editTab > 1,
            }"
          >
            <button
              type="button"
              class="trip-detail__progress-btn"
              role="tab"
              :aria-selected="editTab === 1"
              @click="goToEditTab(1)"
            >
              <span class="trip-detail__progress-num" aria-hidden="true">1</span>
              旅程資訊
            </button>
          </li>
          <li
            class="trip-detail__progress-item"
            :class="{ 'trip-detail__progress-item--current': editTab === 2 }"
          >
            <button
              type="button"
              class="trip-detail__progress-btn"
              role="tab"
              :aria-selected="editTab === 2"
              @click="goToEditTab(2)"
            >
              <span class="trip-detail__progress-num" aria-hidden="true">2</span>
              照片
            </button>
          </li>
        </ol>

        <!-- Tab 1：旅程資訊 -->
        <form
          v-show="editTab === 1"
          class="trip-detail__edit-form"
          @submit.prevent="saveTripInfo"
        >
          <div class="trip-detail__field">
            <label class="trip-detail__label" for="trip-edit-name"
              >旅程名稱</label
            >
            <input
              id="trip-edit-name"
              v-model="editName"
              class="trip-detail__input"
              type="text"
              name="name"
              maxlength="200"
              required
              autocomplete="off"
            />
          </div>
          <div class="trip-detail__row">
            <div class="trip-detail__field">
              <label class="trip-detail__label" for="trip-edit-start"
                >開始日期</label
              >
              <input
                id="trip-edit-start"
                v-model="editStartDate"
                class="trip-detail__input"
                type="date"
                name="start_date"
                required
              />
            </div>
            <div class="trip-detail__field">
              <label class="trip-detail__label" for="trip-edit-end"
                >結束日期</label
              >
              <input
                id="trip-edit-end"
                v-model="editEndDate"
                class="trip-detail__input"
                type="date"
                name="end_date"
                required
              />
            </div>
          </div>

          <div class="trip-detail__field trip-detail__field--visibility">
            <span
              id="trip-edit-visibility-label"
              class="trip-detail__label"
              >旅程可見性</span
            >
            <div
              class="trip-detail__radios"
              role="radiogroup"
              aria-labelledby="trip-edit-visibility-label"
            >
              <label class="trip-detail__radio-label">
                <input
                  v-model="editIsPublic"
                  class="trip-detail__radio"
                  type="radio"
                  name="is_public"
                  :value="true"
                />
                <span>公開（顯示在公開地圖）</span>
              </label>
              <label class="trip-detail__radio-label">
                <input
                  v-model="editIsPublic"
                  class="trip-detail__radio"
                  type="radio"
                  name="is_public"
                  :value="false"
                />
                <span>隱藏（僅自己可見）</span>
              </label>
            </div>
          </div>

          <ClientOnly>
            <div class="trip-detail__cover-block">
              <h2 class="trip-detail__section-heading">封面照片</h2>
              <p class="trip-detail__cover-hint">
                變更後請按下方「儲存」一併寫入資料庫與雲端封面。
              </p>
              <figure
                v-if="editCoverDisplayUrl"
                class="trip-detail__cover-figure"
              >
                <img
                  class="trip-detail__cover-preview-img"
                  :src="editCoverDisplayUrl"
                  alt="封面預覽"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <p
                v-else-if="coverRemovePending && pageData.trip.cover_image_url"
                class="trip-detail__cover-removed-note"
              >
                將在儲存後移除封面
              </p>
              <input
                ref="coverFileInputRef"
                class="trip-detail__cover-input"
                type="file"
                accept="image/*"
                tabindex="-1"
                aria-hidden="true"
                @change="onEditCoverFileSelected"
              />
              <div class="trip-detail__cover-actions">
                <button
                  type="button"
                  class="trip-detail__cover-btn"
                  :disabled="!userId || savePending || deletePending"
                  @click="openCoverFilePicker"
                >
                  {{
                    pendingCoverFile
                      ? "更換封面"
                      : pageData.trip.cover_image_url && !coverRemovePending
                        ? "更換封面照片"
                        : "選擇封面照片"
                  }}
                </button>
                <button
                  v-if="pendingCoverFile || (pageData.trip.cover_image_url && !coverRemovePending)"
                  type="button"
                  class="trip-detail__cover-clear"
                  :disabled="savePending || deletePending"
                  @click="clearCoverEditSelection"
                >
                  {{ pendingCoverFile ? "取消新封面" : "移除封面" }}
                </button>
              </div>
              <CoverImageCropper
                v-if="coverCropperOpen && coverCropSourceUrl"
                :image-url="coverCropSourceUrl"
                @confirm="onEditCoverCropConfirm"
                @cancel="onEditCoverCropCancel"
              />
            </div>
          </ClientOnly>

          <p v-if="editError" class="trip-detail__edit-error" role="alert">
            {{ editError }}
          </p>

          <div class="trip-detail__edit-actions">
            <button
              type="submit"
              class="trip-detail__btn trip-detail__btn--primary"
              :disabled="savePending || deletePending || !userId"
            >
              {{ savePending ? "儲存中…" : "儲存" }}
            </button>
          </div>
        </form>

        <!-- Tab 2：照片 -->
        <div v-show="editTab === 2" class="trip-detail__edit-tab-photos">
          <div class="trip-detail__section-head trip-detail__section-head--tab2">
            <h2 class="trip-detail__section-title">照片</h2>
            <ClientOnly>
              <TripPhotoUploadPanel
                v-if="tripId && userId"
                :key="`edit-upload-${tripId}:${userId}`"
                :trip-id="tripId"
                @uploaded="onPhotosUploaded"
              />
            </ClientOnly>
          </div>

          <p
            v-if="photoDeleteError"
            class="trip-detail__photo-delete-error"
            role="alert"
          >
            {{ photoDeleteError }}
          </p>

          <div
            v-if="pageData.photos.length"
            class="trip-detail__grid trip-detail__grid--edit"
          >
            <figure
              v-for="(photo, photoIndex) in pageData.photos"
              :key="photo.id"
              class="trip-detail__figure"
            >
              <div
                class="trip-detail__thumb-wrap"
                role="button"
                tabindex="0"
                @click="openPhotoLightbox(photoIndex)"
                @keydown.enter.prevent="openPhotoLightbox(photoIndex)"
                @keydown.space.prevent="openPhotoLightbox(photoIndex)"
              >
                <img
                  class="trip-detail__thumb"
                  :src="photo.image_url"
                  :alt="photoCaption(photo) || '旅程照片'"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  class="trip-detail__photo-delete"
                  :disabled="deletingPhotoId === photo.id"
                  aria-label="刪除此照片"
                  @click.stop="deletePhoto(photo)"
                >
                  ✕
                </button>
              </div>
              <div class="trip-detail__edit-photo-meta">
                <p class="trip-detail__caption">
                  {{ photoCaption(photo) }}
                </p>
                <button
                  type="button"
                  class="trip-detail__photo-loc-btn"
                  @click="locationPickerPhoto = photo"
                >
                  編輯地點
                </button>
              </div>
            </figure>
          </div>

          <div v-else class="trip-detail__empty">
            <p class="trip-detail__empty-text">尚無照片，請使用「上傳照片」加入</p>
          </div>
        </div>
      </div>

      <!-- 檢視模式：照片列表 -->
      <section
        v-else
        class="trip-detail__section"
        aria-labelledby="trip-photos-heading"
      >
        <div class="trip-detail__section-head">
          <h2 id="trip-photos-heading" class="trip-detail__section-title">
            照片
          </h2>
          <div
            class="trip-detail__photo-view-toggle"
            role="group"
            aria-label="照片瀏覽模式"
          >
            <button
              type="button"
              class="trip-detail__photo-view-btn"
              :class="{
                'trip-detail__photo-view-btn--active': photoViewMode === 'grid',
              }"
              aria-label="方格瀏覽"
              :aria-pressed="photoViewMode === 'grid'"
              @click="photoViewMode = 'grid'"
            >
              <LayoutGrid :size="16" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="trip-detail__photo-view-btn"
              :class="{
                'trip-detail__photo-view-btn--active': photoViewMode === 'strip',
              }"
              aria-label="橫向滑動瀏覽"
              :aria-pressed="photoViewMode === 'strip'"
              @click="photoViewMode = 'strip'"
            >
              <GalleryHorizontal :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          v-if="pageData.photos.length"
          class="trip-detail__grid"
          :class="
            photoViewMode === 'grid'
              ? 'trip-detail__grid--view-grid'
              : 'trip-detail__grid--view-strip'
          "
        >
          <figure
            v-for="(photo, photoIndex) in pageData.photos"
            :key="photo.id"
            class="trip-detail__figure"
          >
            <div
              class="trip-detail__thumb-wrap"
              role="button"
              tabindex="0"
              @click="openPhotoLightbox(photoIndex)"
              @keydown.enter.prevent="openPhotoLightbox(photoIndex)"
              @keydown.space.prevent="openPhotoLightbox(photoIndex)"
            >
              <img
                class="trip-detail__thumb"
                :src="photo.image_url"
                :alt="photoCaption(photo) || '旅程照片'"
                loading="lazy"
                decoding="async"
              />
            </div>
          </figure>
        </div>

        <div v-else class="trip-detail__empty">
          <p class="trip-detail__empty-text">尚無照片</p>
        </div>
      </section>
    </template>

    <ClientOnly>
      <PhotoLocationPicker
        v-if="locationPickerPhoto"
        title="調整地點"
        :initial-lat="locationPickerPhoto.latitude"
        :initial-lng="locationPickerPhoto.longitude"
        @confirm="savePhotoLocation"
        @cancel="locationPickerPhoto = null"
      />
      <PhotoLightbox
        v-if="photoLightboxOpen && photoLightboxUrls.length"
        :photos="photoLightboxUrls"
        :captions="photoLightboxCaptions"
        :initial-index="photoLightboxInitialIndex"
        @close="photoLightboxOpen = false"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { LayoutGrid, GalleryHorizontal } from "lucide-vue-next"

type TripDetail = {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  is_public: boolean
  cover_image_url: string | null
}

type PhotoRow = {
  id: string
  image_url: string
  created_at: string
  latitude: number | null
  longitude: number | null
  place_name: string | null
}

const route = useRoute()
const supabase = useSupabaseClient()

/** 客戶端掛載後由 getUser 填入；避免 SSR 時 useSupabaseUser() 尚無 session */
const userId = ref<string | null>(null)

onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  userId.value = user?.id ?? null
})

const tripId = computed(() => {
  const id = route.params.id
  if (typeof id === "string") return id
  if (Array.isArray(id) && id[0]) return id[0]
  return ""
})

const { data: pageData, pending, error, refresh } = await useAsyncData(
  () => `trip-detail-${tripId.value}`,
  async () => {
    if (!tripId.value) {
      await navigateTo("/profile", { replace: true })
      return null
    }

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, user_id, name, start_date, end_date, is_public, cover_image_url")
      .eq("id", tripId.value)
      .maybeSingle()

    if (tripErr || !trip) {
      await navigateTo("/profile", { replace: true })
      return null
    }

    const { data: photos, error: photosErr } = await supabase
      .from("photos")
      .select("id, image_url, created_at, latitude, longitude, place_name")
      .eq("trip_id", tripId.value)
      .order("created_at", { ascending: false })

    if (photosErr) throw photosErr

    return {
      trip: trip as TripDetail,
      photos: (photos ?? []) as PhotoRow[],
    }
  },
  { watch: [tripId] },
)

const fetchError = computed(() => error.value?.message ?? null)

const isOwner = computed(
  () =>
    !!userId.value &&
    !!pageData.value?.trip.user_id &&
    userId.value === pageData.value.trip.user_id,
)

const isEditing = ref(false)
const editTab = ref<1 | 2>(1)
const editName = ref("")
const editStartDate = ref("")
const editEndDate = ref("")
const editIsPublic = ref(true)
const editError = ref("")
const savePending = ref(false)
const deletePending = ref(false)
const deletingPhotoId = ref<string | null>(null)
const photoDeleteError = ref("")
const photoViewMode = ref<"grid" | "strip">("grid")
const locationPickerPhoto = ref<PhotoRow | null>(null)
const photoLightboxOpen = ref(false)
const photoLightboxInitialIndex = ref(0)
const photoLightboxUrls = computed(
  () => pageData.value?.photos.map((p) => p.image_url) ?? [],
)

function openPhotoLightbox(index: number) {
  photoLightboxInitialIndex.value = index
  photoLightboxOpen.value = true
}

const coverFileInputRef = ref<HTMLInputElement | null>(null)
const pendingCoverFile = ref<File | null>(null)
const editCoverPreviewUrl = ref<string | null>(null)
let editCoverPreviewRevoke: (() => void) | null = null
const coverRemovePending = ref(false)

const coverCropperOpen = ref(false)
const coverCropSourceUrl = ref<string | null>(null)
let coverCropSourceRevoke: (() => void) | null = null

const editCoverDisplayUrl = computed(() => {
  if (!pageData.value) return null
  if (editCoverPreviewUrl.value) return editCoverPreviewUrl.value
  if (coverRemovePending.value) return null
  return pageData.value.trip.cover_image_url
})

function dateInputValue(iso: string) {
  const s = iso.trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

function revokeEditCoverPreview() {
  if (editCoverPreviewRevoke) {
    editCoverPreviewRevoke()
    editCoverPreviewRevoke = null
  }
  editCoverPreviewUrl.value = null
}

function revokeCoverCropSource() {
  if (coverCropSourceRevoke) {
    coverCropSourceRevoke()
    coverCropSourceRevoke = null
  }
  coverCropSourceUrl.value = null
  coverCropperOpen.value = false
}

onBeforeUnmount(() => {
  revokeEditCoverPreview()
  revokeCoverCropSource()
})

const tripEditDirty = computed(() => {
  if (!pageData.value || !isEditing.value) return false
  const t = pageData.value.trip
  if (editName.value.trim() !== t.name) return true
  if (editStartDate.value !== dateInputValue(t.start_date)) return true
  if (editEndDate.value !== dateInputValue(t.end_date)) return true
  if (editIsPublic.value !== t.is_public) return true
  if (pendingCoverFile.value) return true
  if (coverRemovePending.value && !!t.cover_image_url) return true
  return false
})

function goToEditTab(target: 1 | 2) {
  editTab.value = target
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}

function startEdit() {
  if (!pageData.value) return
  const t = pageData.value.trip
  editTab.value = 1
  editName.value = t.name
  editStartDate.value = dateInputValue(t.start_date)
  editEndDate.value = dateInputValue(t.end_date)
  editIsPublic.value = t.is_public
  editError.value = ""
  photoDeleteError.value = ""
  pendingCoverFile.value = null
  coverRemovePending.value = false
  revokeEditCoverPreview()
  revokeCoverCropSource()
  if (coverFileInputRef.value) coverFileInputRef.value.value = ""
  isEditing.value = true
}

function resetEditSession() {
  editError.value = ""
  photoDeleteError.value = ""
  locationPickerPhoto.value = null
  pendingCoverFile.value = null
  coverRemovePending.value = false
  revokeEditCoverPreview()
  revokeCoverCropSource()
  if (coverFileInputRef.value) coverFileInputRef.value.value = ""
}

function confirmDiscardTripEditIfNeeded(): boolean {
  if (!tripEditDirty.value) return true
  return window.confirm(
    "旅程資訊有未儲存的變更，確定要離開編輯嗎？",
  )
}

function cancelEdit() {
  if (!confirmDiscardTripEditIfNeeded()) return
  resetEditSession()
  isEditing.value = false
}

function completeEditing() {
  if (!confirmDiscardTripEditIfNeeded()) return
  resetEditSession()
  isEditing.value = false
}

function openCoverFilePicker() {
  editError.value = ""
  coverFileInputRef.value?.click()
}

function onEditCoverFileSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file?.type.startsWith("image/")) return
  revokeCoverCropSource()
  if (pendingCoverFile.value) {
    pendingCoverFile.value = null
    revokeEditCoverPreview()
  }
  editError.value = ""
  const url = URL.createObjectURL(file)
  coverCropSourceUrl.value = url
  coverCropSourceRevoke = () => URL.revokeObjectURL(url)
  coverCropperOpen.value = true
}

function onEditCoverCropConfirm(blob: Blob) {
  revokeCoverCropSource()
  revokeEditCoverPreview()
  const file = new File([blob], "cover.jpg", {
    type: blob.type || "image/jpeg",
  })
  pendingCoverFile.value = file
  coverRemovePending.value = false
  editError.value = ""
  const previewUrl = URL.createObjectURL(file)
  editCoverPreviewUrl.value = previewUrl
  editCoverPreviewRevoke = () => URL.revokeObjectURL(previewUrl)
}

function onEditCoverCropCancel() {
  revokeCoverCropSource()
}

function clearCoverEditSelection() {
  editError.value = ""
  revokeCoverCropSource()
  if (pendingCoverFile.value) {
    pendingCoverFile.value = null
    revokeEditCoverPreview()
    return
  }
  if (pageData.value?.trip.cover_image_url) {
    coverRemovePending.value = true
  }
}

async function saveTripInfo() {
  if (!tripId.value || !pageData.value) return

  const trimmed = editName.value.trim()
  if (!trimmed) {
    editError.value = "請輸入旅程名稱。"
    return
  }
  if (!editStartDate.value || !editEndDate.value) {
    editError.value = "請選擇開始與結束日期。"
    return
  }
  if (editEndDate.value < editStartDate.value) {
    editError.value = "結束日期不可早於開始日期。"
    return
  }

  if (!userId.value || userId.value !== pageData.value.trip.user_id) {
    editError.value = "請以旅程擁有者身分登入後再儲存。"
    return
  }

  savePending.value = true
  editError.value = ""

  try {
    const { error: updErr } = await supabase
      .from("trips")
      .update({
        name: trimmed,
        start_date: editStartDate.value,
        end_date: editEndDate.value,
        is_public: editIsPublic.value,
      })
      .eq("id", tripId.value)

    if (updErr) throw new Error(updErr.message)

    if (pendingCoverFile.value) {
      await uploadTripCoverAndUpdateRow(supabase, {
        userId: userId.value,
        tripId: tripId.value,
        file: pendingCoverFile.value,
      })
    } else if (
      coverRemovePending.value &&
      pageData.value.trip.cover_image_url
    ) {
      const coverPath = `covers/${userId.value}/${tripId.value}.jpg`
      await supabase.storage.from("photos").remove([coverPath])
      const { error: clearErr } = await supabase
        .from("trips")
        .update({ cover_image_url: null })
        .eq("id", tripId.value)
      if (clearErr) throw new Error(clearErr.message)
    }

    pendingCoverFile.value = null
    coverRemovePending.value = false
    revokeEditCoverPreview()

    await refresh()
    await refreshNuxtData("profile-trips")

    if (pageData.value) {
      const t = pageData.value.trip
      editName.value = t.name
      editStartDate.value = dateInputValue(t.start_date)
      editEndDate.value = dateInputValue(t.end_date)
      editIsPublic.value = t.is_public
    }
  } catch (e) {
    editError.value =
      e instanceof Error ? e.message : "儲存失敗，請稍後再試。"
  } finally {
    savePending.value = false
  }
}

async function onDeleteTrip() {
  if (!tripId.value) return
  if (
    !window.confirm(
      "確定要刪除此旅程嗎？此動作無法復原。",
    )
  ) {
    return
  }

  deletePending.value = true
  editError.value = ""

  const { data: photoRows, error: photoRowsErr } = await supabase
    .from("photos")
    .select("image_url")
    .eq("trip_id", tripId.value)

  if (photoRowsErr) {
    deletePending.value = false
    editError.value = photoRowsErr.message
    return
  }

  if (photoRows?.length) {
    const paths = photoRows
      .map((p) =>
        p.image_url
          ? storageObjectPathFromPublicImageUrl(p.image_url)
          : null,
      )
      .filter((p): p is string => p !== null)
    if (paths.length) {
      const { error: removePhotosErr } = await supabase.storage
        .from("photos")
        .remove(paths)
      if (removePhotosErr) {
        deletePending.value = false
        editError.value = removePhotosErr.message
        return
      }
    }
  }

  const ownerId = pageData.value?.trip.user_id
  if (ownerId) {
    const coverPath = `covers/${ownerId}/${tripId.value}.jpg`
    const { error: removeCoverErr } = await supabase.storage
      .from("photos")
      .remove([coverPath])
    if (removeCoverErr) {
      deletePending.value = false
      editError.value = removeCoverErr.message
      return
    }
  }

  const { error: photosErr } = await supabase
    .from("photos")
    .delete()
    .eq("trip_id", tripId.value)

  if (photosErr) {
    deletePending.value = false
    editError.value = photosErr.message
    return
  }

  const { error: tripErr } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId.value)

  deletePending.value = false

  if (tripErr) {
    editError.value = tripErr.message
    return
  }

  await refreshNuxtData("profile-trips")
  await navigateTo("/profile")
}

/** 由公開圖片 URL 還原 Storage bucket「photos」內物件路徑 */
function storageObjectPathFromPublicImageUrl(imageUrl: string): string | null {
  try {
    const u = new URL(imageUrl)
    const needle = "/object/public/photos/"
    const i = u.pathname.indexOf(needle)
    if (i === -1) return null
    return decodeURIComponent(u.pathname.slice(i + needle.length))
  } catch {
    return null
  }
}

async function refreshPhotosList() {
  const { data: photos } = await supabase
    .from("photos")
    .select("id, image_url, created_at, latitude, longitude, place_name")
    .eq("trip_id", tripId.value)
    .order("created_at", { ascending: false })

  if (pageData.value && photos) {
    pageData.value = { ...pageData.value, photos: photos as PhotoRow[] }
  }
}

async function savePhotoLocation(lat: number, lng: number) {
  const current = locationPickerPhoto.value
  if (!current) return

  locationPickerPhoto.value = { ...current, latitude: lat, longitude: lng }

  photoDeleteError.value = ""

  let placeName: string
  try {
    const res = await fetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    )
    if (res.ok) {
      const data = (await res.json()) as { display_name?: string }
      const name =
        typeof data.display_name === "string" ? data.display_name.trim() : ""
      placeName = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    } else {
      placeName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  } catch {
    placeName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }

  const { error: updateErr } = await supabase
    .from("photos")
    .update({
      latitude: lat,
      longitude: lng,
      place_name: placeName,
    })
    .eq("id", current.id)

  if (updateErr) {
    photoDeleteError.value = updateErr.message
    return
  }

  await refreshPhotosList()
  locationPickerPhoto.value = null
}

async function onPhotosUploaded() {
  await refreshPhotosList()
}

async function deletePhoto(photo: PhotoRow) {
  if (
    !window.confirm(
      "確定刪除此照片？將一併從雲端儲存移除檔案，且無法復原。",
    )
  ) {
    return
  }

  photoDeleteError.value = ""
  deletingPhotoId.value = photo.id

  const path = storageObjectPathFromPublicImageUrl(photo.image_url)
  if (path) {
    const { error: storageErr } = await supabase.storage
      .from("photos")
      .remove([path])

    if (storageErr) {
      deletingPhotoId.value = null
      photoDeleteError.value = storageErr.message
      return
    }
  }

  const { error: rowErr } = await supabase
    .from("photos")
    .delete()
    .eq("id", photo.id)

  deletingPhotoId.value = null

  if (rowErr) {
    photoDeleteError.value = rowErr.message
    return
  }

  await refreshPhotosList()
}

function photoCaption(photo: PhotoRow) {
  const name = photo.place_name?.trim()
  if (name) return name
  if (photo.latitude != null && photo.longitude != null) {
    return `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`
  }
  return ""
}

const photoLightboxCaptions = computed(() => {
  const photos = pageData.value?.photos
  if (!photos?.length) return [] as string[]
  return photos.map((p) => photoCaption(p))
})

useHead(() => ({
  title: pageData.value?.trip?.name
    ? `${pageData.value.trip.name} | Filmtrip`
    : "旅程 | Filmtrip",
}))

function formatDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}
</script>

<style lang="scss" scoped>
.trip-detail {
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  transition: max-width 0.2s ease;

  &--edit-narrow {
    max-width: 28rem;
  }

  &--edit-wide {
    max-width: 56rem;
  }

  &__hint {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__error {
    margin: 0;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__header {
    margin-bottom: 2rem;
  }

  &__header-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin-bottom: 0.75rem;
  }

  &__header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  &__btn {
    padding: 0.4rem 0.75rem;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover:not(:disabled) {
      background: var(--color-border);
    }

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    &--primary {
      color: #fff;
      background: var(--color-accent);
      border-color: var(--color-accent);

      &:hover:not(:disabled) {
        filter: brightness(1.05);
      }
    }

    &--danger {
      color: var(--color-danger);
      border-color: rgba(220, 38, 38, 0.35);
      background: var(--color-danger-bg);

      &:hover:not(:disabled) {
        background: rgba(220, 38, 38, 0.12);
      }
    }
  }

  &__edit-form {
    margin: 0;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  &__edit-shell {
    margin-bottom: 2rem;
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

  &__progress-item--current .trip-detail__progress-num {
    background: var(--color-accent);
    color: #fff;
  }

  &__progress-item--done .trip-detail__progress-num {
    background: var(--color-accent);
    color: #fff;
  }

  &__section-heading {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__cover-block {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border);
    margin-bottom: 0;
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

  &__cover-preview-img {
    display: block;
    width: 100%;
    max-height: 14rem;
    object-fit: cover;
    vertical-align: middle;
  }

  &__cover-removed-note {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
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

  &__edit-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  &__edit-tab-photos {
    padding: 0 0 0.5rem;
  }

  &__section-head--tab2 {
    margin-bottom: 1rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;

    &:last-of-type {
      margin-bottom: 0;
    }

    &--visibility {
      margin-bottom: 0;
    }
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
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
  }

  &__edit-error {
    margin: 0.75rem 0 0;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__back {
    display: inline-block;
    margin-bottom: 0.75rem;
    font-size: 0.9375rem;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__cover {
    margin: 0 0 1rem;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  &__cover-img {
    display: block;
    width: 100%;
    max-height: 18rem;
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

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__visibility {
    margin: -0.25rem 0 0.5rem;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--color-text-muted);
  }

  &__dates {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-muted);
  }

  &__sep {
    margin: 0 0.35rem;
    opacity: 0.6;
  }

  &__section {
    margin-top: 0.5rem;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__photo-delete-error {
    margin: 0 0 0.75rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__grid {
    padding-bottom: 0.25rem;
  }

  &__photo-view-toggle {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0;
    padding: 0.15rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  &__photo-view-btn {
    margin: 0;
    padding: 0.35rem 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;

    &:hover {
      color: var(--color-text);
    }

    &--active {
      color: var(--color-text);
      background: rgba(37, 99, 235, 0.1);
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25);
    }
  }

  &__grid--view-strip {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 0.65rem;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  &__grid--view-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.65rem;
    overflow: visible;
  }

  &__figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__grid--view-strip .trip-detail__figure {
    flex: 0 0 auto;
  }

  &__grid--view-grid .trip-detail__figure {
    width: 100%;
  }

  &__thumb-wrap {
    position: relative;
    flex-shrink: 0;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    cursor: pointer;
  }

  &__grid--view-strip .trip-detail__thumb-wrap {
    align-self: flex-start;
    width: auto;
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  &__grid--view-grid .trip-detail__thumb-wrap {
    align-self: stretch;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    overflow: hidden;
    display: block;
    background: var(--color-border);
  }

  &__thumb {
    vertical-align: middle;
  }

  &__grid--view-strip .trip-detail__thumb {
    display: block;
    height: 220px;
    width: auto;
    max-width: none;
    object-fit: contain;
  }

  &__grid--view-grid .trip-detail__thumb {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;
  }

  &__photo-delete {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    width: 1.45rem;
    height: 1.45rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: rgba(17, 24, 39, 0.82);
    color: #fff;
    font-size: 0.75rem;
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

  &__caption {
    margin: 0;
    font-size: 0.6875rem;
    line-height: 1.3;
    color: var(--color-text-muted);
    word-break: break-word;
  }

  &__photo-loc-btn {
    align-self: flex-start;
    margin: 0;
    padding: 0.2rem 0.45rem;
    font: inherit;
    font-size: 0.625rem;
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

  &__grid--edit {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    overflow: visible;
    padding-bottom: 0.25rem;

    .trip-detail__figure {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      min-width: 0;
    }

    .trip-detail__thumb-wrap {
      flex-shrink: 0;
      align-self: stretch;
      width: 100%;
      height: auto;
      aspect-ratio: 1;
      overflow: hidden;
      display: block;
    }

    .trip-detail__thumb {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      object-fit: cover;
    }

    .trip-detail__edit-photo-meta {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      gap: 4px
    }

    .trip-detail__caption {
      margin: auto;
      box-sizing: border-box;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      
    }

    .trip-detail__photo-loc-btn {
      flex-shrink: 0;
      align-self: flex-start;
      width: 100%;
      box-sizing: border-box;
    }
  }

  &__empty {
    padding: 2rem 1rem;
    text-align: center;
    border: 1px dashed var(--color-border-strong);
    border-radius: 0.5rem;
    background: var(--color-surface);
  }

  &__empty-text {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }
}
</style>