import { defineConfig } from 'vitest/config'

// The generator reads files from disk, so these run in `node` rather than a
// DOM — and the tokens themselves are plain data either way.
export default defineConfig({
  test: { environment: 'node', include: ['*.test.js'] },
})
