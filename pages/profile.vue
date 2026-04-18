<template>
  <div class="profile">
    <div class="profile__head">
      <h1 class="profile__title">個人檔案</h1>
      <button
        type="button"
        class="profile__settings-btn"
        aria-haspopup="dialog"
        :aria-expanded="settingsOpen"
        aria-controls="profile-settings-dialog"
        @click="settingsOpen = true"
      >
        <Settings :size="20" aria-hidden="true" />
        <span class="profile__settings-label">設定</span>
      </button>
    </div>

    <section class="profile__identity" aria-label="個人資訊">
      <button
        type="button"
        class="profile__avatar-btn"
        :class="{ 'profile__avatar-btn--busy': avatarUploading }"
        aria-haspopup="dialog"
        :aria-expanded="avatarModalOpen"
        aria-controls="profile-avatar-dialog"
        aria-label="變更大頭照"
        :disabled="avatarUploading"
        @click="avatarModalOpen = true"
      >
        <img
          v-if="resolvedAvatarUrl"
          class="profile__avatar-img"
          :src="resolvedAvatarUrl"
          alt=""
          width="80"
          height="80"
        />
        <User v-else class="profile__avatar-icon" :size="40" aria-hidden="true" />
      </button>

      <h2 class="profile__display-name">
        <template v-if="profileLoading">載入中…</template>
        <template v-else>{{ displayName }}</template>
      </h2>

      <p class="profile__location">
        <template v-if="profileLoading">載入中…</template>
        <template v-else>{{ locationLine }}</template>
      </p>
      <p class="profile__trip-count">
        <template v-if="pending">載入中…</template>
        <template v-else>{{ tripCountLabel }}</template>
      </p>

      <p v-if="email" class="profile__meta">目前帳號：{{ email }}</p>
      <p v-if="profileLoadError" class="profile__error" role="alert">
        {{ profileLoadError }}
      </p>
    </section>

    <Teleport to="body">
      <div
        v-show="settingsOpen"
        id="profile-settings-dialog"
        class="profile-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-settings-title"
      >
        <header class="profile-settings__header">
          <h2 id="profile-settings-title" class="profile-settings__title">
            設定
          </h2>
          <button
            type="button"
            class="profile-settings__close"
            aria-label="關閉"
            @click="settingsOpen = false"
          >
            ×
          </button>
        </header>
        <div class="profile-settings__body">
          <button
            type="button"
            class="profile-settings__signout"
            @click="signOut"
          >
            登出
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-show="avatarModalOpen && !cropperOpen"
        id="profile-avatar-dialog"
        class="profile-avatar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-avatar-title"
      >
        <div
          class="profile-avatar-modal__backdrop"
          aria-hidden="true"
          @click="avatarModalOpen = false"
        />
        <div class="profile-avatar-modal__panel">
          <h2 id="profile-avatar-title" class="profile-avatar-modal__title">
            變更大頭照
          </h2>
          <div class="profile-avatar-modal__actions">
            <button
              type="button"
              class="profile-avatar-modal__btn profile-avatar-modal__btn--primary"
              :disabled="avatarUploading"
              @click="openAvatarFilePicker"
            >
              上傳照片
            </button>
            <button
              type="button"
              class="profile-avatar-modal__btn profile-avatar-modal__btn--ghost"
              :disabled="avatarUploading"
              @click="avatarModalOpen = false"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <input
      ref="avatarFileInputRef"
      type="file"
      class="profile__file-input"
      accept="image/jpeg,image/png,image/webp"
      tabindex="-1"
      aria-hidden="true"
      @change="onAvatarFileChange"
    />

    <CoverImageCropper
      v-if="cropperOpen && cropImageObjectUrl"
      :image-url="cropImageObjectUrl"
      :aspect-ratio="1"
      @confirm="onAvatarCropConfirm"
      @cancel="onAvatarCropCancel"
    />

    <p
      v-if="avatarUploading"
      class="profile__upload-status"
      role="status"
      aria-live="polite"
    >
      上傳中…
    </p>

    <section class="profile__section" aria-labelledby="profile-trips-heading">
      <div class="profile__section-head">
        <h2 id="profile-trips-heading" class="profile__section-title">
          我的旅程
        </h2>
        <NuxtLink class="profile__action" to="/trips/new">建立旅程</NuxtLink>
      </div>

      <p v-if="pending" class="profile__hint">載入中…</p>
      <p v-else-if="fetchError" class="profile__error" role="alert">
        {{ fetchError }}
      </p>
      <p v-else-if="!tripsList.length" class="profile__hint">
        尚無旅程，先建立一筆吧。
      </p>
      <ul v-else class="profile__list">
        <li v-for="trip in tripsList" :key="trip.id">
          <NuxtLink class="profile__trip" :to="`/trips/${trip.id}`">
            <span class="profile__trip-name">{{ trip.name }}</span>
            <span class="profile__trip-dates">
              <time :datetime="trip.start_date">{{ formatDate(trip.start_date) }}</time>
              <span class="profile__trip-sep" aria-hidden="true">—</span>
              <time :datetime="trip.end_date">{{ formatDate(trip.end_date) }}</time>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <nav class="profile__nav">
      <NuxtLink class="profile__link profile__link--muted" to="/">回到首頁</NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { Settings, User } from "lucide-vue-next"
import type { JwtPayload } from "@supabase/supabase-js"

type TripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
}

type ProfileRow = {
  id: string
  avatar_url: string | null
  display_name: string | null
  city: string | null
  country: string | null
}

const settingsOpen = ref(false)
const avatarModalOpen = ref(false)
const cropperOpen = ref(false)
const cropImageObjectUrl = ref<string | null>(null)
const avatarFileInputRef = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)

const profile = ref<ProfileRow | null>(null)
const profileLoading = ref(true)
const profileLoadError = ref<string | null>(null)

const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()
const { setProfileAvatarUrl } = useNavProfileAvatar()

const userId = computed(
  () => (userClaims.value as JwtPayload | null)?.sub ?? null,
)

const userMeta = computed(
  () =>
    userClaims.value?.user_metadata as
      | { avatar_url?: string; full_name?: string; name?: string }
      | undefined,
)

const email = computed(
  () => (userClaims.value as JwtPayload | null)?.email ?? null,
)

const resolvedAvatarUrl = computed(() => {
  const fromProfile = profile.value?.avatar_url
  if (fromProfile) {
    return fromProfile
  }
  const fromGoogle = userMeta.value?.avatar_url
  return fromGoogle ?? null
})

const displayName = computed(() => {
  const fromProfile = profile.value?.display_name?.trim()
  if (fromProfile) {
    return fromProfile
  }
  const m = userMeta.value
  const fromOAuth = (m?.full_name ?? m?.name)?.trim()
  return fromOAuth || "使用者"
})

const locationLine = computed(() => {
  const city = profile.value?.city?.trim()
  const country = profile.value?.country?.trim()
  if (city && country) {
    return `${city}, ${country}`
  }
  if (city) {
    return city
  }
  if (country) {
    return country
  }
  return "尚未設定居住地"
})

const { data: trips, error, pending } = await useAsyncData(
  "profile-trips",
  async () => {
    if (!userId.value) {
      return [] as TripRow[]
    }
    const { data, error: qErr } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date, created_at")
      .eq("user_id", userId.value)
      .order("created_at", { ascending: false })
    if (qErr) {
      throw qErr
    }
    return (data ?? []) as TripRow[]
  },
  {
    watch: [userId],
  },
)
const tripsList = computed(() => trips.value ?? [])
const fetchError = computed(() => error.value?.message ?? null)

const tripCountLabel = computed(() => `${tripsList.value.length} 筆旅程`)

onMounted(async () => {
  console.log("[Profile] onMounted: start")
  profileLoading.value = true
  profileLoadError.value = null

  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser()

  console.log("[Profile] getUser:", { authUser, authErr })

  if (authErr) {
    console.error("[Profile] getUser error:", authErr)
    profileLoadError.value = authErr.message
    profileLoading.value = false
    return
  }

  const userId = authUser?.id
  console.log("[Profile] userId:", userId)

  if (!userId) {
    console.warn("[Profile] no userId, skip profile load")
    profileLoading.value = false
    return
  }

  const { data: row, error: selErr } = await supabase
    .from("profiles")
    .select("id, avatar_url, display_name, city, country")
    .eq("id", userId)
    .maybeSingle()

  console.log("[Profile] select (maybeSingle) result:", { row, selErr })

  if (selErr) {
    console.error("[Profile] select (maybeSingle) error:", selErr)
    profileLoadError.value = selErr.message
    profileLoading.value = false
    return
  }

  if (!row) {
    console.log("[Profile] no row, upsert empty profile")

    const { data: upsertData, error: upsertErr } = await supabase
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" })

    console.log("[Profile] upsert result:", upsertData, upsertErr)

    if (upsertErr) {
      console.error("[Profile] upsert error:", upsertErr)
      profileLoadError.value = upsertErr.message
      profileLoading.value = false
      return
    }

    const { data: created, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, city, country")
      .eq("id", userId)
      .single()

    console.log("[Profile] select after upsert (single) result:", {
      created,
      fetchErr,
    })

    if (fetchErr) {
      console.error("[Profile] select after upsert error:", fetchErr)
      profileLoadError.value = fetchErr.message
      profileLoading.value = false
      return
    }
    profile.value = created as ProfileRow
    console.log("[Profile] profile set (after create):", profile.value)
  } else {
    profile.value = row as ProfileRow
    console.log("[Profile] profile set (existing row):", profile.value)
  }

  if (profile.value) {
    setProfileAvatarUrl(profile.value.avatar_url ?? null)
  }

  profileLoading.value = false
  console.log("[Profile] onMounted: done")
})

watch(avatarModalOpen, (open) => {
  if (!open && !cropperOpen.value && cropImageObjectUrl.value) {
    URL.revokeObjectURL(cropImageObjectUrl.value)
    cropImageObjectUrl.value = null
  }
})

function openAvatarFilePicker() {
  avatarFileInputRef.value?.click()
}

function onAvatarFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file || !file.type.startsWith("image/")) {
    return
  }
  if (cropImageObjectUrl.value) {
    URL.revokeObjectURL(cropImageObjectUrl.value)
  }
  cropImageObjectUrl.value = URL.createObjectURL(file)
  cropperOpen.value = true
}

function onAvatarCropCancel() {
  if (cropImageObjectUrl.value) {
    URL.revokeObjectURL(cropImageObjectUrl.value)
    cropImageObjectUrl.value = null
  }
  cropperOpen.value = false
}

async function onAvatarCropConfirm(blob: Blob) {
  const { data: authData } = await supabase.auth.getUser()
  const uid = authData.user?.id
  if (!uid) {
    onAvatarCropCancel()
    return
  }

  avatarUploading.value = true
  profileLoadError.value = null

  const {
    data: { session },
  } = await supabase.auth.getSession()
  console.log(
    "[Profile] session before upload:",
    session?.access_token ? "has token" : "NO TOKEN",
  )

  const path = `${uid}/avatar.jpg`
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    })

  if (upErr) {
    profileLoadError.value = upErr.message
    avatarUploading.value = false
    return
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { data: upserted, error: dbErr } = await supabase
    .from("profiles")
    .upsert(
      { id: uid, avatar_url: publicUrl },
      { onConflict: "id" },
    )
    .select("id, avatar_url, display_name, city, country")
    .single()

  if (dbErr) {
    profileLoadError.value = dbErr.message
    avatarUploading.value = false
    return
  }

  profile.value = upserted as ProfileRow
  setProfileAvatarUrl(publicUrl)

  if (cropImageObjectUrl.value) {
    URL.revokeObjectURL(cropImageObjectUrl.value)
    cropImageObjectUrl.value = null
  }
  cropperOpen.value = false
  avatarModalOpen.value = false
  avatarUploading.value = false
}

async function signOut() {
  await supabase.auth.signOut()
  settingsOpen.value = false
  await navigateTo("/")
}

function formatDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(d.getTime())) {
    return isoDate
  }
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}
</script>

<style lang="scss" scoped>
.profile {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  &__title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__settings-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    font: inherit;
    font-size: 0.875rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    cursor: pointer;

    &:hover {
      border-color: var(--color-border-strong);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__settings-label {
    font-weight: 500;
  }

  &__identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
    gap: 0.35rem;
  }

  &__avatar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    padding: 0;
    margin-bottom: 0.5rem;
    overflow: hidden;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 50%;
    cursor: pointer;
    transition: border-color 0.12s ease, box-shadow 0.12s ease;

    &:hover {
      border-color: var(--color-border-strong);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 3px;
    }
  }

  &__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-icon {
    color: var(--color-text-muted);
  }

  &__avatar-btn--busy {
    opacity: 0.65;
    cursor: wait;
  }

  &__upload-status {
    position: fixed;
    bottom: calc(5rem + env(safe-area-inset-bottom, 0));
    left: 50%;
    z-index: 10000;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 2rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    pointer-events: none;
  }

  &__display-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__location {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__trip-count {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__meta {
    margin: 0.35rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__file-input {
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

  &__section {
    margin-bottom: 2rem;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__action {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
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

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface);
    overflow: hidden;
  }

  &__trip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    padding: 0.85rem 1rem;
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.12s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
  }

  &__trip-name {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__trip-dates {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__trip-sep {
    margin: 0 0.25rem;
    opacity: 0.6;
  }

  &__nav {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__link {
    font-size: 0.9375rem;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &--muted {
      color: var(--color-text-muted);
    }
  }
}

.profile-settings {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  color: var(--color-text);
}

.profile-settings__header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.profile-settings__body {
  flex: 1;
  padding: 1rem 1.25rem;
  min-height: 0;
}

.profile-settings__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.profile-settings__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  font: inherit;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;

  &:hover {
    color: var(--color-text);
    background: var(--color-bg);
  }
}

.profile-settings__signout {
  display: block;
  width: 100%;
  padding: 0.65rem 0.85rem;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-danger);
  background: transparent;
  border: 1px solid var(--color-danger);
  border-radius: 0.375rem;
  cursor: pointer;

  &:hover {
    background: var(--color-danger-bg);
  }

  &:focus-visible {
    outline: 2px solid var(--color-danger);
    outline-offset: 2px;
  }
}

.profile-avatar-modal {
  position: fixed;
  inset: 0;
  z-index: 101;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.profile-avatar-modal__panel {
  position: relative;
  z-index: 1;
  width: 90%;
  max-width: 320px;
  padding: 1.5rem;
  background: var(--color-surface);
  border-radius: 1rem;
}

.profile-avatar-modal__title {
  margin: 0 0 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
}

.profile-avatar-modal__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-avatar-modal__btn {
  display: block;
  width: 100%;
  padding: 0.65rem 0.85rem;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  border: 1px solid transparent;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.profile-avatar-modal__btn--primary {
  color: #fff;
  background: var(--color-accent);
  border-color: var(--color-accent);

  &:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
}

.profile-avatar-modal__btn--ghost {
  color: var(--color-text);
  background: var(--color-bg);
  border-color: var(--color-border);

  &:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }
}
</style>
