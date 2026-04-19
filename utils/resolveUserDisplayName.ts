/** email 的 @ 左側，無效時為 null */
export function emailLocalPart(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null
  const trimmed = email.trim()
  const i = trimmed.indexOf("@")
  if (i <= 0) return null
  const local = trimmed.slice(0, i).trim()
  return local.length ? local : null
}

export type ResolveUserDisplayNameInput = {
  /** profiles.display_name */
  profileDisplayName?: string | null
  email?: string | null
  /** auth user_metadata（Google 的 full_name / name 等） */
  userMetadata?: Record<string, unknown> | null
}

/**
 * 顯示名稱後援順序：
 * profiles.display_name → user_metadata.full_name / name / nickname / preferred_username
 * → email @ 前綴 →「使用者」
 */
export function resolveUserDisplayName(
  input: ResolveUserDisplayNameInput,
): string {
  const fromProfile = input.profileDisplayName?.trim()
  if (fromProfile) return fromProfile

  const meta = input.userMetadata
  if (meta && typeof meta === "object") {
    const full = meta.full_name
    if (typeof full === "string" && full.trim()) return full.trim()
    const name = meta.name
    if (typeof name === "string" && name.trim()) return name.trim()
    const nick = meta.nickname
    if (typeof nick === "string" && nick.trim()) return nick.trim()
    const pref = meta.preferred_username
    if (typeof pref === "string" && pref.trim()) return pref.trim()
  }

  const local = emailLocalPart(input.email)
  if (local) return local

  return "使用者"
}
