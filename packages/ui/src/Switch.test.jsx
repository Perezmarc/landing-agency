import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Switch from './Switch'

// The switch must be a real button with role="switch" — a styled <div> would
// be invisible to keyboard and screen-reader users.

describe('Switch', () => {
  it('exposes role="switch" and the current state', () => {
    const { rerender } = render(<Switch checked={false} aria-label="Notifications" />)
    const toggle = screen.getByRole('switch', { name: 'Notifications' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).not.toHaveClass('on')

    rerender(<Switch checked aria-label="Notifications" />)
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Notifications' })).toHaveClass('on')
  })

  it('calls onChange with the NEXT value, not the current one', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<Switch checked={false} onChange={onChange} aria-label="N" />)
    await userEvent.click(screen.getByRole('switch', { name: 'N' }))
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(<Switch checked onChange={onChange} aria-label="N" />)
    await userEvent.click(screen.getByRole('switch', { name: 'N' }))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('is operable from the keyboard', async () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} aria-label="N" />)
    await userEvent.tab()
    expect(screen.getByRole('switch', { name: 'N' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not fire while disabled', async () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} disabled aria-label="N" />)
    await userEvent.click(screen.getByRole('switch', { name: 'N' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies the small size class', () => {
    render(<Switch size="sm" aria-label="N" />)
    expect(screen.getByRole('switch', { name: 'N' })).toHaveClass('ui-switch--sm')
  })

  it('never submits a surrounding form', () => {
    render(<Switch aria-label="N" />)
    expect(screen.getByRole('switch', { name: 'N' })).toHaveAttribute('type', 'button')
  })
})
