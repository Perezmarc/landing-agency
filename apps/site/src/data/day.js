/* The six team days for 'A day, before and after' — STRUCTURE ONLY.

   Every string (team name, role, block labels, the agent list) lives in
   @forge/i18n under home.day.teams.<id>, keyed by the ids below, so the three
   catalogs stay in step through the existing parity tests.

   These days are illustrations of the method, approved by the owner, not
   client data: the page says so on every tab, and day.test.js fails any
   total, percentage or hours figure that creeps into the copy.

   Block fields:
     start, end — 'HH:MM', on the 15-minute grid, inside DAY
     kind       — work | chase | wait | decide (how it looks BEFORE)
     after      — where it goes AFTER: agent (condensed into the Agent lane),
                  gone (waiting evaporates) or person (a decision you keep)
     before     — false for blocks that only exist AFTER (the decisions)
   agent        — ids of the 'what the agent prepared' list under the AFTER
                  calendar */

export const DAY = { start: '08:00', end: '17:30', step: 15 }

/** Minutes since midnight for 'HH:MM'. */
export function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const TEAMS = [
  {
    id: 'finance',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:30', kind: 'chase', after: 'agent' },
      { id: 'b3', start: '10:30', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:00', end: '14:30', kind: 'work', after: 'agent' },
      { id: 'b6', start: '14:30', end: '15:30', kind: 'chase', after: 'agent' },
      { id: 'b7', start: '15:30', end: '16:30', kind: 'work', after: 'agent' },
      { id: 'b8', start: '16:30', end: '17:30', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:15', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '09:30', end: '10:00', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '10:30', end: '11:30', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '13:00', end: '14:30', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:00', end: '16:30', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
  {
    id: 'revenueOps',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:15', kind: 'chase', after: 'agent' },
      { id: 'b3', start: '10:15', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:30', end: '14:30', kind: 'chase', after: 'agent' },
      { id: 'b6', start: '14:30', end: '15:30', kind: 'work', after: 'agent' },
      { id: 'b7', start: '15:30', end: '16:15', kind: 'wait', after: 'gone' },
      { id: 'b8', start: '16:15', end: '17:15', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:15', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '09:30', end: '10:30', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '11:00', end: '12:00', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '14:00', end: '15:00', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:30', end: '17:00', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
  {
    id: 'procurement',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:30', kind: 'chase', after: 'agent' },
      { id: 'b3', start: '10:30', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:00', end: '14:30', kind: 'work', after: 'agent' },
      { id: 'b6', start: '14:30', end: '15:30', kind: 'chase', after: 'agent' },
      { id: 'b7', start: '15:30', end: '16:00', kind: 'wait', after: 'gone' },
      { id: 'b8', start: '16:00', end: '17:00', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:15', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '09:30', end: '10:15', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '10:30', end: '12:00', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '13:30', end: '14:30', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:00', end: '16:00', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
  {
    id: 'compliance',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:30', kind: 'chase', after: 'agent' },
      { id: 'b3', start: '10:30', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:00', end: '14:30', kind: 'work', after: 'agent' },
      { id: 'b6', start: '14:30', end: '15:30', kind: 'chase', after: 'agent' },
      { id: 'b7', start: '15:30', end: '16:00', kind: 'wait', after: 'gone' },
      { id: 'b8', start: '16:00', end: '17:00', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:30', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '10:00', end: '10:45', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '11:00', end: '12:00', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '13:30', end: '14:30', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:00', end: '16:30', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
  {
    id: 'customerOps',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:30', kind: 'work', after: 'agent' },
      { id: 'b3', start: '10:30', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:00', end: '14:30', kind: 'chase', after: 'agent' },
      { id: 'b6', start: '14:30', end: '15:30', kind: 'work', after: 'agent' },
      { id: 'b7', start: '15:30', end: '16:00', kind: 'wait', after: 'gone' },
      { id: 'b8', start: '16:00', end: '17:00', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:30', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '10:00', end: '10:30', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '11:00', end: '12:00', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '13:30', end: '15:00', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:30', end: '16:30', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
  {
    id: 'logistics',
    blocks: [
      { id: 'b1', start: '08:30', end: '09:30', kind: 'work', after: 'agent' },
      { id: 'b2', start: '09:30', end: '10:30', kind: 'chase', after: 'agent' },
      { id: 'b3', start: '10:30', end: '11:00', kind: 'wait', after: 'gone' },
      { id: 'b4', start: '11:00', end: '12:30', kind: 'work', after: 'agent' },
      { id: 'b5', start: '13:00', end: '14:00', kind: 'work', after: 'agent' },
      { id: 'b6', start: '14:00', end: '15:00', kind: 'chase', after: 'agent' },
      { id: 'b7', start: '15:00', end: '15:30', kind: 'wait', after: 'gone' },
      { id: 'b8', start: '15:30', end: '17:00', kind: 'work', after: 'agent' },
      { id: 'd1', start: '08:30', end: '09:30', kind: 'decide', after: 'person', before: false },
      { id: 'd2', start: '10:00', end: '10:30', kind: 'decide', after: 'person', before: false },
      { id: 'd3', start: '11:00', end: '12:00', kind: 'decide', after: 'person', before: false },
      { id: 'd4', start: '13:30', end: '14:30', kind: 'decide', after: 'person', before: false },
      { id: 'd5', start: '15:00', end: '16:30', kind: 'decide', after: 'person', before: false },
    ],
    agent: ['a1', 'a2', 'a3', 'a4'],
  },
]
