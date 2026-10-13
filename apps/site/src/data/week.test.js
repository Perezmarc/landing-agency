import { describe, it, expect } from 'vitest'
import { CATALOGS, DEFAULT_LOCALE } from '@forge/i18n'
import { WEEK, TEAMS, minutes, occurrences, labelLines } from './week.js'

/* The weeks are illustrations, so these tests guard three things: that the
   structure and the copy stay in step (every id has its string, in every
   language), that the calendar can be drawn (on the grid, no overlaps), and
   that no result-shaped number sneaks into the copy. */

const EN = CATALOGS[DEFAULT_LOCALE].home.day
const CATEGORIES = ['work', 'chase', 'wait', 'decide']

/** Every string inside a value, however deeply nested. */
const strings = value => typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []

describe('the team weeks', () => {
  it('match the catalog: the same teams, and every task has its label in every language', () => {
    expect(TEAMS.map(t => t.id)).toEqual(Object.keys(EN.teams))
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const team of TEAMS) {
        const labels = catalog.home.day.teams[team.id].blocks
        expect(Object.keys(labels).sort(), `${locale} ${team.id}`).toEqual(team.tasks.map(t => t.id).sort())
        for (const id of Object.keys(labels)) expect(labels[id], `${locale} ${team.id}.${id}`).toBeTruthy()
      }
      for (const category of CATEGORIES) expect(catalog.home.day.kinds[category], `${locale} ${category}`).toBeTruthy()
    }
  })

  it('give every task a known category and a kept flag', () => {
    for (const team of TEAMS) for (const task of team.tasks) {
      expect(CATEGORIES, `${team.id}.${task.id}`).toContain(task.category)
      expect(typeof task.kept, `${team.id}.${task.id}`).toBe('boolean')
    }
  })

  it('run Monday to Friday, with every task scheduled and only catalog tasks', () => {
    for (const team of TEAMS) {
      expect(team.schedule, team.id).toHaveLength(WEEK.days)
      const ids = new Set(team.tasks.map(t => t.id))
      const used = new Set(occurrences(team).map(o => o.task))
      for (const id of used) expect(ids.has(id), `${team.id}: ${id} is not in the catalog`).toBe(true)
      for (const id of ids) expect(used.has(id), `${team.id}: ${id} is never scheduled`).toBe(true)
    }
  })

  it('sit inside the day, on the 15-minute grid, at least half an hour long', () => {
    const start = minutes(WEEK.start), end = minutes(WEEK.end)
    for (const team of TEAMS) for (const o of occurrences(team)) {
      const s = minutes(o.start), e = minutes(o.end), where = `${team.id} day ${o.day} ${o.task}`
      expect(s, where).toBeGreaterThanOrEqual(start)
      expect(e, where).toBeLessThanOrEqual(end)
      expect(e - s, where).toBeGreaterThanOrEqual(30)
      expect(s % WEEK.step, where).toBe(0)
      expect(e % WEEK.step, where).toBe(0)
    }
  })

  it('never overlap within a day', () => {
    for (const team of TEAMS) team.schedule.forEach((list, day) => {
      const sorted = [...list].sort((a, b) => minutes(a[1]) - minutes(b[1]))
      sorted.slice(1).forEach(([task, start], i) => {
        expect(minutes(start), `${team.id} day ${day}: ${sorted[i][0]} overlaps ${task}`)
          .toBeGreaterThanOrEqual(minutes(sorted[i][2]))
      })
    })
  })

  it('keep the decisions with the person and take the waiting away', () => {
    for (const team of TEAMS) for (const task of team.tasks) {
      if (task.category === 'decide') expect(task.kept, `${team.id}.${task.id}`).toBe(true)
      if (task.category === 'wait') expect(task.kept, `${team.id}.${task.id}`).toBe(false)
    }
  })

  it('each keep at least one task and eliminate at least one', () => {
    for (const team of TEAMS) {
      const kept = occurrences(team).map(o => team.tasks.find(t => t.id === o.task).kept)
      expect(kept.some(Boolean), team.id).toBe(true)
      expect(kept.some(k => !k), team.id).toBe(true)
    }
  })

  it('show every category on Monday, the day a phone shows', () => {
    for (const team of TEAMS) {
      const seen = new Set(team.schedule[0].map(([id]) => team.tasks.find(t => t.id === id).category))
      expect([...seen].sort(), team.id).toEqual([...CATEGORIES].sort())
    }
  })

  it('carry no totals, percentages or hours in any language', () => {
    // The weeks are illustrations, not results. A figure here would read as a claim.
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const text of strings(catalog.home.day)) {
        expect(text, `${locale}: "${text}"`).not.toMatch(/\d+\s*(%|h\b|hours?|horas?|ore\b)/i)
      }
    }
  })
})

describe('labelLines', () => {
  /* marketing.css: a chip is len/15 slots tall, minus a 2px gap and its top
     padding (about a quarter of a slot together). Stacked, a line is one slot;
     side by side (dense), three quarters of one. */
  it('gives each chip as many whole lines as fit its height, at both scales', () => {
    for (const len of [30, 45, 60, 75, 90, 105, 120]) {
      const slots = len / WEEK.step, room = slots - 0.25, { stacked, dense } = labelLines(len)
      expect(stacked, `${len} stacked`).toBe(slots - 1)
      expect(dense * 0.75, `${len} dense`).toBeLessThanOrEqual(room)
      expect((dense + 1) * 0.75, `${len} dense`).toBeGreaterThan(room)
    }
  })

  it('shows a half-hour task on one line stacked and on two side by side', () => {
    expect(labelLines(30)).toEqual({ stacked: 1, dense: 2 })
  })
})
