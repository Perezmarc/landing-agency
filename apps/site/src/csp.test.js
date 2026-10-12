import { describe, it, expect } from 'vitest'
import vercel from '../vercel.json' with { type: 'json' }

/* The Content-Security-Policy is what lets the landing page's one script run
   and nothing else. These pin the parts the site depends on. */

const header = (source, key) => vercel.headers.find(h => h.source === source)?.headers.find(h => h.key === key)?.value
const csp = header('/(.*)', 'Content-Security-Policy')
const directive = name => csp.split(';').map(d => d.trim()).find(d => d.startsWith(`${name} `))

describe('the CSP', () => {
  it('allows only same-origin scripts: no inline code, no eval', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
  })
  it('allows the self-hosted media, fonts and images', () => {
    expect(directive('media-src')).toBe("media-src 'self'")
    expect(directive('font-src')).toBe("font-src 'self'")
    expect(directive('img-src')).toContain("'self'")
  })
  it('keeps the immutable cache on hashed assets', () => {
    expect(header('/_astro/(.*)', 'Cache-Control')).toContain('immutable')
  })
})

describe('vercel.json', () => {
  /* Vercel validates the file against its schema and rejects the deploy on
     any unknown key, `$comment` included. The reasons live in
     docs/ARCHITECTURE.md instead. */
  const keys = value =>
    Array.isArray(value) ? value.flatMap(keys)
      : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)])
        : []

  it('carries no comment keys, which Vercel rejects', () => {
    expect(keys(vercel).filter(k => k.startsWith('$'))).toEqual([])
  })
})
