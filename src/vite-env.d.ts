/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Azure AD application (client) ID — public OAuth identifier, safe to expose. */
  readonly VITE_MS_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
