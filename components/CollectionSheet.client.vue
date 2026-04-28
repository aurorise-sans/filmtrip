<template>
  <Teleport to="body">
    <Transition name="coll-sheet" @after-leave="onAfterLeave">
      <div
        v-if="open"
        class="coll-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coll-sheet-title"
      >
        <div
          class="coll-sheet__backdrop"
          aria-hidden="true"
          @click="requestClose"
        />
        <div
          class="coll-sheet__panel"
          :style="panelStyle"
          @click.stop
        >
          <div
            class="coll-sheet__drag"
            @pointerdown="onDragStart"
          >
            <span class="coll-sheet__handle" />
          </div>

          <div class="coll-sheet__content">
            <div class="coll-sheet__header">
              <h2
                id="coll-sheet-title"
                class="coll-sheet__heading text-body-large-medium"
              >
                收藏分類
              </h2>
              <button
                v-if="collections.length"
                type="button"
                class="coll-sheet__add-toggle text-body-medium-bold"
                @click="toggleAddForm"
              >
                {{ showAddForm ? "取消新增" : "新增收藏分類" }}
              </button>
            </div>

            <p v-if="loadError" class="coll-sheet__error" role="alert">
              {{ loadError }}
            </p>
            <p v-else-if="loading" class="coll-sheet__state">
              載入中…
            </p>

            <template v-else>
              <div
                v-if="showAddForm || !collections.length"
                class="coll-sheet__add-row"
              >
                <div class="coll-sheet__add-left">
                  <span
                    class="coll-sheet__check coll-sheet__check--filled"
                    aria-hidden="true"
                  >
                    <Check :size="20" :stroke-width="2.4" />
                  </span>
                  <input
                    v-model="newCollectionName"
                    type="text"
                    class="coll-sheet__input text-body-small"
                    maxlength="120"
                    placeholder="輸入你的收藏分名稱"
                    autocomplete="off"
                    :disabled="creating"
                    @keydown.enter.prevent="onCreate"
                  >
                </div>
                <button
                  type="button"
                  class="coll-sheet__create-btn text-body-medium-bold"
                  :disabled="!newCollectionName.trim() || creating"
                  @click="onCreate"
                >
                  {{ creating ? "建立中…" : "建立" }}
                </button>
              </div>

              <ul
                v-if="collections.length"
                class="coll-sheet__list"
                role="list"
              >
                <li
                  v-for="c in collections"
                  :key="c.id"
                  class="coll-sheet__row"
                >
                  <label class="coll-sheet__row-label">
                    <input
                      v-model="selectedIds"
                      type="checkbox"
                      class="coll-sheet__check-native"
                      :value="c.id"
                    >
                    <span
                      class="coll-sheet__check"
                      :class="{
                        'coll-sheet__check--filled': selectedIds.includes(c.id),
                      }"
                      aria-hidden="true"
                    >
                      <Check
                        v-if="selectedIds.includes(c.id)"
                        :size="20"
                        :stroke-width="2.4"
                      />
                    </span>
                    <span class="coll-sheet__cover">
                      <img
                        v-if="coversByCollection[c.id]"
                        :src="coversByCollection[c.id]!"
                        alt=""
                        loading="lazy"
                      >
                    </span>
                    <span class="coll-sheet__row-name text-display-xs-bold">
                      {{ c.name }}
                    </span>
                  </label>
                </li>
              </ul>
            </template>

            <div class="coll-sheet__buttons">
              <button
                type="button"
                class="coll-sheet__btn coll-sheet__btn--ghost text-body-large-bold"
                :disabled="submitting || creating"
                @click="requestClose"
              >
                取消
              </button>
              <button
                type="button"
                class="coll-sheet__btn coll-sheet__btn--primary text-body-large-bold"
                :disabled="confirmDisabled"
                @click="onConfirm"
              >
                {{ submitting ? "處理中…" : "加入收藏" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Check } from "lucide-vue-next"

const props = defineProps<{
  photoId: string
  open: boolean
  /** Feed 已載入的收藏夾列表；有傳入時不重複查詢 collections */
  feedCollections?: { id: string; name: string; created_at: string }[]
}>()

const emit = defineEmits<{
  close: []
  closed: []
  saved: [payload: { photoId: string; isBookmarked: boolean }]
}>()

const supabase = useSupabaseClient()

type CollectionRow = {
  id: string
  name: string
  created_at: string
}

const loading = ref(true)
const loadError = ref("")
const collections = ref<CollectionRow[]>([])
/** 開啟 sheet 時，該照片已所在的收藏夾 id */
const memberCollectionIds = ref<Set<string>>(new Set())
const selectedIds = ref<string[]>([])
const newCollectionName = ref("")
const showAddForm = ref(false)
const submitting = ref(false)
const creating = ref(false)
/** 每個收藏夾的封面照片 URL（最早加入的那張）；無照片時為 null */
const coversByCollection = ref<Record<string, string | null>>({})

const dragY = ref(0)
let dragStartClientY = 0
let dragging = false

const panelStyle = computed(() => {
  if (dragY.value <= 0) return {}
  return { transform: `translateY(${dragY.value}px)` }
})

const confirmDisabled = computed(() => {
  if (submitting.value || creating.value) return true
  if (!collections.value.length) return true
  return false
})

function syncSelectedFromMember() {
  selectedIds.value = [...memberCollectionIds.value]
}

function toggleAddForm() {
  showAddForm.value = !showAddForm.value
  if (!showAddForm.value) {
    newCollectionName.value = ""
  }
}

async function loadCovers(collectionIds: string[]) {
  if (!collectionIds.length) {
    coversByCollection.value = {}
    return
  }

  const { data: coverRows, error: coverErr } = await supabase
    .from("collection_items")
    .select("collection_id, created_at, photos!inner(image_url)")
    .in("collection_id", collectionIds)
    .order("created_at", { ascending: true })

  if (coverErr) {
    console.warn("[CollectionSheet] covers 查詢失敗", coverErr)
    coversByCollection.value = Object.fromEntries(
      collectionIds.map((id) => [id, null]),
    )
    return
  }

  const map: Record<string, string | null> = Object.fromEntries(
    collectionIds.map((id) => [id, null]),
  )

  for (const r of coverRows ?? []) {
    const row = r as {
      collection_id: string
      photos: { image_url: string } | { image_url: string }[] | null
    }
    const cid = row.collection_id
    if (!cid || map[cid] !== null) continue

    let url: string | null = null
    if (Array.isArray(row.photos)) {
      url = row.photos[0]?.image_url ?? null
    } else if (row.photos) {
      url = row.photos.image_url ?? null
    }
    if (url) map[cid] = url
  }

  coversByCollection.value = map
}

async function loadSheet() {
  loading.value = true
  loadError.value = ""
  newCollectionName.value = ""
  showAddForm.value = false
  coversByCollection.value = {}

  try {
    const useFeedList =
      props.feedCollections !== undefined && props.feedCollections !== null

    if (useFeedList) {
      collections.value = props.feedCollections!.map((c) => ({ ...c }))
      console.log("[CollectionSheet] 使用 Feed 傳入的收藏夾列表", {
        count: collections.value.length,
        rows: collections.value,
      })
    } else {
      const { data: rows, error: listErr } = await supabase
        .from("collections")
        .select("id, name, created_at")
        .order("created_at", { ascending: true })

      console.log("[CollectionSheet] collections 查詢", {
        data: rows,
        error: listErr,
        message: listErr?.message,
      })

      if (listErr) {
        loadError.value = listErr.message
        return
      }

      collections.value = (rows ?? []) as CollectionRow[]
    }

    await loadCovers(collections.value.map((c) => c.id))

    const { data: itemRows, error: itemErr } = await supabase
      .from("collection_items")
      .select("collection_id")
      .eq("photo_id", props.photoId)

    console.log("[CollectionSheet] collection_items 查詢", {
      photoId: props.photoId,
      data: itemRows,
      error: itemErr,
      message: itemErr?.message,
    })

    if (itemErr) {
      loadError.value = itemErr.message
      return
    }

    const next = new Set<string>()
    for (const r of itemRows ?? []) {
      const cid = (r as { collection_id: string }).collection_id
      if (cid) next.add(cid)
    }
    memberCollectionIds.value = next
    syncSelectedFromMember()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    loadError.value = msg
    console.error("[CollectionSheet] loadSheet 例外", e)
  } finally {
    loading.value = false
    console.log("[CollectionSheet] loadSheet 結束", {
      loading: loading.value,
      loadError: loadError.value,
      collectionsCount: collections.value.length,
    })
  }
}

watch(
  () => [props.open, props.photoId] as const,
  ([isOpen]) => {
    if (isOpen) void loadSheet()
  },
  { immediate: true },
)

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === "Escape") {
    e.preventDefault()
    requestClose()
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener("keydown", onKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener("keydown", onKeydown)
    document.body.style.overflow = ""
  }
})

watch(
  () => props.open,
  (v) => {
    if (!import.meta.client) return
    document.body.style.overflow = v ? "hidden" : ""
  },
  { immediate: true },
)

function requestClose() {
  dragY.value = 0
  emit("close")
}

function onAfterLeave() {
  emit("closed")
}

function onDragStart(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return
  dragging = true
  dragStartClientY = e.clientY
  dragY.value = 0
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return
    const dy = ev.clientY - dragStartClientY
    dragY.value = Math.max(0, dy)
  }

  const onUp = (ev: PointerEvent) => {
    dragging = false
    target.releasePointerCapture(ev.pointerId)
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    if (dragY.value > 72) {
      requestClose()
    }
    dragY.value = 0
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
}

async function onCreate() {
  const name = newCollectionName.value.trim()
  if (!name || creating.value) return

  creating.value = true
  loadError.value = ""
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      loadError.value = "請先登入"
      return
    }

    const { data: col, error: cErr } = await supabase
      .from("collections")
      .insert({ user_id: user.id, name })
      .select("id, name, created_at")
      .single()

    if (cErr) throw cErr
    const row = col as CollectionRow
    collections.value = [...collections.value, row].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )
    coversByCollection.value = {
      ...coversByCollection.value,
      [row.id]: null,
    }
    selectedIds.value = [...selectedIds.value, row.id]
    newCollectionName.value = ""
    showAddForm.value = false
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "建立收藏夾失敗"
    loadError.value = msg
  } finally {
    creating.value = false
  }
}

async function onConfirm() {
  if (submitting.value || creating.value) return
  if (!collections.value.length) return

  submitting.value = true
  loadError.value = ""

  try {
    const target = new Set(selectedIds.value)
    const prev = memberCollectionIds.value

    const toAdd = [...target].filter((id) => !prev.has(id))
    const toRemove = [...prev].filter((id) => !target.has(id))

    if (toAdd.length) {
      const { error: insErr } = await supabase.from("collection_items").insert(
        toAdd.map((collection_id) => ({
          collection_id,
          photo_id: props.photoId,
        })),
      )
      if (insErr) throw insErr
    }

    for (const collection_id of toRemove) {
      const { error: delErr } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collection_id)
        .eq("photo_id", props.photoId)
      if (delErr) throw delErr
    }

    memberCollectionIds.value = new Set(target)
    const isBookmarked = target.size > 0
    emit("saved", { photoId: props.photoId, isBookmarked })
    requestClose()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "儲存失敗"
    loadError.value = msg
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.coll-sheet {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

.coll-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  pointer-events: auto;
}

.coll-sheet__panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 32rem;
  margin: 0 auto;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  background: var(--color-white);
  pointer-events: auto;
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.coll-sheet__drag {
  flex-shrink: 0;
  padding: 8px 0 4px;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
}

.coll-sheet__handle {
  display: block;
  width: 36px;
  height: 4px;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--color-gray-200);
}

.coll-sheet__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 12px 16px calc(20px + env(safe-area-inset-bottom, 0));
}

.coll-sheet__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.coll-sheet__heading {
  margin: 0;
  color: var(--color-gray-500);
}

.coll-sheet__add-toggle {
  padding: 0;
  background: none;
  border: none;
  color: var(--color-gray-900);
  cursor: pointer;

  &:hover {
    opacity: 0.7;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    border-radius: 4px;
    box-shadow: 0 0 0 2px var(--color-gray-900);
  }
}

.coll-sheet__state,
.coll-sheet__error {
  flex-shrink: 0;
  margin: 0;
  padding: 4px 16px;
}

.coll-sheet__state {
  color: var(--color-gray-500);
}

.coll-sheet__error {
  color: var(--color-red-500);
}

.coll-sheet__add-row {
  flex-shrink: 0;
  display: flex;
  gap: 20px;
  align-items: center;
}

.coll-sheet__add-left {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 12px;
  align-items: center;
}

.coll-sheet__input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 12px;
  background: var(--color-white);
  color: var(--color-gray-900);
  border: 1px solid var(--color-gray-900);
  border-radius: 8px;

  &::placeholder {
    color: var(--color-gray-200);
  }

  &:focus {
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.coll-sheet__create-btn {
  flex-shrink: 0;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-gray-900);
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    opacity: 0.7;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    border-radius: 4px;
    box-shadow: 0 0 0 2px var(--color-gray-900);
  }
}

.coll-sheet__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.coll-sheet__row-label {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  cursor: pointer;
}

.coll-sheet__check-native {
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

.coll-sheet__check {
  box-sizing: border-box;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-white);
  color: var(--color-white);
  border: 1px solid var(--color-gray-100);
  border-radius: 8px;

  &--filled {
    background: var(--color-gray-900);
    border-color: var(--color-gray-900);
    padding: 2px;
  }
}

.coll-sheet__check-native:focus {
  outline: none;
}

.coll-sheet__check-native:focus-visible + .coll-sheet__check {
  box-shadow: 0 0 0 2px var(--color-gray-900);
}

.coll-sheet__cover {
  flex-shrink: 0;
  display: block;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: var(--color-gray-100);
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.coll-sheet__row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-gray-900);
}

.coll-sheet__buttons {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.coll-sheet__btn {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--color-gray-900);
  }

  &--ghost {
    background: var(--color-white);
    border: 1px solid var(--color-gray-900);
    color: var(--color-gray-900);

    &:hover:not(:disabled) {
      background: var(--color-gray-100);
    }
  }

  &--primary {
    background: var(--color-gray-900);
    border: 1px solid var(--color-gray-900);
    color: var(--color-white);

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:focus-visible {
      box-shadow:
        0 0 0 2px var(--color-white),
        0 0 0 4px var(--color-gray-900);
    }
  }
}

.coll-sheet-enter-active,
.coll-sheet-leave-active {
  transition: opacity 0.24s ease;
}

.coll-sheet-enter-active .coll-sheet__panel,
.coll-sheet-leave-active .coll-sheet__panel {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.coll-sheet-enter-from,
.coll-sheet-leave-to {
  opacity: 0;
}

.coll-sheet-enter-from .coll-sheet__panel,
.coll-sheet-leave-to .coll-sheet__panel {
  transform: translateY(100%);
}
</style>
