/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APS_URN?: string
  /** Nếu set, mọi request dùng origin này thay vì same-origin + proxy (build tĩnh + API riêng subdomain). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
