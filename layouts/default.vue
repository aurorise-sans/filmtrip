<template>
  <div class="layout-default">
    <header class="layout-default__header">
      <NuxtLink class="layout-default__brand" to="/">Filmtrip</NuxtLink>
      <nav class="layout-default__nav" aria-label="帳號">
        <template v-if="session">
          <span class="layout-default__email" title="已登入帳號">{{
            session.user?.email
          }}</span>
          <button
            type="button"
            class="layout-default__btn"
            @click="signOut"
          >
            登出
          </button>
        </template>
        <NuxtLink v-else class="layout-default__link" to="/login">
          登入
        </NuxtLink>
      </nav>
    </header>
    <main class="layout-default__main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const session = useSupabaseSession()
const supabase = useSupabaseClient()

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo("/")
}
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

  &__nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9375rem;
  }

  &__email {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted, #5c5c5c);
  }

  &__link {
    color: #2563eb;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__btn {
    cursor: pointer;
    padding: 0.35rem 0.75rem;
    font: inherit;
    font-size: 0.875rem;
    color: #374151;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;

    &:hover {
      background: #e5e7eb;
    }
  }

  &__main {
    flex: 1;
  }
}
</style>
