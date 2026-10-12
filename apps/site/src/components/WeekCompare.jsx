import { Tabs } from '@forge/ui'
import { WEEK, TEAMS, minutes, occurrences } from '../data/week.js'

/* "A week, before and after" — six team tabs, each a pair of calendars on one
   time axis: BEFORE with every task of the week, AFTER with only the tasks
   the person keeps, in exactly the same slots. The empty slots are the point.

   Rendered at BUILD time (no client directive), so the server HTML is the
   final state and needs no JavaScript: the kit's Tabs are native radios and
   CSS shows the checked team's panel. CSS also decides week or day: five day
   columns on desktop and tablet, the first one alone on a phone.
   motion/calendar.js only animates on top.

   It is a React tree rather than Astro slots on purpose: Astro wraps slotted
   children in <astro-static-slot>, which breaks the Tabs' child selectors.

   Positioning is data, so it goes inline as custom properties: --start and
   --len are minutes from the start of the day, --lines is how many label
   lines the chip holds (one 15-minute slot is one line in marketing.css, so
   it depends on the duration only, never on the screen). */

const DAY_START = minutes(WEEK.start)
const DAY_LEN = minutes(WEEK.end) - DAY_START

// 5 January 2026 is a Monday. UTC on both sides, so the build machine's zone never shifts it.
const MONDAY = Date.UTC(2026, 0, 5)
const weekday = (locale, day) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(MONDAY + day * 86400000)

function clock(hhmm, locale) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
    .format(Date.UTC(2026, 0, 1, h, m))
}

function place(o) {
  const len = minutes(o.end) - minutes(o.start)
  return { '--start': minutes(o.start) - DAY_START, '--len': len, '--lines': Math.max(1, len / WEEK.step - 1) }
}

function Hours({ locale }) {
  const hours = []
  for (let m = Math.ceil(DAY_START / 60) * 60; m < DAY_START + DAY_LEN; m += 60) {
    const hhmm = `${String(m / 60).padStart(2, '0')}:00`
    hours.push(<span key={m} className="mk-cal-hour" style={{ '--start': m - DAY_START }}>{clock(hhmm, locale)}</span>)
  }
  return <div className="mk-cal-hours" aria-hidden="true">{hours}</div>
}

function Task({ o, task, label, copy, locale }) {
  return (
    <li className={`mk-task mk-task--${task.category}`} data-task={task.id} data-kept={String(task.kept)} style={place(o)}>
      <span className="mk-task-label">
        <span className="sr-only">{copy.kinds[task.category]}, {clock(o.start, locale)}–{clock(o.end, locale)}: </span>
        {label}
      </span>
    </li>
  )
}

/** One calendar card. `keep` filters the occurrences it draws. */
function Calendar({ team, copy, locale, title, variant, keep }) {
  const byId = Object.fromEntries(team.tasks.map(t => [t.id, t]))
  const labels = copy.teams[team.id].blocks
  const days = Array.from({ length: WEEK.days }, (_, day) => occurrences(team).filter(o => o.day === day && keep(byId[o.task])))
  const id = `cal-${team.id}-${variant}`
  return (
    <section className={`mk-cal mk-cal--${variant}`} aria-labelledby={id} data-cal={variant}>
      <h3 className="mk-cal-title" id={id}>{title}</h3>
      <div className="mk-cal-grid">
        <Hours locale={locale} />
        {days.map((list, day) => (
          <div key={day} className="mk-cal-day" data-weekday={day}>
            <p className="mk-cal-dayname" id={`${id}-${day}`}>{weekday(locale, day)}</p>
            <ol className="mk-cal-track" aria-labelledby={`${id}-${day}`}>
              {list.map(o => (
                <Task key={`${o.task}-${o.start}`} o={o} task={byId[o.task]} label={labels[o.task]} copy={copy} locale={locale} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

function Legend({ copy }) {
  return (
    <ul className="mk-cal-legend">
      {Object.entries(copy.kinds).map(([category, name]) => (
        <li key={category} className={`mk-cal-key mk-task--${category}`}>{name}</li>
      ))}
    </ul>
  )
}

function Panel({ team, copy, locale }) {
  const text = copy.teams[team.id]
  return (
    <div className="mk-day-panel">
      <div className="mk-day-meta">
        <div>
          <p className="mk-day-role">{text.role}</p>
          <p className="mk-day-note">{copy.note}</p>
        </div>
        <Legend copy={copy} />
      </div>
      <div className="mk-day-cals">
        <Calendar team={team} copy={copy} locale={locale} title={copy.beforeTitle} variant="before" keep={() => true} />
        <Calendar team={team} copy={copy} locale={locale} title={copy.afterTitle} variant="after" keep={task => task.kept} />
      </div>
    </div>
  )
}

/** @param {{ copy: object, locale: string }} props — copy is home.day from the locale's catalog */
export default function WeekCompare({ copy, locale }) {
  return (
    <Tabs
      name="day"
      legend={copy.teamLegend}
      className="mk-day-tabs"
      items={TEAMS.map(team => ({
        value: team.id,
        label: copy.teams[team.id].name,
        panel: <Panel team={team} copy={copy} locale={locale} />,
      }))}
    />
  )
}
