import { describe, it, expect, vi } from 'vitest'
import { createRef, forwardRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

// The shared UI-kit <Button>: a .btn-wrap → .btn (+ variant + size) → .btn-text
// + .btn-shadow stack. It renders a <button> (actions) or an <a> (navigation)
// via `as` / `href` / `to`.

describe('Button', () => {
  it('renders the glass appearance + family scaffolding by default', () => {
    const { container } = render(<Button>Go</Button>)
    const btn = screen.getByRole('button', { name: 'Go' })
    expect(btn).toHaveClass('btn', 'btn--glass', 'btn--default')
    expect(btn).toHaveAttribute('type', 'button')
    const wrap = container.querySelector('.btn-wrap')
    expect(wrap).toContainElement(btn)
    expect(wrap.querySelector('.btn-text')).toHaveTextContent('Go')
    expect(wrap.querySelector('.btn-shadow')).toBeInTheDocument()
  })

  it('applies each role variant, and the aliases that fold into dark', () => {
    const { rerender } = render(<Button variant="cta">C</Button>)
    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('btn--cta')
    for (const variant of ['white', 'secondary', 'ghost', 'danger']) {
      rerender(<Button variant={variant}>V</Button>)
      expect(screen.getByRole('button', { name: 'V' })).toHaveClass(`btn--${variant}`)
    }
    for (const alias of ['dark', 'black', 'primary']) {
      rerender(<Button variant={alias}>A</Button>)
      expect(screen.getByRole('button', { name: 'A' })).toHaveClass('btn--dark')
    }
  })

  it('maps size "md" to "default" and applies the size on element + text', () => {
    const { rerender, container } = render(<Button size="md">M</Button>)
    expect(screen.getByRole('button', { name: 'M' })).toHaveClass('btn--default')
    expect(container.querySelector('.btn-text')).toHaveClass('btn-text--default')
    rerender(<Button size="lg">M</Button>)
    expect(screen.getByRole('button', { name: 'M' })).toHaveClass('btn--lg')
    expect(container.querySelector('.btn-text')).toHaveClass('btn-text--lg')
  })

  it('is squared by default and opts into the pill only when `pill` is set', () => {
    // The default shape is the design-system control radius (squared); the pill
    // is the marketing register, opted into per call site.
    const { rerender } = render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).not.toHaveClass('btn--pill')
    rerender(<Button pill>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('btn--pill')
  })

  it('adds glare and on-dark only when asked', () => {
    const { rerender, container } = render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).not.toHaveClass('btn--glare')
    expect(container.querySelector('.btn-wrap')).not.toHaveClass('is-on-dark')
    rerender(<Button glare onDark>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('btn--glare')
    expect(container.querySelector('.btn-wrap')).toHaveClass('is-on-dark')
  })

  it('renders an <a> when given href, and keeps link attributes', () => {
    render(<Button href="https://example.com" target="_blank" rel="noreferrer">Docs</Button>)
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    // Links must never pick up the <button> type attribute.
    expect(link).not.toHaveAttribute('type')
  })

  it('passes `to` to a component but never to a DOM element', () => {
    const Link = forwardRef(function Link({ to, children, ...rest }, ref) {
      return <a ref={ref} href={to} data-testid="router-link" {...rest}>{children}</a>
    })
    const { rerender, container } = render(<Button as={Link} to="/pricing">Pricing</Button>)
    expect(screen.getByTestId('router-link')).toHaveAttribute('href', '/pricing')

    // `to` is a router concept; on a real <a> it would be an invalid attribute.
    // (Queried by text, not by role: an <a> without href has no link role.)
    rerender(<Button as="a" to="/pricing">Pricing</Button>)
    expect(container.querySelector('a')).not.toHaveAttribute('to')
  })

  it('renders `plain` bare, with no kit chrome', () => {
    const { container } = render(<Button variant="plain" className="custom">Bare</Button>)
    const btn = screen.getByRole('button', { name: 'Bare' })
    expect(btn).toHaveClass('custom')
    expect(btn).not.toHaveClass('btn')
    expect(container.querySelector('.btn-wrap')).toBeNull()
    expect(container.querySelector('.btn-shadow')).toBeNull()
  })

  it('keeps an explicit type (so it can submit a form)', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
  })

  it('forwards the ref to the interactive element, not the wrap', () => {
    const ref = createRef()
    render(<Button ref={ref}>Go</Button>)
    expect(ref.current.tagName).toBe('BUTTON')
    expect(ref.current).toHaveClass('btn')
  })

  it('fires onClick, and does not when disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button onClick={onClick} disabled>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('puts className on the wrap and contentClassName on the text span', () => {
    const { container } = render(<Button className="wrap-x" contentClassName="text-x">Go</Button>)
    expect(container.querySelector('.btn-wrap')).toHaveClass('wrap-x')
    expect(container.querySelector('.btn-text')).toHaveClass('text-x')
  })

  it('renders leading and trailing icons inside the text layer', () => {
    const { container } = render(
      <Button icon={<span data-testid="lead" />} iconRight={<span data-testid="trail" />}>Go</Button>,
    )
    const text = container.querySelector('.btn-text')
    expect(text).toContainElement(screen.getByTestId('lead'))
    expect(text).toContainElement(screen.getByTestId('trail'))
  })

  it('makes the WRAP full-width for `block` (the element is always 100%)', () => {
    // Documented hazard: a block button inside a flex row crushes its siblings,
    // because it is the wrap — not the button — that goes full-width.
    const { container } = render(<Button block>Go</Button>)
    expect(container.querySelector('.btn-wrap')).toHaveClass('btn-wrap--block')
  })
})

describe('named icons', () => {
  it('renders an icon given by name', () => {
    // .astro templates are not JSX and cannot pass `iconRight={<Ico/>}`, so the
    // marketing site names its icons instead of wrapping the kit's Button.
    const { container } = render(<Button iconRightName="arrowRight">Next</Button>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders both a leading and a trailing named icon', () => {
    const { container } = render(<Button iconName="check" iconRightName="arrowRight">Both</Button>)
    expect(container.querySelectorAll('svg')).toHaveLength(2)
  })

  it('prefers a passed node over a name', () => {
    const { container } = render(
      <Button icon={<span data-testid="node" />} iconName="check">Either</Button>,
    )
    expect(container.querySelector('[data-testid="node"]')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('renders no icon when neither is given', () => {
    const { container } = render(<Button>Bare</Button>)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('carries named icons through the plain variant too', () => {
    const { container } = render(<Button variant="plain" iconName="check">Plain</Button>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
