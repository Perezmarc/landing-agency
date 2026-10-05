import { describe, it, expect } from 'vitest'
import {
  graph, organizationSchema, websiteSchema, webPageSchema,
  faqSchema, articleSchema, SITE_ORIGIN,
} from './schema'
import forge from '@forge/manifest'

describe('schema builders', () => {
  it('wraps nodes in a @graph envelope and drops empty ones', () => {
    const result = graph(organizationSchema(), null, websiteSchema())
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@graph']).toHaveLength(2)
  })

  it('cross-references nodes by @id instead of repeating them', () => {
    // A graph whose nodes repeat the organisation inline is a pile of objects,
    // not a graph — and the duplicates disagree the moment one is edited.
    const org = organizationSchema()
    const site = websiteSchema()
    expect(site.publisher).toEqual({ '@id': org['@id'] })

    const page = webPageSchema({ url: `${SITE_ORIGIN}/contact`, title: 't', description: 'd' })
    expect(page.isPartOf).toEqual({ '@id': site['@id'] })
    expect(page.about).toEqual({ '@id': org['@id'] })
  })

  it('builds ids from the configured origin', () => {
    expect(organizationSchema()['@id']).toBe(`${forge.brand.url}/#organization`)
  })

  it('maps FAQs to Question/Answer pairs', () => {
    const faqs = [{ q: 'Why?', a: 'Because.' }]
    const schema = faqSchema(faqs)
    expect(schema['@type']).toBe('FAQPage')
    expect(schema.mainEntity[0].name).toBe('Why?')
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('Because.')
  })

  it('attributes an article to its author, or to the organisation', () => {
    const withAuthor = articleSchema({ url: 'u', title: 't', description: 'd', author: 'Ada' })
    expect(withAuthor.author).toEqual({ '@type': 'Person', name: 'Ada' })

    const without = articleSchema({ url: 'u', title: 't', description: 'd' })
    expect(without.author).toEqual({ '@id': organizationSchema()['@id'] })
  })

  it('omits article dates that were not supplied', () => {
    const schema = articleSchema({ url: 'u', title: 't', description: 'd' })
    expect(schema).not.toHaveProperty('datePublished')
    expect(schema).not.toHaveProperty('dateModified')
  })
})
