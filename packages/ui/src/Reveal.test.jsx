import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Reveal from './Reveal'

const realIO = globalThis.IntersectionObserver

afterEach(() => { globalThis.IntersectionObserver = realIO })

describe('Reveal', () => {
  it('reveals immediately when IntersectionObserver is unavailable', () => {
    // Content must never depend on an animation to become visible — an
    // environment without the observer (older browsers, SSR, jsdom) has to see
    // the content, not an invisible page.
    globalThis.IntersectionObserver = undefined
    render(<Reveal>Feature</Reveal>)
    expect(screen.getByText('Feature')).toHaveClass('mk-reveal', 'is-in')
  })

  it('starts hidden and reveals once the element intersects', () => {
    let trigger
    const disconnect = vi.fn()
    globalThis.IntersectionObserver = class {
      constructor(cb) { trigger = cb }
      observe() {}
      disconnect = disconnect
    }

    render(<Reveal>Feature</Reveal>)
    expect(screen.getByText('Feature')).not.toHaveClass('is-in')

    act(() => trigger([{ isIntersecting: true }]))
    expect(screen.getByText('Feature')).toHaveClass('is-in')
    // One-shot: a long landing page must not keep dozens of observers alive.
    expect(disconnect).toHaveBeenCalled()
  })

  it('stays hidden while the element is out of view', () => {
    let trigger
    globalThis.IntersectionObserver = class {
      constructor(cb) { trigger = cb }
      observe() {}
      disconnect() {}
    }
    render(<Reveal>Feature</Reveal>)
    act(() => trigger([{ isIntersecting: false }]))
    expect(screen.getByText('Feature')).not.toHaveClass('is-in')
  })

  it('honours the `as` element and extra classes', () => {
    globalThis.IntersectionObserver = undefined
    render(<Reveal as="section" className="mk-section">Feature</Reveal>)
    const el = screen.getByText('Feature')
    expect(el.tagName).toBe('SECTION')
    expect(el).toHaveClass('mk-reveal', 'mk-section')
  })
})
