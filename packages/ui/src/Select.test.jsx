import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Select from './Select'

describe('Select', () => {
  function renderSelect(props = {}) {
    return render(
      <Select aria-label="Plan" {...props}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </Select>,
    )
  }

  it('renders a native <select> with the base class and its options', () => {
    renderSelect()
    const select = screen.getByRole('combobox', { name: 'Plan' })
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveClass('ui-select')
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('marks the error state for CSS and for assistive tech', () => {
    renderSelect({ error: true })
    const select = screen.getByRole('combobox', { name: 'Plan' })
    expect(select).toHaveClass('ui-select--error')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('reports the chosen value on change', async () => {
    const onChange = vi.fn()
    // Uncontrolled on purpose: a controlled <select> whose value prop never
    // moves is reset by React before the assertion reads it back.
    renderSelect({ defaultValue: 'free', onChange })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Plan' }), 'pro')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0].target.value).toBe('pro')
  })

  it('forwards the ref and the disabled attribute', () => {
    const ref = createRef()
    renderSelect({ ref, disabled: true })
    expect(ref.current.tagName).toBe('SELECT')
    expect(ref.current).toBeDisabled()
  })
})
