import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The kit's own suite. It runs in jsdom because these ARE the DOM components,
// and it is separate from the site's so a component can be tested without the
// site being buildable — which is the point of the component living in a
// package rather than in a page's folder.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test-setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
