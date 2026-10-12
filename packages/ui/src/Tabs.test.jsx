import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tabs from './Tabs'

// The static-HTML tab set. It is a native radio group so it works without
// JavaScript; these tests pin the accessible structure, the uncontrolled
// default, the id wiring the panels and CSS rely on, and the ref contract.

const ITEMS = [
  { value: 'finance', label: 'Finance', panel: <p>Finance panel</p> },
  { value: 'revops', label: 'Revenue ops', panel: <p>Revenue ops panel</p> },
  { value: 'support', label: 'Customer ops', panel: <p>Customer ops panel</p> },
]

const renderTabs = (props = {}) =>
  render(<Tabs name="team" legend="Pick a team" items={ITEMS} {...props} />)

describe('Tabs', () => {
  it('is a radio group named by its legend', () => {
    renderTabs()
    const group = screen.getByRole('group', { name: 'Pick a team' })
    expect(group.tagName).toBe('FIELDSET')
    expect(group).toHaveClass('ui-tabs')
    expect(group).toHaveAttribute('data-ui-tabs')
    expect(screen.getByText('Pick a team', { selector: 'legend' })).toHaveClass('ui-tabs-legend')
  })

  it('renders one radio per item, each named by its label and sharing `name`', () => {
    renderTabs()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(ITEMS.length)
    for (const { value, label } of ITEMS) {
      const radio = screen.getByRole('radio', { name: label })
      expect(radio).toHaveClass('ui-tabs-input')
      expect(radio).toHaveAttribute('name', 'team')
      expect(radio).toHaveAttribute('value', value)
      expect(radio).toHaveAttribute('id', `team-${value}`)
      // The CSS selects the label as the radio's immediate next sibling.
      expect(radio.nextElementSibling).toHaveClass('ui-tabs-tab')
      expect(radio.nextElementSibling).toHaveAttribute('id', `team-${value}-tab`)
    }
  })

  it('checks the first item when no defaultValue is given', () => {
    renderTabs()
    expect(screen.getByRole('radio', { name: 'Finance' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Revenue ops' })).not.toBeChecked()
  })

  it('checks the defaultValue item', () => {
    renderTabs({ defaultValue: 'support' })
    expect(screen.getByRole('radio', { name: 'Customer ops' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Finance' })).not.toBeChecked()
  })

  it('checks a radio when its label is clicked, and fires a bubbling change', async () => {
    const onChange = vi.fn()
    renderTabs()
    screen.getByRole('group').addEventListener('change', onChange)
    await userEvent.click(screen.getByText('Revenue ops', { selector: 'label' }))
    expect(screen.getByRole('radio', { name: 'Revenue ops' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Finance' })).not.toBeChecked()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('renders every panel with data-value and aria-labelledby pointing at its label', () => {
    const { container } = renderTabs()
    const panels = container.querySelectorAll('.ui-tabs-panels > .ui-tabs-panel')
    expect(panels).toHaveLength(ITEMS.length)
    panels.forEach((panel, i) => {
      expect(panel).toHaveAttribute('data-value', ITEMS[i].value)
      const label = document.getElementById(panel.getAttribute('aria-labelledby'))
      expect(label).not.toBeNull()
      expect(label.tagName).toBe('LABEL')
      expect(label).toHaveTextContent(ITEMS[i].label)
    })
    expect(screen.getByText('Revenue ops panel')).toBeInTheDocument()
  })

  it('appends className after the base class', () => {
    renderTabs({ className: 'mk-process-tabs' })
    expect(screen.getByRole('group')).toHaveClass('ui-tabs', 'mk-process-tabs')
  })

  it('forwards the ref to the fieldset', () => {
    const ref = createRef()
    render(<Tabs ref={ref} name="team" legend="Pick a team" items={ITEMS} />)
    expect(ref.current.tagName).toBe('FIELDSET')
    expect(ref.current).toBe(screen.getByRole('group'))
  })

  // The guards run before any markup, so they are checked against the
  // component's render function directly; rendering a throwing component in
  // jsdom would only add uncaught-error noise to the run.
  it('throws above eight items, because the CSS only covers eight positions', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ value: `v${i}`, label: `L${i}`, panel: null }))
    expect(() => Tabs.render({ name: 'many', legend: 'Many', items: nine }, null)).toThrow(/at most 8/)
    render(<Tabs name="ok" legend="Eight" items={nine.slice(0, 8)} />)
    expect(screen.getAllByRole('radio')).toHaveLength(8)
  })

  it('throws without a name', () => {
    expect(() => Tabs.render({ legend: 'Unnamed', items: ITEMS }, null)).toThrow(/`name` is required/)
  })
})
