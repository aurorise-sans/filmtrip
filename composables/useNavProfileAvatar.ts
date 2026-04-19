import { resolveUserDisplayName } from "~/utils/resolveUserDisplayName"

/**
 * 置底 App Bar 頭像與名稱：頭像優先 profiles.avatar_url，否則 user_metadata.avatar_url；
 * 名稱見 utils/resolveUserDisplayName。使用 useState 跨 layout / 頁面共享。
 */
export function useNavProfileAvatar() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  /** 來自 profiles.avatar_url；null 表示無自訂頭像（顯示改由 Google metadata 補上） */
  const profileAvatarUrl = useState<string | null>(
    "nav-profile-avatar-url",
    () => null,
  )

  /** 來自 profiles.display_name；null 表示走 metadata / email 後援 */
  const profileDisplayNameRaw = useState<string | null>(
    "nav-profile-display-name",
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

  const navResolvedDisplayName = computed(() =>
    resolveUserDisplayName({
      profileDisplayName: profileDisplayNameRaw.value,
      email: user.value?.email ?? null,
      userMetadata: (user.value?.user_metadata ?? null) as Record<
        string,
        unknown
      > | null,
    }),
  )

  async function loadProfileAvatarFromDb() {
    const {
      data: { user: authUser },
      error: authErr,
    } = await supabase.auth.getUser()

    if (authErr || !authUser?.id) {
      profileAvatarUrl.value = null
      profileDisplayNameRaw.value = null
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("id", authUser.id)
      .maybeSingle()

    if (error) {
      console.error("[NavAvatar] profiles select:", error)
      return
    }

    profileAvatarUrl.value = data?.avatar_url ?? null
    profileDisplayNameRaw.value = data?.display_name ?? null
  }

  function setProfileAvatarUrl(url: string | null) {
    profileAvatarUrl.value = url
  }

  function setProfileDisplayNameFromDb(name: string | null) {
    profileDisplayNameRaw.value = name
  }

  return {
    profileAvatarUrl,
    profileDisplayNameRaw,
    navAvatarDisplayUrl,
    navResolvedDisplayName,
    loadProfileAvatarFromDb,
    setProfileAvatarUrl,
    setProfileDisplayNameFromDb,
  }
}
