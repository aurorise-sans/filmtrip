export {}

declare global {
  interface Window {
    maplibregl: MapLibreGlobal
  }

  /** CDN maplibre-gl UMD，僅宣告本頁用到的型別 */
  interface MapLibreGlobal {
    Map: new (options: Record<string, unknown>) => MapLibreMap
    NavigationControl: new (options?: Record<string, unknown>) => unknown
    Popup: new (options: Record<string, unknown>) => MapLibrePopup
    Marker: new (options: Record<string, unknown>) => MapLibreMarker
    LngLatBounds: new () => MapLibreLngLatBounds
  }

  interface MapLibreMap {
    addControl: (control: unknown, position?: string) => void
    on: (type: string, listener: (e?: unknown) => void) => void
    once: (type: string, listener: (e?: unknown) => void) => void
    loaded: () => boolean
    resize: () => void
    flyTo: (options: { center: [number, number]; zoom?: number; essential?: boolean }) => void
    fitBounds: (bounds: MapLibreLngLatBounds, options: Record<string, unknown>) => void
    remove: () => void
  }

  interface MapLibrePopup {
    setDOMContent: (node: Node) => MapLibrePopup
  }

  interface MapLibreMarker {
    setLngLat: (lngLat: [number, number]) => MapLibreMarker
    setPopup: (popup: MapLibrePopup) => MapLibreMarker
    addTo: (map: MapLibreMap) => MapLibreMarker
    on: (type: string, listener: (e?: unknown) => void) => MapLibreMarker
    getLngLat: () => { lng: number; lat: number }
    remove: () => void
  }

  interface MapLibreLngLatBounds {
    extend: (lngLat: [number, number]) => void
  }
}
