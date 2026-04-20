<template>
  <div class="collections-page">
    <header class="collections-page__head">
      <h1 class="collections-page__title">我的收藏</h1>
    </header>

    <p v-if="pending" class="collections-page__state">載入中…</p>
    <p v-else-if="fetchError" class="collections-page__error" role="alert">
      {{ fetchError }}
    </p>
    <p
      v-else-if="!items.length"
      class="collections-page__state collections-page__state--muted"
    >
      尚無收藏夾。在 Feed 點書籤即可建立。
    </p>
    <ul v-else class="collections-page__list" role="list">
      <li v-for="row in items" :key="row.id">
        <NuxtLink
          class="collections-page__row"
          :to="`/collections/${row.id}`"
        >
          <span class="collections-page__name">{{ row.name }}</span>
          <span class="collections-page__meta">
            {{ row.photoCount }} 張照片
          </span>
          <span class="collections-page__chev" aria-hidden="true">›</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: "collections-auth",
})

const supabase = useSupabaseClient()

type CollectionSummary = {
  id: string
  name: string
  created_at: string
  photoCount: number
}

const {
  data: items,
  pending,
  error: loadError,
} = await useAsyncData(
  "collections-list-summary",
  async () => {
    const { data: cols, error: cErr } = await supabase
      .from("collections")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })

    if (cErr) throw cErr
    const list = (cols ?? []) as {
      id: string
      name: string
      created_at: string
    }[]

    if (!list.length) return [] as CollectionSummary[]

    const ids = list.map((c) => c.id)
    const { data: itemRows, error: iErr } = await supabase
      .from("collection_items")
      .select("collection_id")
      .in("collection_id", ids)

    if (iErr) throw iErr

    const countByCollection: Record<string, number> = {}
    for (const r of itemRows ?? []) {
      const cid = (r as { collection_id: string }).collection_id
      countByCollection[cid] = (countByCollection[cid] ?? 0) + 1
    }

    return list.map((c) => ({
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      photoCount: countByCollection[c.id] ?? 0,
    }))
  },
)

const fetchError = computed(() => loadError.value?.message ?? "")

onMounted(() => {
  console.log("[collections/index.vue] mounted", useRoute().path)
})
</script>

<style lang="scss" scoped>
.collections-page {
  box-sizing: border-box;
  max-width: 32rem;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.5rem;
}

.collections-page__head {
  margin-bottom: 1rem;
}

.collections-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.collections-page__state {
  margin: 0;
  padding: 1rem 0;
  font-size: 0.9375rem;
  color: var(--color-text);

  &--muted {
    color: var(--color-text-muted);
  }
}

.collections-page__error {
  margin: 0;
  padding: 0.75rem 0;
  font-size: 0.875rem;
  color: var(--color-danger);
}

.collections-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
}

.collections-page__row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  font: inherit;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgba(15, 23, 42, 0.04);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
}

.collections-page__name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collections-page__meta {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.collections-page__chev {
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-text-muted);
}
</style>
