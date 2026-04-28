#!/usr/bin/env node
/**
 * Backfill photos.country / photos.city from Nominatim reverse geocoding.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-photos-country-city.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-photos-country-city.mjs --all
 *
 * Notes:
 * - Uses the same Nominatim reverse endpoint as server/api/geocode/reverse.get.ts.
 * - Applies >= 1.1s delay per photo to respect rate limits.
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("缺少環境變數：SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CITY_FALLBACK_KEYS = [
  "county",
  "state",
  "city",
  "town",
  "municipality",
  "village",
]
const DELAY_MS = 1100
const BATCH_SIZE = 200
const PROCESS_ALL = process.argv.includes("--all")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}&format=json&accept-language=zh-TW`

  const res = await fetch(url, {
    headers: { "User-Agent": "Filmtrip/1.0 backfill script" },
  })
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`)
  }

  const data = await res.json()
  const address =
    data?.address && typeof data.address === "object" ? data.address : null
  const country =
    address && typeof address.country === "string" && address.country.trim()
      ? address.country.trim()
      : null

  let city = null
  if (address) {
    for (const key of CITY_FALLBACK_KEYS) {
      const v = address[key]
      if (typeof v === "string" && v.trim()) {
        city = v.trim()
        break
      }
    }
  }

  return { country, city }
}

async function fetchTargets() {
  const all = []
  let from = 0

  while (true) {
    const to = from + BATCH_SIZE - 1
    let query = supabase
      .from("photos")
      .select("id, latitude, longitude, country, city")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: true })
      .range(from, to)
    if (!PROCESS_ALL) {
      query = query.or("country.is.null,city.is.null")
    }
    const { data, error } = await query

    if (error) throw error
    if (!data?.length) break

    all.push(...data)
    from += BATCH_SIZE
  }

  return all
}

async function main() {
  const targets = await fetchTargets()
  const total = targets.length
  const failures = []

  if (!total) {
    console.log("沒有需要回填的照片。")
    return
  }

  console.log(
    `開始回填，共 ${total} 張照片。模式：${PROCESS_ALL ? "all(with coords)" : "only null country/city"}`,
  )

  for (let i = 0; i < total; i++) {
    const row = targets[i]
    const progress = `[${i + 1}/${total}]`

    try {
      const { country, city } = await reverseGeocode(row.latitude, row.longitude)

      if (!country && !city) {
        throw new Error("Nominatim 未回傳可用 country/city")
      }

      const patch = {}
      if (country) patch.country = country
      if (city) patch.city = city

      const { error: upErr } = await supabase
        .from("photos")
        .update(patch)
        .eq("id", row.id)

      if (upErr) throw upErr
      console.log(`${progress} 已處理 id=${row.id}`)
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      failures.push({ id: row.id, reason })
      console.log(`${progress} 失敗 id=${row.id} reason=${reason}`)
    }

    await sleep(DELAY_MS)
  }

  console.log("----")
  console.log(`完成。成功 ${total - failures.length} / ${total}`)

  if (failures.length) {
    console.log("失敗清單：")
    for (const f of failures) {
      console.log(`- id=${f.id} reason=${f.reason}`)
    }
  }
}

main().catch((err) => {
  console.error("執行失敗：", err)
  process.exit(1)
})
