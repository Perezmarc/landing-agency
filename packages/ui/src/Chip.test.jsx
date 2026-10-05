import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Chip from './Chip'

describe('Chip', () => {
  it('renders the base class with no tone modifier by default', () => {
    render(<Chip>Free</Chip>)
    const chip = screen.getByText('Free')
    expect(chip).toHaveClass('ui-chip')
    expect(chip.className).toBe('ui-chip')
  })

  it('applies each tone', () => {
    const { rerender } = render(<Chip tone="good">A</Chip>)
    expect(screen.getByText('A')).toHaveClass('ui-chip', 'good')
    for (const tone of ['warn', 'bad', 'accent']) {
      rerender(<Chip tone={tone}>A</Chip>)
      expect(screen.getByText('A')).toHaveClass(tone)
    }
  })

  it('shows the status dot only when asked, and hides it from assistive tech', () => {
    const { container, rerender } = render(<Chip>Active</Chip>)
    expect(container.querySelector('.ui-dot')).toBeNull()
    rerender(<Chip dot tone="good">Active</Chip>)
    expect(container.querySelector('.ui-dot')).toHaveAttribute('aria-hidden', 'true')
  })
})
