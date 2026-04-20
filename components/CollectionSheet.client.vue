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

          <div class="coll-sheet__body">
            <p v-if="loadError" class="coll-sheet__error" role="alert">
              {{ loadError }}
            </p>
            <p v-else-if="loading" class="coll-sheet__state">
              載入中…
            </p>

            <template v-else-if="!collections.length">
              <h2 id="coll-sheet-title" class="coll-sheet__title">
                建立你的第一個收藏夾
              </h2>
              <label class="coll-sheet__label" for="coll-sheet-first-name">
                收藏夾名稱
              </label>
              <input
                id="coll-sheet-first-name"
                v-model="firstName"
                type="text"
                class="coll-sheet__input"
                maxlength="120"
                placeholder="例如：想去的景點"
                autocomplete="off"
                @keydown.enter.prevent="onConfirmFirst"
              >
            </template>

            <template v-else>
              <h2 id="coll-sheet-title" class="coll-sheet__title">
                加入收藏
              </h2>
              <ul class="coll-sheet__list" role="list">
                <li
                  v-for="c in collections"
                  :key="c.id"
                  class="coll-sheet__row"
                >
                  <label class="coll-sheet__check-label">
                    <input
                      v-model="selectedIds"
                      type="checkbox"
                      class="coll-sheet__checkbox"
                      :value="c.id"
                    >
                    <span class="coll-sheet__check-text">{{ c.name }}</span>
                  </label>
                </li>
              </ul>

              <div v-if="showAddForm" class="coll-sheet__add-form">
                <label class="coll-sheet__label" for="coll-sheet-new-name">
                  新收藏夾名稱
                </label>
                <input
                  id="coll-sheet-new-name"
                  v-model="newCollectionName"
                  type="text"
                  class="coll-sheet__input"
                  maxlength="120"
                  placeholder="輸入名稱"
                  autocomplete="off"
                  @keydown.enter.prevent="onConfirm"
                >
              </div>

              <button
                type="button"
                class="coll-sheet__text-btn"
                @click="showAddForm = !showAddForm"
              >
                {{ showAddForm ? "收合新增收藏夾" : "新增收藏夾" }}
              </button>
            </template>
          </div>

          <div class="coll-sheet__footer">
            <button
              type="button"
              class="coll-sheet__btn coll-sheet__btn--ghost"
              :disabled="submitting"
              @click="requestClose"
            >
              取消
            </button>
            <button
              type="button"
              class="coll-sheet__btn coll-sheet__btn--primary"
              :disabled="confirmDisabled"
              @click="collections.length ? onConfirm() : onConfirmFirst()"
            >
              {{ submitting ? "處理中…" : "確認" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
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
const firstName = ref("")
const newCollectionName = ref("")
const showAddForm = ref(false)
const submitting = ref(false)

const dragY = ref(0)
let dragStartClientY = 0
let dragging = false

const panelStyle = computed(() => {
  if (dragY.value <= 0) return {}
  return { transform: `translateY(${dragY.value}px)` }
})

const confirmDisabled = computed(() => {
  if (submitting.value) return true
  if (!collections.value.length) {
    return !firstName.value.trim()
  }
  return false
})

function syncSelectedFromMember() {
  selectedIds.value = [...memberCollectionIds.value]
}

async function loadSheet() {
  loading.value = true
  loadError.value = ""
  firstName.value = ""
  newCollectionName.value = ""
  showAddForm.value = false

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

async function onConfirmFirst() {
  const name = firstName.value.trim()
  if (!name || submitting.value) return

  submitting.value = true
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
      .select("id")
      .single()

    if (cErr) throw cErr
    const collectionId = col?.id as string | undefined
    if (!collectionId) throw new Error("建立收藏夾失敗")

    const { error: iErr } = await supabase.from("collection_items").insert({
      collection_id: collectionId,
      photo_id: props.photoId,
    })
    if (iErr) throw iErr

    emit("saved", { photoId: props.photoId, isBookmarked: true })
    requestClose()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "儲存失敗"
    loadError.value = msg
  } finally {
    submitting.value = false
  }
}

async function onConfirm() {
  if (!collections.value.length) {
    await onConfirmFirst()
    return
  }

  const name = newCollectionName.value.trim()
  if (showAddForm.value && name) {
    submitting.value = true
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
      selectedIds.value = [...selectedIds.value, row.id]
      newCollectionName.value = ""
      showAddForm.value = false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "建立收藏夾失敗"
      loadError.value = msg
      submitting.value = false
      return
    }
    submitting.value = false
  }

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
  max-height: min(78vh, 560px);
  display: flex;
  flex-direction: column;
  border-radius: 1rem 1rem 0 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-bottom: none;
  box-shadow: 0 -8px 32px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.coll-sheet__drag {
  flex-shrink: 0;
  padding: 0.5rem 0 0.25rem;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
}

.coll-sheet__handle {
  display: block;
  width: 2.25rem;
  height: 4px;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--color-border-strong);
}

.coll-sheet__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 1.1rem 0.75rem;
}

.coll-sheet__title {
  margin: 0 0 0.75rem;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-text);
}

.coll-sheet__state {
  margin: 0;
  padding: 0.5rem 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

.coll-sheet__error {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.coll-sheet__label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.coll-sheet__input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.6rem 0.75rem;
  font: inherit;
  font-size: 1rem;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 0;
  }
}

.coll-sheet__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.coll-sheet__row {
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);

  &:last-child {
    border-bottom: none;
  }
}

.coll-sheet__check-label {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0;
  cursor: pointer;
  font-size: 0.9375rem;
  color: var(--color-text);
}

.coll-sheet__checkbox {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--color-accent);
}

.coll-sheet__check-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coll-sheet__add-form {
  margin-top: 0.5rem;
}

.coll-sheet__text-btn {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.5rem 0;
  font: inherit;
  font-size: 0.875rem;
  color: var(--color-accent);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
}

.coll-sheet__footer {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.65rem 1.1rem calc(0.85rem + env(safe-area-inset-bottom, 0));
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.coll-sheet__btn {
  min-height: 44px;
  padding: 0 1rem;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--ghost {
    color: var(--color-text-muted);
    background: transparent;

    &:hover:not(:disabled) {
      background: rgba(15, 23, 42, 0.05);
    }
  }

  &--primary {
    color: var(--color-surface);
    background: var(--color-accent);

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
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
