import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import Toast, { useToast } from './Toast'

describe('Toast', () => {
  it('is present but not shown when closed, so it can fade out', () => {
    render(<Toast message="Saved" open={false} />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Saved')
    expect(toast).not.toHaveClass('show')
  })

  it('shows when open and announces politely', () => {
    render(<Toast message="Saved" open />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveClass('show')
    expect(toast).toHaveAttribute('aria-live', 'polite')
  })

  it('interrupts for errors', () => {
    render(<Toast message="Could not save" open error />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveClass('ui-toast--err')
    expect(toast).toHaveAttribute('aria-live', 'assertive')
  })
})

describe('useToast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts closed', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current[0]).toMatchObject({ open: false, message: '' })
  })

  it('opens with the message, then auto-dismisses', () => {
    const { result } = renderHook(() => useToast(1000))
    act(() => { result.current[1]('Saved') })
    expect(result.current[0]).toMatchObject({ open: true, message: 'Saved', error: false })

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current[0].open).toBe(false)
    // The message survives the close so the fade-out isn't blank.
    expect(result.current[0].message).toBe('Saved')
  })

  it('restarts the timer when a second toast arrives', () => {
    const { result } = renderHook(() => useToast(1000))
    act(() => { result.current[1]('First') })
    act(() => { vi.advanceTimersByTime(800) })
    act(() => { result.current[1]('Second', { error: true }) })

    // The first toast's pending timer must not close the second one early.
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current[0]).toMatchObject({ open: true, message: 'Second', error: true })

    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current[0].open).toBe(false)
  })

  it('clears its timer on unmount', () => {
    const { result, unmount } = renderHook(() => useToast(1000))
    act(() => { result.current[1]('Saved') })
    unmount()
    // A surviving timer would setState on an unmounted component.
    expect(() => act(() => { vi.advanceTimersByTime(2000) })).not.toThrow()
  })
})
