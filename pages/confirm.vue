<template>
  <div class="confirm">
    <p class="confirm__text">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import type { JwtPayload } from "@supabase/supabase-js"

const userClaims = useSupabaseUser()
const message = ref("正在完成登入…")

watch(
  userClaims,
  (claims) => {
    if ((claims as JwtPayload | null)?.sub) {
      message.value = "登入成功，導向首頁…"
      navigateTo("/")
    }
  },
  { immediate: true },
)

onMounted(() => {
  const t = window.setTimeout(() => {
    if (!(userClaims.value as JwtPayload | null)?.sub) {
      message.value = "無法取得登入狀態，請回到登入頁再試一次。"
    }
  }, 8000)
  onUnmounted(() => window.clearTimeout(t))
})
</script>

<style lang="scss" scoped>
.confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 4rem);
  padding: 2rem;

  &__text {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 1rem;
  }
}
</style>
