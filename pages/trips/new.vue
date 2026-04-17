<template>
  <div class="trip-new">
    <header class="trip-new__header">
      <h1 class="trip-new__title">建立旅程</h1>
      <p class="trip-new__subtitle">填寫基本資訊後即可開始記錄照片與地點。</p>
    </header>

    <form class="trip-new__form" @submit.prevent="onSubmit">
      <div class="trip-new__field">
        <label class="trip-new__label" for="trip-name">旅程名稱</label>
        <input
          id="trip-name"
          v-model="name"
          class="trip-new__input"
          type="text"
          name="name"
          autocomplete="off"
          maxlength="200"
          required
          placeholder="例如：京都五天四夜"
        />
      </div>

      <div class="trip-new__row">
        <div class="trip-new__field">
          <label class="trip-new__label" for="trip-start">開始日期</label>
          <input
            id="trip-start"
            v-model="startDate"
            class="trip-new__input"
            type="date"
            name="start_date"
            required
          />
        </div>
        <div class="trip-new__field">
          <label class="trip-new__label" for="trip-end">結束日期</label>
          <input
            id="trip-end"
            v-model="endDate"
            class="trip-new__input"
            type="date"
            name="end_date"
            required
          />
        </div>
      </div>

      <div class="trip-new__field trip-new__field--visibility">
        <span id="trip-visibility-label" class="trip-new__label">旅程可見性</span>
        <div
          class="trip-new__radios"
          role="radiogroup"
          aria-labelledby="trip-visibility-label"
        >
          <label class="trip-new__radio-label">
            <input
              v-model="isPublic"
              class="trip-new__radio"
              type="radio"
              name="is_public"
              :value="true"
            />
            <span>公開（顯示在公開地圖）</span>
          </label>
          <label class="trip-new__radio-label">
            <input
              v-model="isPublic"
              class="trip-new__radio"
              type="radio"
              name="is_public"
              :value="false"
            />
            <span>隱藏（只有自己看得到）</span>
          </label>
        </div>
      </div>

      <p v-if="errorMessage" class="trip-new__error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="trip-new__actions">
        <NuxtLink class="trip-new__cancel" to="/">取消</NuxtLink>
        <button
          class="trip-new__submit"
          type="submit"
          :disabled="submitting || !userId"
        >
          {{ submitting ? "建立中…" : "建立旅程" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { JwtPayload } from "@supabase/supabase-js"

const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()

const name = ref("")
const startDate = ref("")
const endDate = ref("")
/** 預設公開：顯示在公開地圖 */
const isPublic = ref(true)
const errorMessage = ref("")
const submitting = ref(false)

/** 目前登入使用者的 UUID（JWT `sub`） */
const userId = computed(() => {
  const claims = userClaims.value as JwtPayload | null
  return claims?.sub ?? null
})

async function onSubmit() {
  errorMessage.value = ""

  if (!userId.value) {
    errorMessage.value = "無法取得使用者資訊，請重新登入。"
    return
  }

  const trimmed = name.value.trim()
  if (!trimmed) {
    errorMessage.value = "請輸入旅程名稱。"
    return
  }

  if (!startDate.value || !endDate.value) {
    errorMessage.value = "請選擇開始與結束日期。"
    return
  }

  if (endDate.value < startDate.value) {
    errorMessage.value = "結束日期不可早於開始日期。"
    return
  }

  submitting.value = true

  const { error } = await supabase.from("trips").insert({
    user_id: userId.value,
    name: trimmed,
    start_date: startDate.value,
    end_date: endDate.value,
    is_public: isPublic.value,
  })

  submitting.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  await refreshNuxtData("profile-trips")
  await navigateTo("/profile")
}
</script>

<style lang="scss" scoped>
.trip-new {
  max-width: 28rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;

  &__header {
    margin-bottom: 1.75rem;
  }

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__form {
    padding: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
  }

  &__row {
    display: grid;
    gap: 1rem;
    margin-bottom: 1.25rem;

    @media (min-width: 480px) {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__radios {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  &__radio-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--color-text);
    cursor: pointer;

    span {
      flex: 1;
    }
  }

  &__radio {
    margin-top: 0.2rem;
    flex-shrink: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  &__input {
    width: 100%;
    padding: 0.5rem 0.65rem;
    font: inherit;
    font-size: 0.9375rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: 0.375rem;

    &:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
  }

  &__error {
    margin: 0 0 1rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  &__cancel {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-text);
      text-decoration: underline;
    }
  }

  &__submit {
    cursor: pointer;
    padding: 0.55rem 1.1rem;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #fff;
    background: var(--color-accent);
    border: none;
    border-radius: 0.5rem;
    transition: background 0.15s ease;

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
    }

    &:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  }
}
</style>
