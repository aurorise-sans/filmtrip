// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-04-01",
  devtools: { enabled: true },
  css: ["~/assets/styles/main.scss"],

  app: {
    head: {
      link: [
        {
          rel: "stylesheet",
          href: "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
        },
      ],
      script: [
        {
          src: "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      mapboxToken: "",
    },
  },

  modules: ["@nuxtjs/supabase"],

  supabase: {
    types: "~/types/database.types.ts",
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      // 未登入仍可瀏覽首頁；其餘頁面需登入（可依需求調整）
      exclude: ["/"],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      // 本機 http 需 false；正式環境 https 為 true
      secure: !import.meta.dev,
    },
  },

  // Vercel 在建置時會設定 VERCEL=1；本機維持 node-server 方便 preview
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },

  // 未設定全域 CSP / Nitro CORS：瀏覽器直接對 Supabase REST 與 Storage 發送跨域請求，
  // 是否允許由 Supabase 專案 Dashboard → API → CORS 與 Storage 設定決定（須含本機與正式網域 origin）。
})
