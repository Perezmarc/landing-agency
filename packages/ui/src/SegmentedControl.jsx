import { useRef, useState, useLayoutEffect } from 'react'

/**
 * SegmentedControl — a row of mutually exclusive options with an animated
 * sliding pill. The kit's answer to "a group of two-to-four choices": use it
 * instead of a <Select> when every option should be visible at once, and
 * instead of styled radio buttons.
 *
 * The pill's width and offset are MEASURED from the active tab and applied as
 * inline `width`/`transform`. That is the one place inline style is correct
 * here: the values are computed at runtime and cannot be expressed in CSS.
 * Everything visual lives in kit.css.
 *
 * Props:
 *   tabs     — array of { value, label, icon? (JSX) }
 *   value    — the active value
 *   onChange(value) — called on tab click
 *   disabled — disables every tab (e.g. while saving)
 *   label    — accessible name for the group (rendered as aria-label)
 *   className — optional extra class on the container
 */
export default function SegmentedControl({
  tabs,
  value,
  onChange,
  disabled = false,
  label,
  className = '',
}) {
  const containerRef = useRef(null)
  const [pill, setPill] = useState({ width: 0, x: 0, opacity: 0 })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const active = container.querySelector('[data-active="true"]')
    if (!active) { setPill(p => ({ ...p, opacity: 0 })); return }
    const cRect = container.getBoundingClientRect()
    const bRect = active.getBoundingClientRect()
    setPill({ width: bRect.width, x: bRect.left - cRect.left, opacity: 1 })
  }, [value, tabs])

  return (
    <div
      ref={containerRef}
      className={`seg-ctrl${disabled ? ' is-disabled' : ''} ${className}`.trim()}
      role="tablist"
      aria-label={label}
    >
      <span
        className="seg-pill"
        style={{ width: pill.width, transform: `translateX(${pill.x}px)`, opacity: pill.opacity }}
        aria-hidden="true"
      />
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          disabled={disabled}
          data-active={tab.value === value ? 'true' : 'false'}
          className={`seg-tab${tab.value === value ? ' seg-tab-active' : ''}`}
          onClick={() => onChange?.(tab.value)}
        >
          {tab.icon && <span className="seg-tab-icon" aria-hidden="true">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
