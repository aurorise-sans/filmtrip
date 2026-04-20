/**
 * 記錄導向 /map 時的「上一頁」path，供 map 頁判斷是否為 Navbar 進入或從照片頁返回。
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const mapEnterFrom = useState<string | null>("map-enter-from", () => null)

  router.afterEach((to, from) => {
    if (to.path === "/map") {
      mapEnterFrom.value = from.path ?? null
    }
  })
})
