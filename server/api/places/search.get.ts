export default defineEventHandler(async (event) => {
  const { q } = getQuery(event)
  if (!q || String(q).trim().length < 2) return []

  const apiKey = process.env.GOOGLE_PLACES_KEY
  if (!apiKey) throw createError({ statusCode: 500, message: "Missing GOOGLE_PLACES_KEY" })

  const url = "https://places.googleapis.com/v1/places:searchText"
  const body = {
    textQuery: String(q),
    languageCode: "zh-TW",
    regionCode: "TW",
    maxResultCount: 5,
  }

  const data = await $fetch<any>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body,
  })

  const places = data?.places ?? []
  return places.map((p: any, i: number) => {
    const displayName = p.displayName?.text ?? ""
    const formattedAddress = typeof p.formattedAddress === "string" ? p.formattedAddress.trim() : ""
    const display_name = formattedAddress
      ? `${displayName}・${formattedAddress}`
      : displayName
    return {
      id: `gp-${i}`,
      display_name,
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
    }
  })
})
