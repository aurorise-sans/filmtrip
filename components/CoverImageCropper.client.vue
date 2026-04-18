<template>
  <Teleport to="body">
    <div
      class="cover-image-cropper"
      role="dialog"
      aria-modal="true"
      aria-label="裁切封面照片"
    >
      <div class="cover-image-cropper__backdrop" aria-hidden="true" />
      <div class="cover-image-cropper__panel">
        <div class="cover-image-cropper__stage">
          <Cropper
            ref="cropperRef"
            class="cover-image-cropper__cropper"
            :src="imageUrl"
            :stencil-props="stencilProps"
            :default-size="defaultCropSize"
          />
        </div>
        <div class="cover-image-cropper__footer">
          <button
            type="button"
            class="cover-image-cropper__btn cover-image-cropper__btn--ghost"
            @click="onCancel"
          >
            取消
          </button>
          <button
            type="button"
            class="cover-image-cropper__btn cover-image-cropper__btn--primary"
            @click="onConfirm"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Cropper } from "vue-advanced-cropper"
import "vue-advanced-cropper/dist/style.css"

const props = withDefaults(
  defineProps<{
    imageUrl: string
    /** 寬:高，例如 16/9 封面、1 正方形頭像 */
    aspectRatio?: number
  }>(),
  { aspectRatio: 16 / 9 },
)

const emit = defineEmits<{
  confirm: [blob: Blob]
  cancel: []
}>()

const stencilProps = computed(() => ({ aspectRatio: props.aspectRatio }))

/** 依比例盡量撐滿可見影像區域 */
function defaultCropSize({
  imageSize,
}: {
  imageSize: { width: number; height: number }
}) {
  const ar = props.aspectRatio
  const iw = imageSize.width
  const ih = imageSize.height
  if (iw <= 0 || ih <= 0) {
    return { width: iw, height: ih }
  }
  let width = iw
  let height = width / ar
  if (height > ih) {
    height = ih
    width = height * ar
  }
  return { width, height }
}

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function onCancel() {
  emit("cancel")
}

function onConfirm() {
  const cropper = cropperRef.value
  if (!cropper) return
  const result = cropper.getResult()
  const canvas = result.canvas
  if (!canvas) return
  canvas.toBlob(
    (blob) => {
      if (blob) emit("confirm", blob)
    },
    "image/jpeg",
    0.92,
  )
}
</script>

<style scoped lang="scss">
.cover-image-cropper {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.cover-image-cropper__backdrop {
  position: absolute;
  inset: 0;
  background: #fff;
}

.cover-image-cropper__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-height: 0;
}

.cover-image-cropper__stage {
  flex: 1;
  min-height: 0;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-image-cropper__cropper {
  width: 100%;
  height: 100%;
  max-height: min(70vh, calc(100dvh - 120px));
}

.cover-image-cropper__footer {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0));
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.cover-image-cropper__btn {
  min-width: 96px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.cover-image-cropper__btn--ghost {
  background: transparent;
  color: rgba(20, 20, 22, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.cover-image-cropper__btn--primary {
  background: var(--color-accent);
  color: #fff;
}

.cover-image-cropper__btn--primary:hover {
  background: var(--color-accent-hover);
}
</style>
