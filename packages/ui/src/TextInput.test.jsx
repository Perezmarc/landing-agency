import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TextInput from './TextInput'

// The single text-field component. Every text/email/search/number field in the
// app routes through here, so its class contract and ref forwarding are pinned.

describe('TextInput', () => {
  it('renders an <input> with the base class', () => {
    render(<TextInput placeholder="Name" />)
    const input = screen.getByPlaceholderText('Name')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveClass('ui-input')
    expect(input).not.toHaveClass('ui-input--lg', 'ui-input--error')
  })

  it('adds the large variant only when `lg` is set', () => {
    const { rerender } = render(<TextInput placeholder="Name" />)
    expect(screen.getByPlaceholderText('Name')).not.toHaveClass('ui-input--lg')
    rerender(<TextInput placeholder="Name" lg />)
    expect(screen.getByPlaceholderText('Name')).toHaveClass('ui-input', 'ui-input--lg')
  })

  it('marks the error state for CSS and for assistive tech', () => {
    render(<TextInput placeholder="Email" error />)
    const input = screen.getByPlaceholderText('Email')
    expect(input).toHaveClass('ui-input--error')
    // The visual treatment alone doesn't tell a screen reader anything.
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('omits aria-invalid when there is no error', () => {
    render(<TextInput placeholder="Email" />)
    expect(screen.getByPlaceholderText('Email')).not.toHaveAttribute('aria-invalid')
  })

  it('renders a <textarea> with the same look when multiline', () => {
    render(<TextInput multiline placeholder="Notes" rows={4} />)
    const field = screen.getByPlaceholderText('Notes')
    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveClass('ui-input')
    expect(field).toHaveAttribute('rows', '4')
  })

  it('appends className after the base classes', () => {
    render(<TextInput placeholder="Name" className="w-full" />)
    expect(screen.getByPlaceholderText('Name')).toHaveClass('ui-input', 'w-full')
  })

  it('forwards the ref and arbitrary input props', () => {
    const ref = createRef()
    render(<TextInput ref={ref} type="email" name="email" required placeholder="Email" />)
    expect(ref.current.tagName).toBe('INPUT')
    expect(ref.current).toHaveAttribute('type', 'email')
    expect(ref.current).toHaveAttribute('name', 'email')
    expect(ref.current).toBeRequired()
  })

  it('is a controlled input when given value + onChange', async () => {
    const onChange = vi.fn()
    render(<TextInput value="" onChange={onChange} placeholder="Name" />)
    await userEvent.type(screen.getByPlaceholderText('Name'), 'a')
    expect(onChange).toHaveBeenCalled()
  })
})
