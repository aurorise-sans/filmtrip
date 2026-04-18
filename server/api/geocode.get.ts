export default defineEventHandler(async (event) => {
  const { q } = getQuery(event)
  if (q === undefined || q === null || String(q).trim() === "") {
    return []
  }
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(String(q))}&format=json&limit=5&accept-language=zh-TW`
  const data = await $fetch(url, {
    headers: { "User-Agent": "Filmtrip/1.0" },
  })
  return data
})
