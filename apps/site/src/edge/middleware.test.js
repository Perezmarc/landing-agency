import { describe, it, expect } from 'vitest'
import forge from '@forge/manifest'
import { routePath } from '@forge/seo/routes'
import middleware, { config } from '../../middleware.js'

const SECOND = forge.locales.published.find(l => l !== forge.locales.default)
const home = routePath('home', forge.locales.default)
const request = (path, headers = {}) => new Request(`https://site.test${path}`, { headers })

describe('middleware', () => {
  it.skipIf(!SECOND)('redirects a first visit with 307, uncached, setting the cookie', () => {
    const res = middleware(request(home, { 'accept-language': SECOND }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`https://site.test${routePath('home', SECOND)}`)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`^lang=${SECOND};`))
  })

  it('lets every other request through to the static page', () => {
    const res = middleware(request(routePath('contact', forge.locales.default), { 'accept-language': SECOND ?? 'xx' }))
    expect(res.headers.get('x-middleware-next')).toBe('1')
    expect(res.headers.get('location')).toBeNull()
  })

  it('runs on pages only, never on assets or files', () => {
    const [pattern] = config.matcher
    const re = new RegExp(`^${pattern}$`)
    for (const path of ['/', '/es', '/it/contatti', '/blog/some-post']) expect(re.test(path), path).toBe(true)
    for (const path of ['/_astro/x.css', '/favicon.svg', '/sitemap.xml', '/robots.txt', '/og.png']) expect(re.test(path), path).toBe(false)
  })
})
