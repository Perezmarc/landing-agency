import { defineConfig } from 'vitest/config'

// The manifest schema is plain data and plain functions — no DOM, no React, no
// browser globals — and it has to stay that way: it is imported by Node build
// scripts under bare `node` and by Astro at build time as well as by the
// bundle. Running its tests in the `node` environment rather than jsdom is what
// catches a stray `window` the moment it appears.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
