import { defineConfig } from 'vitest/config'

// The manifest is plain data read by bare-Node build scripts as well as by the
// bundle, so its tests run in `node` — a stray browser global would be caught
// here rather than at build time.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js'],
  },
})
