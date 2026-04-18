/**
 * 置底 App Bar 頭像：優先 profiles.avatar_url，否則 user_metadata.avatar_url。
 * 使用 useState 跨 layout / 頁面共享，上傳成功後可 setProfileAvatarUrl 即時更新。
 */
export function useNavProfileAvatar() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  /** 來自 profiles.avatar_url；null 表示無自訂頭像（顯示改由 Google metadata 補上） */
  const profileAvatarUrl = useState<string | null>(
    "nav-profile-avatar-url",
    () => null,
  )

  const navAvatarDisplayUrl = computed(() => {
    const p = profileAvatarUrl.value
    if (p && p.trim().length > 0) {
      return p
    }
    const meta = user.value?.user_metadata as { avatar_url?: string } | undefined
    return meta?.avatar_url ?? null
  })

  async function loadProfileAvatarFromDb() {
    const {
      data: { user: authUser },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !authUser?.id) {
      profileAvatarUrl.value = null
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", authUser.id)
      .maybeSingle()

    if (error) {
      console.error("[NavAvatar] profiles select:", error)
      return
    }

    profileAvatarUrl.value = data?.avatar_url ?? null
  }

  function setProfileAvatarUrl(url: string | null) {
    profileAvatarUrl.value = url
  }

  return {
    profileAvatarUrl,
    navAvatarDisplayUrl,
    loadProfileAvatarFromDb,
    setProfileAvatarUrl,
  }
}
