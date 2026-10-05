import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card from './Card'

describe('Card', () => {
  it('renders a padded body with no header when given neither title nor actions', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.querySelector('.ui-card-h')).toBeNull()
    expect(container.querySelector('.ui-card-body')).toHaveTextContent('Content')
  })

  it('renders the header with title, sub and actions', () => {
    render(<Card title="Usage" sub="last 30 days" actions={<button type="button">Export</button>}>Body</Card>)
    expect(screen.getByText('Usage')).toHaveClass('ui-card-title')
    expect(screen.getByText('last 30 days')).toHaveClass('ui-card-sub')
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('renders a header for actions alone (a title is not required)', () => {
    const { container } = render(<Card actions={<span>A</span>}>Body</Card>)
    expect(container.querySelector('.ui-card-h')).toBeInTheDocument()
    expect(container.querySelector('.ui-card-title')).toBeNull()
  })

  it('drops the body padding when padded is false', () => {
    // Edge-to-edge content (tables, lists) must not sit inside the padded body.
    const { container } = render(<Card padded={false}><ul><li>Row</li></ul></Card>)
    expect(container.querySelector('.ui-card-body')).toBeNull()
    expect(screen.getByRole('listitem')).toHaveTextContent('Row')
  })

  it('renders as a <section> by default and honours `as`', () => {
    const { container, rerender } = render(<Card>Body</Card>)
    expect(container.querySelector('.ui-card').tagName).toBe('SECTION')
    rerender(<Card as="article">Body</Card>)
    expect(container.querySelector('.ui-card').tagName).toBe('ARTICLE')
  })
})
