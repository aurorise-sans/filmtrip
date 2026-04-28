import type { Component } from "vue"

/**
 * 共用 Header 三段式設定：左 / 中 / 右。
 *
 * - left：'back' 顯示返回鍵並 `router.back()`；object 顯示自訂 icon 與行為；null 留空。
 * - center：'logo' 顯示 Filmtrip 字樣並連回首頁；string 顯示文字；null 留空。
 * - right：object 顯示自訂 icon 按鈕；null 留空。
 */
export type HeaderLeft =
  | "back"
  | { icon: Component; onClick: () => void }
  | null

export type HeaderCenter = "logo" | string | null

export type HeaderRight = { icon: Component; onClick: () => void } | null

export interface UseHeaderOptions {
  left?: HeaderLeft
  center?: HeaderCenter
  right?: HeaderRight
}

const HEADER_LEFT_KEY = "header-left"
const HEADER_CENTER_KEY = "header-center"
const HEADER_RIGHT_KEY = "header-right"

const DEFAULT_LEFT: HeaderLeft = null
const DEFAULT_CENTER: HeaderCenter = "logo"
const DEFAULT_RIGHT: HeaderRight = null

/** 取得三個區塊共享的 useState（layout 與 useHeader 都從這裡讀寫）。 */
export function useHeaderState() {
  return {
    left: useState<HeaderLeft>(HEADER_LEFT_KEY, () => DEFAULT_LEFT),
    center: useState<HeaderCenter>(HEADER_CENTER_KEY, () => DEFAULT_CENTER),
    right: useState<HeaderRight>(HEADER_RIGHT_KEY, () => DEFAULT_RIGHT),
  }
}

/** 重置為預設值（路由切換之前由 plugin 呼叫，避免殘留上一頁設定）。 */
export function resetHeader() {
  const s = useHeaderState()
  s.left.value = DEFAULT_LEFT
  s.center.value = DEFAULT_CENTER
  s.right.value = DEFAULT_RIGHT
}

/**
 * 頁面 setup 中呼叫即可設定該頁的 Header。
 * 只覆寫呼叫者明確指定的欄位；未指定的維持預設值。
 */
export function useHeader(options: UseHeaderOptions = {}) {
  const s = useHeaderState()
  if (options.left !== undefined) s.left.value = options.left
  if (options.center !== undefined) s.center.value = options.center
  if (options.right !== undefined) s.right.value = options.right
}
