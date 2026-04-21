<template>
  <div
    :key="collectionRouteId"
    class="collection-detail"
  >
    <p v-if="pending" class="collection-detail__state">載入中…</p>
    <p v-else-if="fetchError" class="collection-detail__error" role="alert">
      {{ fetchError }}
    </p>
    <template v-else-if="pageData">
      <header class="collection-detail__head">
        <div class="collection-detail__head-top">
          <div class="collection-detail__head-main">
            <template v-if="!editMode">
              <h1 class="collection-detail__title">
                {{ pageData.collection.name }}
              </h1>
            </template>
            <template v-else>
              <input
                ref="renameInputRef"
                v-model="draftName"
                class="collection-detail__rename-input"
                type="text"
                maxlength="120"
                aria-label="收藏夾名稱"
                @keydown.enter.prevent="finishEdit"
              >
              <div class="collection-detail__rename-actions">
                <button
                  type="button"
                  class="collection-detail__btn collection-detail__btn--primary"
                  :disabled="savingName"
                  @click="finishEdit"
                >
                  完成
                </button>
                <button
                  type="button"
                  class="collection-detail__btn"
                  :disabled="savingName"
                  @click="cancelEdit"
                >
                  取消
                </button>
              </div>
            </template>
            <p class="collection-detail__subtitle">
              {{ displayPhotos.length }} 張照片
            </p>
          </div>
          <div
            v-if="!editMode"
            class="collection-detail__head-actions"
          >
            <button
              type="button"
              class="collection-detail__icon-btn"
              aria-label="編輯"
              @click="enterEditMode"
            >
              <Pencil :size="22" aria-hidden="true" />
            </button>
            <div
              ref="menuRef"
              class="collection-detail__menu"
            >
              <button
                type="button"
                class="collection-detail__icon-btn"
                aria-label="更多"
                aria-haspopup="menu"
                :aria-expanded="menuOpen"
                @click.stop="menuOpen = !menuOpen"
              >
                <MoreVertical :size="22" aria-hidden="true" />
              </button>
              <ul
                v-show="menuOpen"
                class="collection-detail__menu-list"
                role="menu"
                @click.stop
              >
                <li role="none">
                  <button
                    type="button"
                    class="collection-detail__menu-item collection-detail__menu-item--danger"
                    role="menuitem"
                    @click="confirmDeleteCollectionFromMenu"
                  >
                    刪除收藏夾
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <p
        v-if="!displayPhotos.length"
        class="collection-detail__state collection-detail__state--muted"
      >
        此收藏夾尚無照片。
      </p>
      <ul
        v-else
        class="collection-detail__grid"
        role="list"
      >
        <li
          v-for="photo in displayPhotos"
          :key="photo.id"
          class="collection-detail__cell"
        >
          <div class="collection-detail__cell-inner">
            <NuxtLink
              class="collection-detail__link"
              :to="`/photos/${photo.id}`"
            >
              <img
                class="collection-detail__img"
                :src="photo.image_url"
                alt=""
                loading="lazy"
                decoding="async"
              >
            </NuxtLink>
            <button
              v-if="editMode"
              type="button"
              class="collection-detail__remove-photo"
              aria-label="從收藏移除"
              @click.stop.prevent="onRemovePhoto(photo.id)"
            >
              <X :size="16" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from "vue"
import { MoreVertical, Pencil, X } from "lucide-vue-next"

definePageMeta({
  middleware: "collections-auth",
})

const route = useRoute()

/** 供 template :key 與 asyncData key 使用，避免同頁切換收藏夾時沿用舊 DOM／快取 */
const collectionRouteId = computed(() => String(route.params.id ?? ""))

/** 每個收藏夾一個快取槽（Nuxt useAsyncData 以 key 區分） */
const collectionAsyncKey = computed(
  () => `collection-detail-${collectionRouteId.value}`,
)

const supabase = useSupabaseClient()

type PhotoBrief = {
  id: string
  image_url: string
}

const {
  data: pageData,
  pending,
  error: loadError,
} = await useAsyncData(
  collectionAsyncKey,
  async () => {
    const id = collectionRouteId.value

    if (!id) {
      return null
    }

    const { data: col, error: cErr } = await supabase
      .from("collections")
      .select("id, name")
      .eq("id", id)
      .maybeSingle()

    if (cErr) throw cErr
    if (!col) return null

    const { data: rows, error: iErr } = await supabase
      .from("collection_items")
      .select(
        `
        photo_id,
        created_at,
        photos (
          id,
          image_url
        )
      `,
      )
      .eq("collection_id", id)
      .order("created_at", { ascending: false })

    if (iErr) throw iErr

    const photos: PhotoBrief[] = []
    for (const row of rows ?? []) {
      const r = row as {
        photos: PhotoBrief | PhotoBrief[] | null
      }
      const p = Array.isArray(r.photos) ? r.photos[0] : r.photos
      if (p?.id && p.image_url) {
        photos.push({ id: p.id, image_url: p.image_url })
      }
    }

    return {
      collection: { id: col.id as string, name: col.name as string },
      photos,
    }
  },
  { watch: [collectionRouteId] },
)

const fetchError = computed(() => {
  if (loadError.value) return loadError.value.message
  if (!pending.value && pageData.value === null) {
    return "找不到此收藏夾。"
  }
  return ""
})

const displayPhotos = ref<PhotoBrief[]>([])

watch(
  () => pageData.value,
  (d) => {
    if (d) displayPhotos.value = [...d.photos]
  },
  { immediate: true },
)

/** 編輯模式：名稱 input + 照片可移除 */
const editMode = ref(false)
const draftName = ref("")
const savingName = ref(false)
const renameInputRef = ref<HTMLInputElement | null>(null)

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

watch(collectionRouteId, () => {
  editMode.value = false
  menuOpen.value = false
})

function onDocClick(e: MouseEvent) {
  if (!menuOpen.value) return
  const el = menuRef.value
  if (el && !el.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", onDocClick)
})

onUnmounted(() => {
  document.removeEventListener("click", onDocClick)
})

async function enterEditMode() {
  if (!pageData.value) return
  menuOpen.value = false
  draftName.value = pageData.value.collection.name
  editMode.value = true
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function cancelEdit() {
  editMode.value = false
  draftName.value = ""
}

async function finishEdit() {
  const col = pageData.value?.collection
  if (!col) return
  const next = draftName.value.trim()
  if (!next) {
    window.alert("請輸入收藏夾名稱。")
    return
  }
  if (next === col.name) {
    cancelEdit()
    return
  }
  savingName.value = true
  try {
    const { error } = await supabase
      .from("collections")
      .update({ name: next })
      .eq("id", col.id)
    if (error) throw error
    pageData.value = {
      ...pageData.value!,
      collection: { ...col, name: next },
    }
    cancelEdit()
  } catch (e) {
    console.error(e)
    window.alert("更新名稱失敗，請稍後再試。")
  } finally {
    savingName.value = false
  }
}

function confirmDeleteCollectionFromMenu() {
  menuOpen.value = false
  void runDeleteCollection()
}

async function runDeleteCollection() {
  const col = pageData.value?.collection
  if (!col) return
  if (
    !window.confirm("確定要刪除此收藏夾？此操作無法復原")
  ) {
    return
  }
  const { error } = await supabase.from("collections").delete().eq("id", col.id)
  if (error) {
    console.error(error)
    window.alert("刪除失敗，請稍後再試。")
    return
  }
  await navigateTo("/collections")
}

async function onRemovePhoto(photoId: string) {
  const col = pageData.value?.collection
  if (!col) return
  const prev = [...displayPhotos.value]
  displayPhotos.value = displayPhotos.value.filter((p) => p.id !== photoId)
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", col.id)
    .eq("photo_id", photoId)
  if (error) {
    console.error(error)
    displayPhotos.value = prev
    window.alert("移除照片失敗，請稍後再試。")
    return
  }
  if (pageData.value) {
    pageData.value = {
      ...pageData.value,
      photos: [...displayPhotos.value],
    }
  }
}
</script>

<style lang="scss" scoped>
.collection-detail {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.5rem;
}

.collection-detail__state {
  margin: 0;
  padding: 1rem 0;
  font-size: 0.9375rem;
  color: var(--color-text);

  &--muted {
    color: var(--color-text-muted);
  }
}

.collection-detail__error {
  margin: 0;
  padding: 0.75rem 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.collection-detail__head {
  margin-bottom: 1rem;
}

.collection-detail__head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.collection-detail__head-main {
  min-width: 0;
  flex: 1;
}

.collection-detail__title {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.collection-detail__subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.collection-detail__rename-input {
  box-sizing: border-box;
  width: 100%;
  margin: 0 0 0.5rem;
  padding: 0.5rem 0.65rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
}

.collection-detail__rename-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.collection-detail__btn {
  margin: 0;
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  font: inherit;
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: rgba(37, 99, 235, 0.08);
  }

  &--primary {
    color: #fff;
    background: var(--color-accent);
    border-color: var(--color-accent);

    &:hover:not(:disabled) {
      filter: brightness(1.05);
    }
  }
}

.collection-detail__head-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.15rem;
}

.collection-detail__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  margin: 0;
  font: inherit;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;

  &:hover {
    color: var(--color-accent);
    background: rgba(37, 99, 235, 0.06);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
}

.collection-detail__menu {
  position: relative;
}

.collection-detail__menu-list {
  position: absolute;
  right: 0;
  top: calc(100% - 4px);
  z-index: 20;
  min-width: 11rem;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.collection-detail__menu-item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.55rem 0.85rem;
  font-size: 0.9375rem;
  text-align: left;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    background: rgba(37, 99, 235, 0.06);
  }

  &--danger {
    color: #dc2626;

    &:hover {
      background: rgba(220, 38, 38, 0.08);
    }
  }
}

/* 與 nearby 縮圖網格一致：3 欄、方格、圓角、間距 */
.collection-detail__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.collection-detail__cell {
  margin: 0;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.06);
}

.collection-detail__cell-inner {
  position: relative;
  width: 100%;
  height: 100%;
}

.collection-detail__link {
  display: block;
  width: 100%;
  height: 100%;
  text-decoration: none;
  color: inherit;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 8px;
  }
}

.collection-detail__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.collection-detail__remove-photo {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  font: inherit;
  color: #fff;
  background: rgba(15, 23, 42, 0.55);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(220, 38, 38, 0.9);
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
}
</style>
