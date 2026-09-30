import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import * as compiler from 'vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

// Unit tests use an in-memory Vue renderer, without starting uni-app or a browser.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [vue({ compiler, template: { compilerOptions: { isCustomElement: tag => ['view', 'text', 'slider', 'button', 'scroll-view', 'switch', 'textarea'].includes(tag) } } })],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  test: {
    environment: 'node',
    testTransformMode: { web: ['**/docs/validation/**/*.spec.ts'] },
    include: ['tests/**/*.spec.ts', 'docs/validation/**/*.spec.ts'],
    cache: false,
    reporters: ['default', 'json'],
    outputFile: { json: fileURLToPath(new URL('./results/latest-tests.json', import.meta.url)) }
  }
})
