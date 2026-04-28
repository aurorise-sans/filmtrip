export default defineEventHandler(async (event) => {
  const { lat, lng } = getQuery(event)
  const la = parseFloat(String(lat ?? ""))
  const ln = parseFloat(String(lng ?? ""))
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid lat or lng" })
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(la))}&lon=${encodeURIComponent(String(ln))}&format=json&accept-language=zh-TW`
  const data = await $fetch<Record<string, unknown>>(url, {
    headers: { "User-Agent": "Filmtrip/1.0" },
  })

  const display_name = typeof data.display_name === "string" ? data.display_name : ""
  const address =
    data.address && typeof data.address === "object"
      ? (data.address as Record<string, unknown>)
      : null
  const country =
    address && typeof address.country === "string"
      ? address.country.trim() || null
      : null
  const cityCandidates = [
    "county",
    "state",
    "city",
    "town",
    "municipality",
    "village",
  ] as const
  let city: string | null = null
  if (address) {
    for (const key of cityCandidates) {
      const v = address[key]
      if (typeof v === "string" && v.trim()) {
        city = v.trim()
        break
      }
    }
  }
  return { display_name, country, city }
})
