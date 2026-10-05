import { describe, it, expect } from 'vitest'
import { CATALOGS, LOCALES, DEFAULT_LOCALE } from './index.js'

/* THE GUARD RAIL.

   These tests are the reason a base repository ships a second language at all.
   With one locale the i18n machinery is untested scaffolding: nothing can
   catch a key you forgot, because there is nothing to compare against.

   Add a key to en.json and every other catalog has to follow in the same
   commit, or this fails. That is the intended friction. */

const SOURCE = CATALOGS[DEFAULT_LOCALE]
const OTHERS = LOCALES.filter(locale => locale !== DEFAULT_LOCALE)

/** Every leaf path in a catalog, as dotted keys. Arrays are leaves. */
function paths(node, prefix = '') {
  if (typeof node === 'string' || Array.isArray(node)) return [prefix]
  return Object.entries(node).flatMap(([key, value]) =>
    paths(value, prefix ? `${prefix}.${key}` : key),
  )
}

function at(catalog, path) {
  return path.split('.').reduce((node, part) => node?.[part], catalog)
}

/** The {{placeholders}} in a string, or in every string of a list of objects. */
function placeholders(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort()
}

/** Every string inside a value, whether it is one or a list of objects. */
function strings(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(item => Object.values(item).filter(v => typeof v === 'string'))
  return []
}

describe.each(OTHERS)('%s', (locale) => {
  const catalog = CATALOGS[locale]
  const sourcePaths = paths(SOURCE)

  it('has every key English has', () => {
    const missing = sourcePaths.filter(path => at(catalog, path) === undefined)
    expect(missing, `missing in ${locale}`).toEqual([])
  })

  it('has no key English does not', () => {
    // An extra key is dead weight at best. More often it is a key that was
    // renamed in English and left behind here, so the page silently falls back
    // and nobody notices the translation stopped being used.
    const extra = paths(catalog).filter(path => at(SOURCE, path) === undefined)
    expect(extra, `orphaned in ${locale}`).toEqual([])
  })

  it('keeps every {{placeholder}}', () => {
    // A dropped placeholder is the worst kind of translation bug: the sentence
    // still reads fine, and the value it was supposed to carry is gone.
    const broken = sourcePaths.filter(path =>
      placeholders(at(SOURCE, path)).join() !== placeholders(at(catalog, path)).join(),
    )
    expect(broken, `placeholders differ in ${locale}`).toEqual([])
  })

  it('keeps the same shape for lists', () => {
    // The FAQ and the feature list are arrays of objects rendered by index. A
    // language one item short renders a page one card short.
    sourcePaths.filter(path => Array.isArray(at(SOURCE, path))).forEach((path) => {
      expect(at(catalog, path).length, `${path} length in ${locale}`)
        .toBe(at(SOURCE, path).length)
    })
  })

  it('actually translates the long strings', () => {
    // A short string can legitimately be identical across languages ("Blog",
    // "Pro"). A whole sentence that is byte-identical to English is a copy
    // somebody meant to come back to.
    const untranslated = sourcePaths.filter((path) => {
      const source = strings(at(SOURCE, path))
      const target = strings(at(catalog, path))
      return source.some((text, i) => text.length > 40 && text === target[i])
    })
    expect(untranslated, `left in English in ${locale}`).toEqual([])
  })

  it('leaves no empty string', () => {
    const blank = sourcePaths.filter(path => strings(at(catalog, path)).some(text => text.trim() === ''))
    expect(blank, `blank in ${locale}`).toEqual([])
  })
})

describe('the source catalog', () => {
  it('uses whole sentences, not fragments to concatenate', () => {
    // A string that begins or ends mid-sentence is one somebody is gluing to
    // another: word order and gender differ by language, so the glue breaks.
    const fragments = paths(SOURCE).flatMap(path =>
      strings(at(SOURCE, path))
        .filter(text => /^\s|\s$/.test(text))
        .map(() => path),
    )
    expect(fragments, 'strings with leading/trailing space').toEqual([])
  })

  it('declares a catalog for every locale it lists', () => {
    LOCALES.forEach(locale => expect(CATALOGS[locale]).toBeTruthy())
  })
})
