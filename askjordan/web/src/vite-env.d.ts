/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROGRESSIVE_STORIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}