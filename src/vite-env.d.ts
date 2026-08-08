/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Azure AD application (client) ID — public OAuth identifier, safe to expose. */
  readonly VITE_MS_CLIENT_ID: string
  /** Azure AD tenant ID — public OAuth identifier, safe to expose. */
  readonly VITE_MS_TENANT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
