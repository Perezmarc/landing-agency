import { defineConfig } from 'vitest/config'

// No DOM: these builders run at build time, under bare Node and inside the
// Astro build. Running them in jsdom would hide a browser global creeping in.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
