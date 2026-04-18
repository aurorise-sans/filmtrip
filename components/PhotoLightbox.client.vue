<template>
  <Teleport to="body">
    <div
      class="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="照片檢視"
    >
      <button
        type="button"
        class="photo-lightbox__close"
        aria-label="關閉"
        @click="emitClose"
      >
        ✕
      </button>

      <button
        type="button"
        class="photo-lightbox__nav photo-lightbox__nav--prev"
        :disabled="currentIndex <= 0"
        aria-label="上一張"
        @click="prev"
      >
        ‹
      </button>
      <button
        type="button"
        class="photo-lightbox__nav photo-lightbox__nav--next"
        :disabled="currentIndex >= photos.length - 1"
        aria-label="下一張"
        @click="next"
      >
        ›
      </button>

      <div
        class="photo-lightbox__stage"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <img
          v-if="currentSrc"
          class="photo-lightbox__img"
          :src="currentSrc"
          alt=""
          decoding="async"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  photos: string[]
  initialIndex: number
}>()

const emit = defineEmits<{
  close: []
}>()

const currentIndex = ref(0)

function clampIndex(i: number) {
  const n = props.photos.length
  if (n <= 0) return 0
  return Math.max(0, Math.min(i, n - 1))
}

watch(
  () => [props.initialIndex, props.photos] as const,
  () => {
    currentIndex.value = clampIndex(props.initialIndex)
  },
  { immediate: true, deep: true },
)

const currentSrc = computed(() => props.photos[currentIndex.value] ?? "")

function prev() {
  if (currentIndex.value > 0) currentIndex.value -= 1
}

function next() {
  if (currentIndex.value < props.photos.length - 1) currentIndex.value += 1
}

function emitClose() {
  emit("close")
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault()
    emitClose()
    return
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault()
    prev()
    return
  }
  if (e.key === "ArrowRight") {
    e.preventDefault()
    next()
  }
}

let touchStartX = 0

function onTouchStart(e: TouchEvent) {
  if (e.changedTouches.length) touchStartX = e.changedTouches[0].clientX
}

function onTouchEnd(e: TouchEvent) {
  if (!e.changedTouches.length) return
  const dx = e.changedTouches[0].clientX - touchStartX
  const threshold = 48
  if (dx > threshold) prev()
  else if (dx < -threshold) next()
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
  document.body.style.overflow = "hidden"
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown)
  document.body.style.overflow = ""
})
</script>

<style scoped lang="scss">
.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #fff;
}

.photo-lightbox__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: #111;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(17, 17, 17, 0.14);
  }
}

.photo-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: #111;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(17, 17, 17, 0.14);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &--prev {
    left: 0.5rem;
  }

  &--next {
    right: 0.5rem;
  }

  @media (min-width: 640px) {
    &--prev {
      left: 1rem;
    }

    &--next {
      right: 1rem;
    }
  }
}

.photo-lightbox__stage {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-lightbox__img {
  display: block;
  width: 90vw;
  height: auto;
  max-height: 90vh;
  object-fit: contain;
  vertical-align: middle;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
