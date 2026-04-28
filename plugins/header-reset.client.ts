/**
 * 路由切換之前重置 Header 三段式狀態，避免殘留上一頁設定。
 *
 * 使用 `beforeEach`（而非 layout 的 `watch(route)`）是為了確保重置發生在
 * 新頁面 setup 之前——新頁面同步呼叫 `useHeader()` 寫入後就不會被覆蓋。
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.beforeEach(() => {
    resetHeader()
  })
})
