import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IconButton from './IconButton'
import { Ico } from './Icons'

describe('IconButton', () => {
  it('renders a non-submitting button with the base class', () => {
    render(<IconButton aria-label="Delete"><Ico name="trash" /></IconButton>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn).toHaveClass('ui-icon-btn')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('applies the small and danger modifiers', () => {
    render(<IconButton small danger aria-label="Delete" />)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('ui-icon-btn', 'small', 'danger')
  })

  it('fires onClick, and does not when disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<IconButton onClick={onClick} aria-label="Delete" />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<IconButton onClick={onClick} disabled aria-label="Delete" />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('forwards the ref', () => {
    const ref = createRef()
    render(<IconButton ref={ref} aria-label="Delete" />)
    expect(ref.current.tagName).toBe('BUTTON')
  })
})
