import { defineConfig } from 'vitest/config'

// The site's own unit tests. `include` is narrowed to src/ on purpose: e2e/
// holds Playwright specs, and Vitest picking those up fails with "Playwright
// Test did not expect test.describe() to be called here" — a confusing error
// for a simple cause.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
