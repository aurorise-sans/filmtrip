<template>
  <div class="layout-default">
    <header class="layout-default__header">
      <div
        class="layout-default__header-start"
        :aria-hidden="showLayoutHeaderBack ? undefined : true"
      >
        <button
          v-if="showLayoutHeaderBack"
          type="button"
          class="layout-default__header-back"
          aria-label="返回"
          @click="onLayoutHeaderBack"
        >
          <ChevronLeft :size="22" aria-hidden="true" />
        </button>
      </div>
      <NuxtLink class="layout-default__brand" to="/">Filmtrip</NuxtLink>
      <div class="layout-default__header-end">
        <NuxtLink
          v-if="!user"
          class="layout-default__header-login"
          to="/login"
        >
          登入
        </NuxtLink>
        <button
          v-else-if="isProfilePage"
          type="button"
          class="layout-default__header-settings"
          aria-label="設定"
          aria-haspopup="dialog"
          :aria-expanded="profileSettingsOpen"
          aria-controls="profile-settings-dialog"
          @click="profileSettingsOpen = true"
        >
          <Settings :size="22" aria-hidden="true" />
        </button>
      </div>
    </header>
    <main
      class="layout-default__main"
      :class="{ 'layout-default__main--with-appbar': user }"
    >
      <slot />
    </main>
    <nav
      v-if="user"
      class="layout-default__appbar"
      aria-label="主要操作"
    >
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': homeActive }"
        to="/"
        @click.capture="onHomeNavClick"
      >
        <Home :size="24" aria-hidden="true" />
        <span class="layout-default__appbar-sr">首頁</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': mapActive }"
        to="/map"
      >
        <Map :size="24" aria-hidden="true" />
        <span class="layout-default__appbar-sr">地圖</span>
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
        class="layout-default__appbar-btn layout-default__appbar-btn--profile"
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
import { ChevronLeft, Home, Map, Plus, Settings, User } from "lucide-vue-next"

const route = useRoute()
const router = useRouter()
const user = useSupabaseUser()

/** `null`：依路由自動（例如 `/profile/:id` 顯示返回）；`true`/`false` 強制覆寫 */
const layoutHeaderBackOverride = useState<boolean | null>(
  "layout-header-back-override",
  () => null,
)

watch(
  () => route.fullPath,
  () => {
    layoutHeaderBackOverride.value = null
  },
)

const showLayoutHeaderBack = computed(() => {
  const o = layoutHeaderBackOverride.value
  if (o === true) return true
  if (o === false) return false
  const parts = route.path.split("/").filter(Boolean)
  if (parts.length === 2 && parts[0] === "profile") return true
  if (parts.length === 2 && parts[0] === "trips") return true
  if (parts.length === 2 && parts[0] === "nearby") return true
  if (parts.length === 2 && parts[0] === "photos") return true
  return false
})

function onLayoutHeaderBack() {
  router.back()
}

const profileSettingsOpen = useState("profile-settings-open", () => false)
const isProfilePage = computed(() => route.path === "/profile")

const { navAvatarDisplayUrl, loadProfileAvatarFromDb } = useNavProfileAvatar()

const feedHomeReshuffleTick = useState("feed-home-reshuffle-tick", () => 0)

function onHomeNavClick(e: MouseEvent) {
  if (route.path !== "/") {
    return
  }
  e.preventDefault()
  feedHomeReshuffleTick.value += 1
}

const homeActive = computed(() => route.path === "/")
const mapActive = computed(() => route.path === "/map")
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
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: calc(52px + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) 1.25rem 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #fff;
    box-sizing: border-box;
  }

  &__header-start {
    justify-self: start;
    min-width: 0;
  }

  &__header-back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-left: -0.35rem;
    padding: 0;
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;

    &:hover {
      color: var(--color-accent);
      background: rgba(37, 99, 235, 0.06);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__header-end {
    justify-self: end;
    min-width: 0;
  }

  &__header-login {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
    margin-right: -0.25rem;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-accent);
    text-decoration: none;
    border-radius: 0.375rem;

    &:hover {
      opacity: 0.85;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__header-settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    margin-right: -0.25rem;
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;

    &:hover {
      opacity: 0.85;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__brand {
    font-weight: 600;
    font-size: 1.125rem;
    line-height: 1;
    color: inherit;
    text-decoration: none;
    letter-spacing: -0.02em;

    &:hover {
      opacity: 0.85;
    }
  }

  &__main {
    flex: 1;
    /* 與 Header 同高：52px 列 + 頂部 safe-area */
    padding-top: calc(52px + env(safe-area-inset-top, 0px));
    box-sizing: border-box;
  }

  &__main--with-appbar {
    /* Navbar：上內距 + 按鈕列 + 下內距（含底部安全區） */
    padding-bottom: calc(
      0.5rem + 44px + 0.5rem + env(safe-area-inset-bottom, 0px)
    );
  }

  &__appbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 0.5rem 0.35rem calc(0.5rem + env(safe-area-inset-bottom, 0px));
    background: #fff;
    border-radius: 0;
    border-top: 1px solid var(--color-border);
    box-sizing: border-box;
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

    &--profile {
      min-width: 0;
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
