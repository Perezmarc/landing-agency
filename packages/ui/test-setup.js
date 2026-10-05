// jest-dom matchers + DOM cleanup between tests.
// (Auto-cleanup needs an explicit afterEach because we don't use test globals.)
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
