/* ═══════════════════════════════════════════════════════════════════════════
   @forge/i18n — every user-facing string, and the machinery to get one.

   THE RULE: no user-facing string literal lives anywhere else. Not in a page,
   not in a component, not in an aria-label, not in a toast. English is the
   source language and `locales/en.json` is where a new string is written
   first; every other file has to follow in the same commit, because
   `locales.test.js` fails a language that is missing a key, drops a
   placeholder or leaves a long sentence identical to English.

   That test is the whole point of shipping a second language in a base
   repository. With one locale the machinery is untested scaffolding: nothing
   can catch a key you forgot, because there is nothing to compare against.

   ── USAGE ──────────────────────────────────────────────────────────────────
       import { useTranslations } from '@forge/i18n'
       const t = useTranslations('es')
       t('nav.contact')                      → "Contacto"
       t('footer.copyright', { year: 2026 }) → "© 2026 …"

   The locale is always a PARAMETER, never read from a global or from the
   machine. A build must not depend on where it ran, and a page that renders
   both languages' <link rel="alternate"> needs both catalogs at once.

   ── WHAT IS NOT TRANSLATED ─────────────────────────────────────────────────
   Anything the server owns. Blog article bodies are per-language files, not
   keys; the brand name comes from the manifest. Translating those here would
   mean two sources of truth for the same sentence.
   ═══════════════════════════════════════════════════════════════════════════ */

import en from './locales/en.json' with { type: 'json' }
import es from './locales/es.json' with { type: 'json' }
import it from './locales/it.json' with { type: 'json' }

export const CATALOGS = { en, es, it }

/** Every locale with a catalog. The manifest decides which are PUBLISHED. */
export const LOCALES = Object.keys(CATALOGS)

export const DEFAULT_LOCALE = 'en'

/** Dotted-path lookup: 'nav.contact' → catalog.nav.contact. */
function lookup(catalog, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), catalog)
}

/* {{name}} → value. Deliberately whole-string: a translated fragment
   concatenated into another sentence breaks word order and gender in every
   language that has them, so one key is one whole sentence. */
function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  )
}

/**
 * A translator bound to one locale.
 *
 * A missing key falls back to English rather than rendering blank or throwing:
 * a page with one untranslated line is a smaller failure than a page with a
 * hole in it, or no page at all. The tests are what stop that fallback from
 * being load-bearing — in development a missing key is a warning, so it is
 * noticed before it ships.
 *
 * @param {string} locale
 * @returns {(key: string, vars?: Record<string, unknown>) => string}
 */
export function useTranslations(locale) {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]

  return function t(key, vars) {
    const value = lookup(catalog, key)
    if (typeof value === 'string') return interpolate(value, vars)

    const fallback = lookup(CATALOGS[DEFAULT_LOCALE], key)
    if (typeof fallback === 'string') {
      if (typeof console !== 'undefined' && locale !== DEFAULT_LOCALE) {
        console.warn(`[i18n] missing "${key}" in "${locale}" — falling back to English`)
      }
      return interpolate(fallback, vars)
    }

    // Neither catalog has it: return the key so the hole is visible and
    // greppable rather than an empty space nobody notices.
    if (typeof console !== 'undefined') console.warn(`[i18n] unknown key "${key}"`)
    return key
  }
}

/** A list value (the FAQ, a feature list) rather than a single string. */
export function useList(locale) {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE]
  return function list(key) {
    const value = lookup(catalog, key) ?? lookup(CATALOGS[DEFAULT_LOCALE], key)
    return Array.isArray(value) ? value : []
  }
}

/**
 * The locale a URL path is in.
 *
 * `/es/contacto` → 'es'; `/contact` → the default. The default locale is
 * deliberately UNPREFIXED: `/` and `/en/` both resolving would be two URLs for
 * one page, which is a duplicate-content problem you then have to canonicalise
 * your way out of.
 */
export function localeFromPath(path = '/') {
  const segment = path.replace(/^\/+/, '').split('/')[0]
  return LOCALES.includes(segment) && segment !== DEFAULT_LOCALE ? segment : DEFAULT_LOCALE
}

/** The BCP-47 tag for `<html lang>` and Intl. */
export const HTML_LANG = { en: 'en', es: 'es', it: 'it' }

/** The tag for an OG `locale` property, which wants a region. */
export const OG_LOCALE = { en: 'en_US', es: 'es_ES', it: 'it_IT' }

/** The Intl locale used to format dates and numbers in each language. */
export const INTL_LOCALE = { en: 'en-US', es: 'es-ES', it: 'it-IT' }
