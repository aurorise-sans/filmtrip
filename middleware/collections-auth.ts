/**
 * 收藏相關頁面：未登入導向 /login（以 auth.getUser() 判斷，含 SSR cookie session）
 */
export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return navigateTo("/login")
  }
})
