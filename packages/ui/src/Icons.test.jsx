import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Ico, ICONS } from './Icons'

describe('Ico', () => {
  it('renders every icon in the set at the requested size', () => {
    // A registry entry that doesn't render is a broken icon nobody notices
    // until it's used on a page — check the whole set, not a sample.
    for (const name of Object.keys(ICONS)) {
      const { container, unmount } = render(<Ico name={name} size={20} />)
      const svg = container.querySelector('svg')
      expect(svg, `icon "${name}" rendered nothing`).toBeInTheDocument()
      expect(svg).toHaveAttribute('width', '20')
      expect(svg.children.length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('inherits colour so it reads on any surface', () => {
    const { container } = render(<Ico name="check" />)
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor')
  })

  it('is decorative by default', () => {
    const { container } = render(<Ico name="check" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders nothing for an unknown name instead of throwing', () => {
    const { container } = render(<Ico name="not-a-real-icon" />)
    expect(container).toBeEmptyDOMElement()
  })
})
