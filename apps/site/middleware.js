/* Vercel Routing Middleware: picks the visitor's language on the home page.
 * The rules, and why, are in src/edge/locale.js, which this only wires to
 * the request. Static pages stay static: the middleware runs before the CDN
 * serves them and adds no JavaScript to any page. */
import forge from '@forge/manifest'
import { routePath } from '@forge/seo/routes'
import { decide } from './src/edge/locale.js'

const SITE = {
  published: forge.locales.published,
  fallback: forge.locales.default,
  homePath: locale => routePath('home', locale),
}

export const config = {
  // Pages only: never the hashed assets, media or any file with an extension.
  matcher: ['/((?!_astro/|.*\\.[a-z0-9]+$).*)'],
}

export default function middleware(request) {
  const { redirect, setCookie } = decide({
    url: request.url,
    acceptLanguage: request.headers.get('accept-language'),
    cookie: request.headers.get('cookie'),
    referer: request.headers.get('referer'),
  }, SITE)

  const headers = new Headers({ Vary: 'Accept-Language, Cookie' })
  if (setCookie) headers.append('Set-Cookie', setCookie)
  if (redirect) {
    headers.set('Location', new URL(redirect, request.url).toString())
    headers.set('Cache-Control', 'private, no-store')
    return new Response(null, { status: 307, headers })
  }
  // "Carry on to the page", with these headers added to it. This is what
  // `next()` from @vercel/functions/middleware returns; written out here so a
  // one-line helper doesn't bring two dozen packages into the lockfile.
  headers.set('x-middleware-next', '1')
  return new Response(null, { headers })
}
