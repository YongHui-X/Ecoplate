/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ECOPLATE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
