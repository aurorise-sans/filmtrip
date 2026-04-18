<template>
  <div class="layout-default">
    <header class="layout-default__header">
      <NuxtLink class="layout-default__brand" to="/">Filmtrip</NuxtLink>
    </header>
    <main class="layout-default__main">
      <slot />
    </main>
    <nav
      class="layout-default__appbar"
      aria-label="主要操作"
    >
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': homeActive }"
        to="/"
      >
        <Home :size="24" aria-hidden="true" />
        <span class="layout-default__appbar-sr">首頁</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': plusActive }"
        to="/trips/new"
      >
        <Plus :size="24" aria-hidden="true" />
        <span class="layout-default__appbar-sr">建立旅程</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': profileActive }"
        to="/profile"
      >
        <img
          v-if="navAvatarDisplayUrl"
          class="layout-default__appbar-avatar"
          :src="navAvatarDisplayUrl"
          alt=""
          width="32"
          height="32"
        />
        <User v-else :size="24" aria-hidden="true" />
        <span class="layout-default__appbar-sr">個人</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { Home, Plus, User } from "lucide-vue-next"

const route = useRoute()
const user = useSupabaseUser()

const { navAvatarDisplayUrl, loadProfileAvatarFromDb } = useNavProfileAvatar()

const homeActive = computed(() => route.path === "/")
const plusActive = computed(() => route.path === "/trips/new")
const profileActive = computed(() => route.path.startsWith("/profile"))

onMounted(() => {
  void loadProfileAvatarFromDb()
})

watch(
  () => user.value?.id,
  (id, prev) => {
    if (id === prev) {
      return
    }
    void loadProfileAvatarFromDb()
  },
)
</script>

<style lang="scss" scoped>
.layout-default {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #fff;
  }

  &__brand {
    font-weight: 600;
    font-size: 1.125rem;
    color: inherit;
    text-decoration: none;
    letter-spacing: -0.02em;

    &:hover {
      opacity: 0.85;
    }
  }

  &__main {
    flex: 1;
    padding-bottom: 80px;
  }

  &__appbar {
    position: fixed;
    bottom: 8px;
    left: 8px;
    right: 8px;
    z-index: 50;
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 0.5rem 0.35rem;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  }

  &__appbar-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
    color: var(--color-text-muted);
    text-decoration: none;
    border-radius: 12px;
    transition: color 0.15s ease;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    &--active {
      color: var(--color-accent);
    }
  }

  &__appbar-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  &__appbar-sr {
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
}
</style>
