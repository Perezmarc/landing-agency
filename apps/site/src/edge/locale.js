/* ═══════════════════════════════════════════════════════════════════════════
   WHICH LANGUAGE A VISITOR GETS — the logic behind ../../middleware.js.

   The site is static, so this is the one decision made per request, at the
   edge, before the page is served. Kept here, free of any Vercel API, so the
   unit tests can drive it with plain values.

   THE RULES
   - Only the default-locale home page (`/`) ever redirects. A deep link, a
     shared article or a search result lands exactly where it points.
   - On a first visit, the browser's preference list (Accept-Language, by
     q-value, ties in the order sent) picks the first published language.
     Nothing published → the default locale, no redirect.
   - Every page visited remembers its language in the `lang` cookie, so the
     next visit to `/` returns to the language the visitor last read in,
     including one they picked by hand in the footer.
   - Arriving at `/` from another page of this site (the footer's language
     links, the logo) is a choice: never redirected.
   - No Accept-Language (crawlers, mostly) → the default locale.
   ═══════════════════════════════════════════════════════════════════════════ */

export const COOKIE = 'lang'
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * The first published locale in an Accept-Language header, or null.
 * `es-ES,es;q=0.9,en;q=0.8` → 'es'. Region subtags are ignored, since the site
 * publishes languages, not regions.
 */
export function preferredLocale(acceptLanguage, published) {
  if (!acceptLanguage) return null
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map(p => p.trim()).find(p => p.startsWith('q='))
      const weight = q ? Number(q.slice(2)) : 1
      return { lang: tag.trim().toLowerCase().split('-')[0], weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter(entry => entry.lang && entry.lang !== '*' && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  return ranked.find(entry => published.includes(entry.lang))?.lang ?? null
}

/** The locale a path is in: its first segment when that is a published, non-default locale. */
export function localeOfPath(pathname, { published, fallback }) {
  const first = pathname.split('/')[1]?.toLowerCase()
  return first && first !== fallback && published.includes(first) ? first : fallback
}

/** One cookie's value from a Cookie header, or null. */
export function readCookie(header, name) {
  if (!header) return null
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/**
 * What to do with one request.
 *   request: { url, acceptLanguage, cookie, referer }
 *   site:    { published, fallback, homePath(locale) }
 * Returns { redirect: path | null, setCookie: header | null }.
 */
export function decide({ url, acceptLanguage, cookie, referer }, { published, fallback, homePath }) {
  const here = new URL(url)
  const current = localeOfPath(here.pathname, { published, fallback })
  const remembered = readCookie(cookie, COOKIE)
  const remember = locale => (locale === remembered ? null : `${COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Secure`)

  const isDefaultHome = (here.pathname.replace(/\/+$/, '') || '/') === homePath(fallback)
  if (!isDefaultHome) return { redirect: null, setCookie: remember(current) }

  let fromThisSite = false
  try { fromThisSite = !!referer && new URL(referer).origin === here.origin } catch { /* a malformed Referer is no referer */ }
  if (fromThisSite) return { redirect: null, setCookie: remember(fallback) }

  const wanted = published.includes(remembered) ? remembered : preferredLocale(acceptLanguage, published) ?? fallback
  if (wanted === fallback) return { redirect: null, setCookie: remember(fallback) }
  return { redirect: homePath(wanted) + here.search, setCookie: remember(wanted) }
}
