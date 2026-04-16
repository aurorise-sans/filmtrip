<template>
  <div class="profile">
    <h1 class="profile__title">個人</h1>
    <p v-if="email" class="profile__meta">目前帳號：{{ email }}</p>

    <section class="profile__section" aria-labelledby="profile-trips-heading">
      <div class="profile__section-head">
        <h2 id="profile-trips-heading" class="profile__section-title">
          我的旅程
        </h2>
        <NuxtLink class="profile__action" to="/trips/new">建立旅程</NuxtLink>
      </div>

      <p v-if="pending" class="profile__hint">載入中…</p>
      <p v-else-if="fetchError" class="profile__error" role="alert">
        {{ fetchError }}
      </p>
      <p v-else-if="!tripsList.length" class="profile__hint">
        尚無旅程，先建立一筆吧。
      </p>
      <ul v-else class="profile__list">
        <li v-for="trip in tripsList" :key="trip.id">
          <NuxtLink class="profile__trip" :to="`/trips/${trip.id}`">
            <span class="profile__trip-name">{{ trip.name }}</span>
            <span class="profile__trip-dates">
              <time :datetime="trip.start_date">{{ formatDate(trip.start_date) }}</time>
              <span class="profile__trip-sep" aria-hidden="true">—</span>
              <time :datetime="trip.end_date">{{ formatDate(trip.end_date) }}</time>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <nav class="profile__nav">
      <NuxtLink class="profile__link profile__link--muted" to="/">回到首頁</NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { JwtPayload } from "@supabase/supabase-js"

type TripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
}

const supabase = useSupabaseClient()
const userClaims = useSupabaseUser()

const userId = computed(
  () => (userClaims.value as JwtPayload | null)?.sub ?? null,
)

const email = computed(
  () => (userClaims.value as JwtPayload | null)?.email ?? null,
)

const { data: trips, error, pending } = await useAsyncData(
  "profile-trips",
  async () => {
    if (!userId.value) {
      return [] as TripRow[]
    }
    const { data, error: qErr } = await supabase
      .from("trips")
      .select("id, name, start_date, end_date, created_at")
      .order("created_at", { ascending: false })
    if (qErr) {
      throw qErr
    }
    return (data ?? []) as TripRow[]
  },
  {
    watch: [userId],
  },
)
const tripsList = computed(() => trips.value ?? [])
const fetchError = computed(() => error.value?.message ?? null)

function formatDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00")
  if (Number.isNaN(d.getTime())) {
    return isoDate
  }
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
}
</script>

<style lang="scss" scoped>
.profile {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;

  &__title {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }

  &__meta {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    color: var(--color-text);
  }

  &__section {
    margin-bottom: 2rem;
  }

  &__section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  &__action {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__hint {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  &__error {
    margin: 0;
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border-radius: 0.375rem;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface);
    overflow: hidden;
  }

  &__trip {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    padding: 0.85rem 1rem;
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.12s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
  }

  &__trip-name {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text);
  }

  &__trip-dates {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  &__trip-sep {
    margin: 0 0.25rem;
    opacity: 0.6;
  }

  &__nav {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  &__link {
    font-size: 0.9375rem;
    color: var(--color-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &--muted {
      color: var(--color-text-muted);
    }
  }
}
</style>
