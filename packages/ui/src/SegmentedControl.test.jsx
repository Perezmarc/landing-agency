import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SegmentedControl from './SegmentedControl'

const TABS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

describe('SegmentedControl', () => {
  it('renders a tablist with one tab per option', () => {
    render(<SegmentedControl tabs={TABS} value="month" label="Billing period" />)
    expect(screen.getByRole('tablist', { name: 'Billing period' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('marks only the active tab as selected', () => {
    render(<SegmentedControl tabs={TABS} value="year" />)
    expect(screen.getByRole('tab', { name: 'Monthly' })).toHaveAttribute('aria-selected', 'false')
    const active = screen.getByRole('tab', { name: 'Yearly' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active).toHaveClass('seg-tab-active')
    // The sliding pill measures the tab flagged with data-active.
    expect(active).toHaveAttribute('data-active', 'true')
  })

  it('reports the clicked value', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl tabs={TABS} value="month" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }))
    expect(onChange).toHaveBeenCalledWith('year')
  })

  it('does not fire while disabled', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl tabs={TABS} value="month" onChange={onChange} disabled />)
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('tablist')).toHaveClass('is-disabled')
  })

  it('renders an optional icon alongside the label', () => {
    render(
      <SegmentedControl
        tabs={[{ value: 'a', label: 'A', icon: <span data-testid="icon" /> }]}
        value="a"
      />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('tolerates a value that matches no tab (nothing selected)', () => {
    // Guards the pill-measuring effect, which has to cope with no active tab.
    render(<SegmentedControl tabs={TABS} value="quarterly" />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false')
    }
  })
})
