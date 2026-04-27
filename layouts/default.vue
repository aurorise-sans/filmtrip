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
        <Home :size="28" aria-hidden="true" />
        <span class="layout-default__appbar-sr">首頁</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': mapActive }"
        to="/map"
        @click.capture="onMapNavClick"
      >
        <Map :size="28" aria-hidden="true" />
        <span class="layout-default__appbar-sr">地圖</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn layout-default__appbar-btn--plus"
        to="/trips/new"
      >
        <span class="layout-default__appbar-plus">
          <Plus :size="28" aria-hidden="true" />
        </span>
        <span class="layout-default__appbar-sr">建立旅程</span>
      </NuxtLink>
      <NuxtLink
        class="layout-default__appbar-btn"
        :class="{ 'layout-default__appbar-btn--active': collectionsActive }"
        to="/collections"
      >
        <Bookmark :size="28" aria-hidden="true" />
        <span class="layout-default__appbar-sr">收藏</span>
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
          width="28"
          height="28"
        />
        <User v-else :size="28" aria-hidden="true" />
        <span class="layout-default__appbar-sr">個人</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import {
  Bookmark,
  ChevronLeft,
  Home,
  Map,
  Plus,
  Settings,
  User,
} from "lucide-vue-next"

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
  if (parts.length === 2 && parts[0] === "collections") return true
  return false
})

function onLayoutHeaderBack() {
  router.back()
}

const profileSettingsOpen = useState("profile-settings-open", () => false)
const isProfilePage = computed(() => route.path === "/profile")

const { navAvatarDisplayUrl, loadProfileAvatarFromDb } = useNavProfileAvatar()

const feedHomeReshuffleTick = useState("feed-home-reshuffle-tick", () => 0)

/** 已在 /map 時再點地圖：觸發重新定位（由 pages/map.vue watch） */
const mapNavRelocateTick = useState("map-nav-relocate-tick", () => 0)

function onHomeNavClick(e: MouseEvent) {
  if (route.path !== "/") {
    return
  }
  e.preventDefault()
  feedHomeReshuffleTick.value += 1
}

function onMapNavClick(e: MouseEvent) {
  if (route.path !== "/map") {
    return
  }
  e.preventDefault()
  mapNavRelocateTick.value += 1
}

const homeActive = computed(() => route.path === "/")
const mapActive = computed(() => route.path === "/map")
const plusActive = computed(() => route.path === "/trips/new")
const collectionsActive = computed(
  () =>
    route.path === "/collections" || route.path.startsWith("/collections/"),
)
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
    /* Navbar 高度 52px = 8(top) + 36(plus 按鈕) + 8(bottom)；含底部安全區 */
    padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px));
  }

  /**
   * Navbar：依 Figma 1:180 規格
   * - 高度 48px（不含底部 safe-area）
   * - padding 8px 32px
   * - justify-between 等距分布 5 個 child
   * - 桌面寬螢幕加 max-width 32rem 置中
   */
  &__appbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    box-sizing: border-box;
    width: 100%;
    max-width: 32rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 32px calc(8px + env(safe-area-inset-bottom, 0px));
    background: var(--color-white);
    border-top: 1px solid var(--color-gray-100);
  }

  /**
   * 一般按鈕（Home / Map / Bookmark / Profile）：嚴格 28×28 視覺尺寸。
   * 顏色：未選取 gray-500；選取 gray-900。
   */
  &__appbar-btn {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--color-gray-500);
    text-decoration: none;
    transition: color 0.15s ease;

    &:focus-visible {
      outline: 2px solid var(--color-gray-900);
      outline-offset: 2px;
      border-radius: 2px;
    }

    &--active {
      color: var(--color-gray-900);
    }

    &--profile {
      min-width: 0;
      overflow: hidden;
      border-radius: 50%;
    }
  }

  /**
   * Plus 按鈕：永遠黑底，不隨 active 切換樣式。
   * 36×36 黑底圓角 8px、padding 4px、內含 28×28 白色 Plus icon。
   */
  &__appbar-btn--plus {
    width: 36px;
    height: 36px;
  }

  &__appbar-plus {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 4px;
    background: var(--color-gray-900);
    color: var(--color-white);
    border-radius: 8px;
  }

  &__appbar-avatar {
    width: 28px;
    height: 28px;
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
