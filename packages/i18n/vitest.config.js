import { defineConfig } from 'vitest/config'

// Plain data and plain functions — no DOM. The catalogs are read by the Astro
// build and by bare-Node scripts as well as by the bundle, so a stray browser
// global must fail here rather than at build time.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
