import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import * as compiler from '@vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

// Audit-only configuration: unit tests without the uni-app build plugin.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  plugins: [vue({
    compiler,
    template: { compilerOptions: { isCustomElement: tag => ['view', 'text', 'slider', 'button', 'scroll-view'].includes(tag) } }
  })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../../src', import.meta.url)) }
  },
  test: {
    environment: 'node',
    testTransformMode: { web: ['**/runtime-audit.cases.ts'] },
    include: ['tests/**/*.spec.ts', 'docs/reviews/2026-09-30/runtime-audit.cases.ts'],
    cache: false
  }
})
