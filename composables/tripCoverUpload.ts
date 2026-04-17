import type { SupabaseClient } from "@supabase/supabase-js"

/** 將使用者選擇的圖檔繪製為 JPEG（固定輸出 .jpg 路徑用） */
export function imageFileToJpegBlob(file: File, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h) {
        reject(new Error("無法讀取圖片尺寸"))
        return
      }
      const max = 2560
      if (w > max || h > max) {
        const r = Math.min(max / w, max / h)
        w = Math.round(w * r)
        h = Math.round(h * r)
      }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("無法建立畫布"))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (b) => {
          if (b) resolve(b)
          else reject(new Error("無法輸出 JPEG"))
        },
        "image/jpeg",
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("無法載入圖片，請改用 JPEG 或 PNG"))
    }
    img.src = url
  })
}

export async function uploadTripCoverAndUpdateRow(
  supabase: SupabaseClient,
  opts: { userId: string; tripId: string; file: File },
): Promise<{ publicUrl: string }> {
  const jpeg = await imageFileToJpegBlob(opts.file)
  const objectPath = `covers/${opts.userId}/${opts.tripId}.jpg`
  const { error: upErr } = await supabase.storage
    .from("photos")
    .upload(objectPath, jpeg, {
      contentType: "image/jpeg",
      upsert: true,
    })
  if (upErr) throw upErr

  const { data: pub } = supabase.storage.from("photos").getPublicUrl(objectPath)
  const publicUrl = pub.publicUrl?.trim() ?? ""
  if (!publicUrl) {
    throw new Error("無法取得封面公開 URL")
  }

  const { error: dbErr } = await supabase
    .from("trips")
    .update({ cover_image_url: publicUrl })
    .eq("id", opts.tripId)

  if (dbErr) throw dbErr
  return { publicUrl }
}
