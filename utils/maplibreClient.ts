/** OpenFreeMap Liberty 樣式（與首頁地圖一致） */
export const OPENFREEMAP_LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty"

export async function waitForMapLibreGl(timeoutMs = 15_000): Promise<MapLibreGlobal> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const m = typeof window !== "undefined" && window.maplibregl
    if (m) return m
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error("MapLibre GL 未能載入，請檢查網路或 CDN。")
}

/**
 * 唯讀小地圖（展示用），回傳 teardown。
 */
export async function mountReadonlyLocationMap(
  container: HTMLElement,
  lng: number,
  lat: number,
): Promise<() => void> {
  const maplibregl = await waitForMapLibreGl()
  const map = new maplibregl.Map({
    container,
    style: OPENFREEMAP_LIBERTY_STYLE,
    center: [lng, lat],
    zoom: 14,
    interactive: false,
    attributionControl: false,
  })

  let marker: InstanceType<typeof maplibregl.Marker> | undefined

  await new Promise<void>((resolve) => {
    map.once("idle", () => {
      marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([lng, lat])
        .addTo(map)
      map.resize()
      resolve()
    })
  })

  return () => {
    marker?.remove()
    map.remove()
  }
}
