<template>
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">登入 Filmtrip</h1>
      <p class="login__lead">使用 Google 帳號繼續。</p>
      <button
        type="button"
        class="login__google"
        :disabled="loading"
        @click="signInWithGoogle"
      >
        <span v-if="loading">導向 Google…</span>
        <span v-else>以 Google 登入</span>
      </button>
      <p v-if="errorMessage" class="login__error" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const loading = ref(false)
const errorMessage = ref("")

const session = useSupabaseSession()

watchEffect(() => {
  if (session.value) {
    navigateTo("/")
  }
})

async function signInWithGoogle() {
  errorMessage.value = ""
  loading.value = true
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : useRequestURL().origin

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/confirm`,
    },
  })

  loading.value = false
  if (error) {
    errorMessage.value = error.message
  }
}
</script>

<style lang="scss" scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 4rem);
  padding: 2rem;

  &__card {
    width: 100%;
    max-width: 22rem;
    padding: 2rem;
    background: #fff;
    border-radius: 0.75rem;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.06),
      0 4px 24px rgba(0, 0, 0, 0.06);
  }

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  &__lead {
    margin: 0 0 1.5rem;
    color: var(--color-text-muted, #5c5c5c);
    font-size: 0.9375rem;
  }

  &__google {
    width: 100%;
    cursor: pointer;
    padding: 0.65rem 1rem;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1f2937;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    transition:
      background 0.15s,
      border-color 0.15s;

    &:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    &:disabled {
      opacity: 0.7;
      cursor: wait;
    }
  }

  &__error {
    margin: 1rem 0 0;
    font-size: 0.875rem;
    color: #b91c1c;
  }
}
</style>
