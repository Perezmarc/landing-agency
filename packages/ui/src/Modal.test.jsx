import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} title="Confirm">Body</Modal>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible dialog named by its title', () => {
    render(<Modal open title="Delete project">Are you sure?</Modal>)
    const dialog = screen.getByRole('dialog', { name: 'Delete project' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Are you sure?')
  })

  it('moves focus into the dialog on open', () => {
    render(<Modal open title="Confirm">Body</Modal>)
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toHaveFocus()
  })

  it('closes on Escape, on the close button, and on backdrop click', async () => {
    const onClose = vi.fn()
    const { container, rerender } = render(<Modal open onClose={onClose} title="Confirm">Body</Modal>)

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    // A click that STARTS on the backdrop closes; one that starts inside must not
    // (otherwise dragging a text selection out of the dialog would dismiss it).
    rerender(<Modal open onClose={onClose} title="Confirm">Body</Modal>)
    await userEvent.click(container.querySelector('.ui-modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(3)

    await userEvent.click(screen.getByText('Body'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Modal open title="Confirm">Body</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Modal open={false} title="Confirm">Body</Modal>)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('traps Tab focus inside the dialog', async () => {
    render(
      <Modal open title="Confirm" footer={<button type="button">Save</button>}>
        <button type="button">First</button>
      </Modal>,
    )
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const save = screen.getByRole('button', { name: 'Save' })

    // Tab off the last focusable wraps to the first, rather than escaping to
    // the page behind the overlay.
    save.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('renders the footer only when given one', () => {
    const { container, rerender } = render(<Modal open title="Confirm">Body</Modal>)
    expect(container.querySelector('.ui-modal-foot')).toBeNull()
    rerender(<Modal open title="Confirm" footer={<span>Actions</span>}>Body</Modal>)
    expect(container.querySelector('.ui-modal-foot')).toHaveTextContent('Actions')
  })

  it('applies the size variant', () => {
    const { container } = render(<Modal open title="Confirm" size="lg">Body</Modal>)
    expect(container.querySelector('.ui-modal')).toHaveClass('ui-modal--lg')
  })
})
