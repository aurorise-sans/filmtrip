/** Nominatim reverse；成功回傳 trim 後的 display_name，失敗為 null */
export async function fetchReverseDisplayName(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    const name =
      typeof data.display_name === "string" ? data.display_name.trim() : ""
    return name || null
  } catch {
    return null
  }
}
