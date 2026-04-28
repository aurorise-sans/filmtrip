export type ReverseGeocodeResult = {
  displayName: string | null
  country: string | null
  city: string | null
}

/** Nominatim reverse；成功回傳 display_name / country / city */
export async function fetchReverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  try {
    const res = await fetch(
      `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    )
    if (!res.ok) {
      return { displayName: null, country: null, city: null }
    }
    const data = (await res.json()) as {
      display_name?: string
      country?: string | null
      city?: string | null
    }
    const displayName =
      typeof data.display_name === "string" ? data.display_name.trim() : ""
    const country = typeof data.country === "string" ? data.country.trim() : ""
    const city = typeof data.city === "string" ? data.city.trim() : ""
    return {
      displayName: displayName || null,
      country: country || null,
      city: city || null,
    }
  } catch {
    return { displayName: null, country: null, city: null }
  }
}

/** 相容舊呼叫點：僅拿 display_name */
export async function fetchReverseDisplayName(
  lat: number,
  lng: number,
): Promise<string | null> {
  const result = await fetchReverseGeocode(lat, lng)
  return result.displayName
}
