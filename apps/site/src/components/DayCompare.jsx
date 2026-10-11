import { Tabs } from '@forge/ui'
import { DAY, TEAMS, minutes } from '../data/day.js'

/* "A day, before and after" — six team tabs, each a pair of calendars on one
   time axis.

   Rendered at BUILD time (no client directive), so the server HTML is the
   final state and needs no JavaScript: the kit's Tabs are native radios and
   CSS shows the checked team's panel. motion/calendar.js only animates on top.

   It is a React tree rather than Astro slots on purpose: Astro wraps slotted
   children in <astro-static-slot>, which breaks the Tabs' child selectors.

   Positioning is data, so it goes inline as custom properties: --start and
   --len are minutes from the start of the day. The pixel scale (--min-px) is
   responsive and lives on the class in marketing.css.

   The AFTER calendar contains the BEFORE blocks that move, so the animation
   has real elements to carry across: agent-bound blocks render into the
   Agent lane, waiting blocks are present but gone (.blk--gone, aria-hidden),
   and the decisions only exist here. Nothing on the AFTER card may carry an
   opacity, filter, mask or will-change on an ancestor, or its
   backdrop-filter stops seeing the stream behind it. */

const DAY_START = minutes(DAY.start)
const DAY_LEN = minutes(DAY.end) - DAY_START

function clock(hhmm, locale) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
    .format(Date.UTC(2026, 0, 1, h, m))
}

const pos = block => ({ '--start': minutes(block.start) - DAY_START, '--len': minutes(block.end) - minutes(block.start) })

function Hours({ locale }) {
  const hours = []
  for (let m = Math.ceil(DAY_START / 60) * 60; m < DAY_START + DAY_LEN; m += 60) {
    const hhmm = `${String(m / 60).padStart(2, '0')}:00`
    hours.push(<span key={m} className="mk-cal-hour" style={{ '--start': m - DAY_START }}>{clock(hhmm, locale)}</span>)
  }
  return <div className="mk-cal-hours" aria-hidden="true">{hours}</div>
}

function Block({ block, label, copy, locale, className = '', hidden = false }) {
  return (
    <li className={`blk blk--${block.kind} ${className}`} data-blk={block.id} style={pos(block)} aria-hidden={hidden || undefined}>
      <span className="blk-fill" aria-hidden="true"></span>
      <span className="blk-label">
        <span className="sr-only">{copy.kinds[block.kind]}, {clock(block.start, locale)}–{clock(block.end, locale)}: </span>
        {label}
      </span>
    </li>
  )
}

function Panel({ team, copy, locale }) {
  const text = copy.teams[team.id]
  const before = team.blocks.filter(b => b.before !== false)
  const label = b => text.blocks[b.id]
  return (
    <div className="mk-day-panel">
      <p className="mk-day-role">{text.role}</p>
      <p className="mk-day-note">{copy.note}</p>
      <div className="mk-day-cals">
        <section className="mk-cal mk-cal--before" aria-label={copy.beforeTitle}>
          <h3 className="mk-cal-title">{copy.beforeTitle}</h3>
          <div className="mk-cal-body">
            <Hours locale={locale} />
            <ol className="mk-cal-track">
              {before.map(b => <Block key={b.id} block={b} label={label(b)} copy={copy} locale={locale} />)}
            </ol>
          </div>
        </section>

        <section className="mk-cal mk-cal--after" aria-label={copy.afterTitle} data-day-after="">
          <h3 className="mk-cal-title">{copy.afterTitle}</h3>
          <div className="mk-cal-lanes" aria-hidden="true">
            <span>{copy.personLane}</span>
            <span>{copy.agentLane}</span>
          </div>
          <div className="mk-cal-body">
            <Hours locale={locale} />
            <ol className="mk-cal-track">
              {team.blocks.filter(b => b.after === 'person').map(b => (
                <Block key={b.id} block={b} label={label(b)} copy={copy} locale={locale} className="blk--person" />
              ))}
              {team.blocks.filter(b => b.after === 'agent').map(b => (
                <Block key={b.id} block={b} label={label(b)} copy={copy} locale={locale} className="blk--agent" hidden />
              ))}
              {team.blocks.filter(b => b.after === 'gone').map(b => (
                <Block key={b.id} block={b} label={label(b)} copy={copy} locale={locale} className="blk--gone" hidden />
              ))}
            </ol>
          </div>
          <div className="mk-cal-agent">
            <h4 className="mk-cal-agent-title">{copy.agentList}</h4>
            <ul>{team.agent.map(id => <li key={id}>{text.blocks[id]}</li>)}</ul>
          </div>
        </section>
      </div>
    </div>
  )
}

/** @param {{ copy: object, locale: string }} props — copy is home.day from the locale's catalog */
export default function DayCompare({ copy, locale }) {
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
