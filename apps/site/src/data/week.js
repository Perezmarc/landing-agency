/* The six team weeks for 'A week, before and after' — STRUCTURE ONLY.

   Every string (team name, role, task labels, category names) lives in
   @forge/i18n under home.day: a task's label is home.day.teams.<team>.blocks.<id>
   and a category's name is home.day.kinds.<category>. The three catalogs stay
   in step through the parity tests.

   These weeks are illustrations of the method, approved by the owner, not
   client data: the page says so on every tab, and week.test.js fails any
   total, percentage or hours figure that creeps into the copy.

   Per team:
     tasks    — the catalog: { id, category, kept }
                category: work | chase | wait | decide (its colour)
                kept:     true when the person still does it once an agent
                          takes the repetitive work; false when it leaves
                          the calendar (the agent does it, or the waiting
                          disappears)
     schedule — Monday to Friday, one list per day, of [taskId, start, end]
                ('HH:MM', on the 15-minute grid, inside WEEK, no overlaps).
                A recurring task appears on several days.

   BEFORE draws every occurrence; AFTER draws the kept ones only, in the same
   slots. A phone shows Monday alone (marketing.css), so Monday holds every
   category. */

export const WEEK = { start: '08:00', end: '17:30', step: 15, days: 5 }

/** Minutes since midnight for 'HH:MM'. */
export function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** How many label lines a chip of `len` minutes holds, at the calendar's two
    scales (marketing.css): `stacked`, where one label line is one slot tall,
    and `dense` (the weeks side by side), where a line is three quarters of a
    slot. The chip loses about a quarter of a slot to its padding and gap. */
export function labelLines(len) {
  const slots = len / WEEK.step
  return { stacked: Math.max(1, slots - 1), dense: Math.max(1, Math.floor((4 * slots - 1) / 3)) }
}

/** Every occurrence of a team's week, flat: { task, day, start, end }. */
export function occurrences(team) {
  return team.schedule.flatMap((list, day) => list.map(([task, start, end]) => ({ task, day, start, end })))
}

export const TEAMS = [
  {
    id: 'finance',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'chase', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'work', kept: false },
      { id: 'b6', category: 'chase', kept: false },
      { id: 'b7', category: 'work', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:30'], ['d1', '10:30', '11:15'], ['b4', '11:15', '12:30'], ['b5', '13:30', '14:30'], ['b3', '14:30', '15:15'], ['b8', '15:15', '16:30'], ['b6', '16:30', '17:15']],
      [['b1', '08:30', '09:30'], ['b4', '09:30', '11:00'], ['b3', '11:00', '11:30'], ['b2', '11:30', '12:30'], ['b8', '13:30', '14:30'], ['d3', '14:30', '15:30'], ['b6', '15:30', '16:30']],
      [['b1', '08:30', '09:30'], ['b8', '09:30', '10:15'], ['b4', '10:15', '11:45'], ['b2', '11:45', '12:30'], ['b5', '13:30', '15:00'], ['d1', '15:00', '15:45'], ['b6', '15:45', '16:45']],
      [['b1', '08:30', '09:30'], ['b7', '09:30', '11:30'], ['b3', '11:30', '12:15'], ['d2', '13:30', '14:15'], ['b8', '14:15', '15:15'], ['b6', '15:15', '16:15'], ['d4', '16:15', '17:00']],
      [['b1', '08:30', '09:15'], ['b2', '09:15', '10:00'], ['b4', '10:00', '11:30'], ['b3', '11:30', '12:00'], ['d5', '13:30', '15:00'], ['b8', '15:00', '16:00'], ['b5', '16:00', '17:00']],
    ],
  },
  {
    id: 'revenueOps',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'chase', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'chase', kept: false },
      { id: 'b6', category: 'work', kept: false },
      { id: 'b7', category: 'wait', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b4', '08:30', '10:00'], ['b2', '10:00', '10:45'], ['b3', '10:45', '11:30'], ['d2', '11:30', '12:15'], ['b1', '13:30', '14:30'], ['b8', '14:30', '15:30'], ['b5', '15:30', '16:15'], ['b7', '16:15', '17:00']],
      [['b4', '08:30', '09:30'], ['b1', '09:30', '10:30'], ['b2', '10:30', '11:15'], ['d1', '11:15', '12:00'], ['b8', '13:30', '14:15'], ['b5', '14:15', '15:00'], ['b3', '15:00', '15:45'], ['d3', '15:45', '17:00']],
      [['b4', '08:30', '09:30'], ['b8', '09:30', '10:15'], ['b5', '10:15', '11:00'], ['b7', '11:00', '11:45'], ['d2', '11:45', '12:30'], ['b6', '13:30', '15:30'], ['b2', '15:30', '16:30']],
      [['b4', '08:30', '09:30'], ['b1', '09:30', '10:30'], ['b3', '10:30', '11:15'], ['b8', '11:15', '12:15'], ['d4', '13:30', '14:30'], ['b5', '14:30', '15:15'], ['b6', '15:15', '16:30']],
      [['b4', '08:30', '09:30'], ['b2', '09:30', '10:15'], ['b7', '10:15', '11:00'], ['d1', '11:00', '11:45'], ['b8', '11:45', '12:30'], ['d5', '13:30', '15:00'], ['b5', '15:00', '15:45'], ['b1', '15:45', '16:45']],
    ],
  },
  {
    id: 'procurement',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'chase', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'work', kept: false },
      { id: 'b6', category: 'chase', kept: false },
      { id: 'b7', category: 'wait', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:15'], ['b4', '10:15', '11:30'], ['b3', '11:30', '12:15'], ['b5', '13:30', '15:00'], ['d2', '15:00', '15:45'], ['b6', '15:45', '16:45']],
      [['b1', '08:30', '09:15'], ['b6', '09:15', '10:00'], ['b7', '10:00', '10:30'], ['b4', '10:30', '12:00'], ['d1', '13:30', '14:15'], ['b2', '14:15', '15:00'], ['b8', '15:00', '16:00']],
      [['b1', '08:30', '09:30'], ['b5', '09:30', '11:00'], ['b3', '11:00', '11:45'], ['b6', '11:45', '12:30'], ['d3', '13:30', '15:00'], ['b2', '15:00', '15:45'], ['b7', '15:45', '16:15']],
      [['b1', '08:30', '09:15'], ['b2', '09:15', '10:00'], ['b4', '10:00', '11:15'], ['d2', '11:15', '12:00'], ['b8', '13:30', '14:30'], ['d4', '14:30', '15:30'], ['b6', '15:30', '16:30']],
      [['b1', '08:30', '09:30'], ['b6', '09:30', '10:15'], ['b7', '10:15', '10:45'], ['b5', '10:45', '12:15'], ['d5', '13:30', '14:30'], ['b2', '14:30', '15:15'], ['b8', '15:15', '16:15']],
    ],
  },
  {
    id: 'compliance',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'chase', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'work', kept: false },
      { id: 'b6', category: 'chase', kept: false },
      { id: 'b7', category: 'wait', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b1', '08:30', '09:45'], ['d1', '09:45', '10:30'], ['b2', '10:30', '11:15'], ['b3', '11:15', '12:00'], ['b4', '13:30', '15:00'], ['b6', '15:00', '15:45'], ['b8', '15:45', '16:45']],
      [['b5', '08:30', '10:00'], ['b2', '10:00', '10:45'], ['b4', '10:45', '12:15'], ['d2', '13:30', '14:15'], ['b7', '14:15', '15:00'], ['b6', '15:00', '15:45'], ['b8', '15:45', '16:30']],
      [['b1', '08:30', '09:30'], ['b4', '09:30', '11:00'], ['b3', '11:00', '11:30'], ['b2', '11:30', '12:15'], ['d3', '13:30', '14:30'], ['b5', '14:30', '16:00'], ['b6', '16:00', '16:45']],
      [['b5', '08:30', '09:45'], ['b2', '09:45', '10:30'], ['b7', '10:30', '11:15'], ['b4', '11:15', '12:30'], ['d4', '13:30', '15:00'], ['b8', '15:00', '16:00'], ['b6', '16:00', '16:45']],
      [['b1', '08:30', '09:30'], ['d2', '09:30', '10:15'], ['b4', '10:15', '11:30'], ['b3', '11:30', '12:00'], ['b8', '13:30', '14:30'], ['d5', '14:30', '16:00'], ['b2', '16:00', '16:45']],
    ],
  },
  {
    id: 'customerOps',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'work', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'chase', kept: false },
      { id: 'b6', category: 'work', kept: false },
      { id: 'b7', category: 'wait', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b1', '08:30', '09:45'], ['b2', '09:45', '10:45'], ['b3', '10:45', '11:15'], ['d1', '11:15', '12:00'], ['b6', '13:30', '14:45'], ['b5', '14:45', '15:30'], ['b4', '15:30', '16:30']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:30'], ['b5', '10:30', '11:15'], ['b7', '11:15', '11:45'], ['b4', '11:45', '12:30'], ['d2', '13:30', '14:15'], ['b6', '14:15', '15:30'], ['d5', '15:30', '16:30']],
      [['b1', '08:30', '09:30'], ['b6', '09:30', '10:45'], ['b3', '10:45', '11:30'], ['b2', '11:30', '12:30'], ['d1', '13:30', '14:15'], ['b5', '14:15', '15:00'], ['d3', '15:00', '15:45'], ['b4', '15:45', '16:45']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:30'], ['b5', '10:30', '11:15'], ['b6', '11:15', '12:30'], ['b7', '13:30', '14:00'], ['d4', '14:00', '15:30'], ['b4', '15:30', '16:30']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:15'], ['d1', '10:15', '11:00'], ['b6', '11:00', '12:00'], ['b8', '13:30', '15:00'], ['b5', '15:00', '15:45'], ['d5', '15:45', '16:30']],
    ],
  },
  {
    id: 'logistics',
    tasks: [
      { id: 'b1', category: 'work', kept: false },
      { id: 'b2', category: 'chase', kept: false },
      { id: 'b3', category: 'wait', kept: false },
      { id: 'b4', category: 'work', kept: false },
      { id: 'b5', category: 'work', kept: false },
      { id: 'b6', category: 'chase', kept: false },
      { id: 'b7', category: 'wait', kept: false },
      { id: 'b8', category: 'work', kept: false },
      { id: 'd1', category: 'decide', kept: true },
      { id: 'd2', category: 'decide', kept: true },
      { id: 'd3', category: 'decide', kept: true },
      { id: 'd4', category: 'decide', kept: true },
      { id: 'd5', category: 'decide', kept: true },
    ],
    schedule: [
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:30'], ['d1', '10:30', '11:15'], ['b4', '11:15', '12:30'], ['b5', '13:30', '14:15'], ['b6', '14:15', '15:00'], ['b3', '15:00', '15:45'], ['b4', '15:45', '16:30']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:15'], ['b7', '10:15', '10:45'], ['b4', '10:45', '12:00'], ['d2', '13:30', '14:00'], ['b5', '14:00', '14:45'], ['b6', '14:45', '15:45']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:30'], ['b3', '10:30', '11:15'], ['b4', '11:15', '12:30'], ['d3', '13:30', '14:30'], ['b8', '14:30', '16:00']],
      [['b1', '08:30', '09:30'], ['d1', '09:30', '10:15'], ['b2', '10:15', '11:00'], ['b4', '11:00', '12:15'], ['b6', '13:30', '14:15'], ['b7', '14:15', '14:45'], ['d4', '14:45', '16:00'], ['b5', '16:00', '16:45']],
      [['b1', '08:30', '09:30'], ['b2', '09:30', '10:15'], ['b4', '10:15', '11:30'], ['b3', '11:30', '12:00'], ['b6', '13:30', '14:15'], ['d5', '14:15', '15:45'], ['b5', '15:45', '16:30']],
    ],
  },
]
