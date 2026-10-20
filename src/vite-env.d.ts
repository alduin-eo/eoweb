/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'test' for test-environment builds; anything else is a production build. */
  readonly VITE_DEPLOY_ENV?: 'production' | 'test';
}
