<template>
  <div class="trip-detail">
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
                @click="saveEdit"
              >
                儲存
              </button>
            </template>
          </div>
        </div>

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

        <form
          v-else
          class="trip-detail__edit-form"
          @submit.prevent="saveEdit"
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
          <p v-if="editError" class="trip-detail__edit-error" role="alert">
            {{ editError }}
          </p>
        </form>
      </header>

      <section
        class="trip-detail__section"
        aria-labelledby="trip-photos-heading"
      >
        <div class="trip-detail__section-head">
          <h2 id="trip-photos-heading" class="trip-detail__section-title">
            照片
          </h2>
          <!--
            僅在客戶端、且 auth.getUser 已取得 userId 後再掛載，避免 hydration / session 未就緒時送 Storage。
            編輯表單在上一段 header，與此區塊不同一個 <form>，不會攔截上傳按鈕。
          -->
          <ClientOnly>
            <TripPhotoUploadPanel
              v-if="tripId && userId"
              :key="`${tripId}:${userId}`"
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

        <div v-if="pageData.photos.length" class="trip-detail__grid">
          <figure
            v-for="photo in pageData.photos"
            :key="photo.id"
            class="trip-detail__figure"
          >
            <div class="trip-detail__thumb-wrap">
              <img
                class="trip-detail__thumb"
                :src="photo.image_url"
                :alt="photoCaption(photo) || '旅程照片'"
                loading="lazy"
                decoding="async"
              />
              <button
                v-if="isEditing"
                type="button"
                class="trip-detail__photo-delete"
                :disabled="deletingPhotoId === photo.id"
                aria-label="刪除此照片"
                @click="deletePhoto(photo)"
              >
                ✕
              </button>
            </div>
            <figcaption
              v-if="photoCaption(photo)"
              class="trip-detail__caption"
            >
              {{ photoCaption(photo) }}
            </figcaption>
          </figure>
        </div>

        <div v-else class="trip-detail__empty">
          <p class="trip-detail__empty-text">尚無照片</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
type TripDetail = {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  is_public: boolean
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
      .select("id, user_id, name, start_date, end_date, is_public")
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
const editName = ref("")
const editStartDate = ref("")
const editEndDate = ref("")
const editIsPublic = ref(true)
const editError = ref("")
const savePending = ref(false)
const deletePending = ref(false)
const deletingPhotoId = ref<string | null>(null)
const photoDeleteError = ref("")

function dateInputValue(iso: string) {
  const s = iso.trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

function startEdit() {
  if (!pageData.value) return
  const t = pageData.value.trip
  editName.value = t.name
  editStartDate.value = dateInputValue(t.start_date)
  editEndDate.value = dateInputValue(t.end_date)
  editIsPublic.value = t.is_public
  editError.value = ""
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editError.value = ""
  photoDeleteError.value = ""
}

async function saveEdit() {
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

  savePending.value = true
  editError.value = ""
  const { error: updErr } = await supabase
    .from("trips")
    .update({
      name: trimmed,
      start_date: editStartDate.value,
      end_date: editEndDate.value,
      is_public: editIsPublic.value,
    })
    .eq("id", tripId.value)

  savePending.value = false

  if (updErr) {
    editError.value = updErr.message
    return
  }

  await refresh()
  await refreshNuxtData("profile-trips")
  isEditing.value = false
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 0.65rem;
  }

  &__figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  &__thumb-wrap {
    position: relative;
    width: 100%;
  }

  &__thumb {
    aspect-ratio: 1;
    width: 100%;
    border-radius: 0.375rem;
    overflow: hidden;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    object-fit: cover;
    display: block;
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