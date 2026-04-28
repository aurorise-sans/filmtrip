/** 建立旅程「本機選圖」步驟的暫存項目（與 TripPhotoLocalPicker 一致） */
export type LocalPendingPhotoItem = {
  key: string
  file: File
  previewUrl: string
  lat: number | null
  lng: number | null
  hasGps: boolean
  placeName: string
  country: string | null
  city: string | null
}
