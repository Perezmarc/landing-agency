import { describe, it, expect } from 'vitest'
import { CATALOGS, DEFAULT_LOCALE } from '@forge/i18n'
import { DAY, TEAMS, minutes } from './day.js'

/* The days are illustrations, so these tests guard two things: that the
   structure and the copy stay in step (every id has its string, in every
   language), and that no result-shaped number sneaks into the copy. */

const EN = CATALOGS[DEFAULT_LOCALE].home.day

/** Every string inside a value, however deeply nested. */
const strings = value => typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []

describe('the team days', () => {
  it('match the catalog: the same teams, and every block id has its string', () => {
    expect(TEAMS.map(t => t.id)).toEqual(Object.keys(EN.teams))
    for (const team of TEAMS) {
      const ids = [...team.blocks.map(b => b.id), ...team.agent]
      expect(Object.keys(EN.teams[team.id].blocks).sort(), team.id).toEqual([...ids].sort())
    }
  })

  it('sit inside the day, on the 15-minute grid', () => {
    const start = minutes(DAY.start), end = minutes(DAY.end)
    for (const team of TEAMS) for (const block of team.blocks) {
      const s = minutes(block.start), e = minutes(block.end), where = `${team.id}.${block.id}`
      expect(s, where).toBeGreaterThanOrEqual(start)
      expect(e, where).toBeLessThanOrEqual(end)
      expect(e, where).toBeGreaterThan(s)
      expect(s % DAY.step, where).toBe(0)
      expect(e % DAY.step, where).toBe(0)
    }
  })

  it('never overlap within a lane', () => {
    const lanes = team => ({
      before: team.blocks.filter(b => b.before !== false),
      person: team.blocks.filter(b => b.after === 'person'),
      agent: team.blocks.filter(b => b.after === 'agent'),
    })
    for (const team of TEAMS) for (const [lane, blocks] of Object.entries(lanes(team))) {
      const sorted = [...blocks].sort((a, b) => minutes(a.start) - minutes(b.start))
      sorted.slice(1).forEach((block, i) => {
        expect(minutes(block.start), `${team.id} ${lane}: ${sorted[i].id} overlaps ${block.id}`)
          .toBeGreaterThanOrEqual(minutes(sorted[i].end))
      })
    }
  })

  it('send waiting away and keep decisions with the person', () => {
    for (const team of TEAMS) for (const block of team.blocks) {
      if (block.kind === 'wait') expect(block.after, `${team.id}.${block.id}`).toBe('gone')
      if (block.kind === 'decide') expect(block.after, `${team.id}.${block.id}`).toBe('person')
    }
  })

  it('each hand at least one block to an agent and keep at least one decision', () => {
    for (const team of TEAMS) {
      expect(team.blocks.some(b => b.after === 'agent'), team.id).toBe(true)
      expect(team.blocks.some(b => b.kind === 'decide'), team.id).toBe(true)
    }
  })

  it('carry no totals, percentages or hours in any language', () => {
    // The days are illustrations, not results. A figure here would read as a claim.
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const text of strings(catalog.home.day)) {
        expect(text, `${locale}: "${text}"`).not.toMatch(/\d+\s*(%|h\b|hours?|horas?|ore\b)/i)
      }
    }
  })
})
