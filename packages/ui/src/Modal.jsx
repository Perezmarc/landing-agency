import { useEffect, useRef } from 'react'

/* Modal — the shared UI-kit dialog: a centred card over a dimmed,
   click-to-close overlay. Every dialog in the product uses this rather than an
   ad-hoc overlay, so the focus trap and Esc handling are written once.

   Behaviour: renders nothing when !open; on open it locks body scroll, focuses
   the card, closes on Esc and on backdrop click, and traps Tab focus inside.
   Uses role="dialog" + aria-modal and labels itself from `title`.

   Props:
     open       — whether the dialog is shown
     onClose()  — called on Esc, backdrop click, or the close button
     title      — heading text (also the accessible name)
     children   — dialog body
     footer     — optional node pinned to the bottom action row
     size       — 'md' (default) | 'lg'
     className  — extra class on the dialog card */
export default function Modal({ open, onClose, title, children, footer, size = 'md', className = '' }) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const card = cardRef.current
    card?.focus()

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return }
      if (e.key !== 'Tab' || !card) return
      const focusables = card.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="ui-modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={cardRef}
        className={`ui-modal ui-modal--${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="ui-modal-head">
          <div className="ui-modal-title">{title}</div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
