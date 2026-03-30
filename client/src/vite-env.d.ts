/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APS_URN?: string
  /** If set, requests use this origin instead of same-origin + Vite proxy (static FE + separate API host). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
