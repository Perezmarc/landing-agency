import { forwardRef } from 'react'

/* Tabs — a tab set that works in static HTML with no JavaScript at all.

   It is a NATIVE RADIO GROUP, not an ARIA tablist. ARIA tabs (role=tablist /
   tab / tabpanel) promise keyboard behaviour that only script can deliver, and
   role=tab is not a valid role on a radio input. A <fieldset> of radios gets
   everything for free: the legend names the group, each <label> names its
   radio, arrow keys move the selection, and the checked state survives a
   reload. CSS (kit.css, TABS) shows the panel whose radio is checked with
   `:has()`; browsers without `:has()` show every panel, so nothing is ever
   unreachable.

   How it differs from SegmentedControl: SegmentedControl is CONTROLLED
   (value + onChange) and measures its sliding pill at runtime, so it needs
   hydration to do anything. Tabs is UNCONTROLLED — `defaultValue` only — and
   does its whole job in the rendered HTML. Use Tabs on static pages; use
   SegmentedControl inside hydrated UI that owns the state. Script that wants
   to react to a switch (the site's motion code) listens for `change` on
   `[data-ui-tabs]`, which every radio bubbles to.

   Props:
     name         — required; the radios' shared name and the id prefix
     legend       — the group's accessible name (visually hidden: the page
                    shows its own heading)
     items        — [{ value, label, panel }], at most 8 (the CSS selects
                    panels by position and covers eight)
     defaultValue — the initially checked value; defaults to the first item's
     className    — extra classes on the <fieldset>

   The ref is forwarded to the <fieldset>. */

export const TABS_MAX_ITEMS = 8

const Tabs = forwardRef(function Tabs(
  { name, legend, items = [], defaultValue, className = '' },
  ref,
) {
  if (!name) throw new Error('Tabs: `name` is required (it names the radios and prefixes their ids).')
  if (items.length > TABS_MAX_ITEMS) {
    throw new Error(`Tabs: at most ${TABS_MAX_ITEMS} items are supported, got ${items.length}.`)
  }

  const selected = defaultValue ?? items[0]?.value
  const idOf = (value) => `${name}-${value}`
  const cls = ['ui-tabs', className].filter(Boolean).join(' ')

  return (
    <fieldset ref={ref} className={cls} data-ui-tabs="">
      <legend className="ui-tabs-legend">{legend}</legend>
      <div className="ui-tabs-strip">
        {items.map(({ value, label }) => (
          <TabsTab key={value} name={name} id={idOf(value)} value={value} label={label} checked={value === selected} />
        ))}
      </div>
      <div className="ui-tabs-panels">
        {items.map(({ value, panel }) => (
          <div key={value} className="ui-tabs-panel" data-value={value} aria-labelledby={`${idOf(value)}-tab`}>
            {panel}
          </div>
        ))}
      </div>
    </fieldset>
  )
})

/* One radio + its label. A fragment, because the CSS relies on the label being
   the radio's immediate next sibling (`.ui-tabs-input:checked + .ui-tabs-tab`). */
function TabsTab({ name, id, value, label, checked }) {
  return (
    <>
      <input className="ui-tabs-input" type="radio" name={name} id={id} value={value} defaultChecked={checked} />
      <label className="ui-tabs-tab" htmlFor={id} id={`${id}-tab`}>{label}</label>
    </>
  )
}

export default Tabs
