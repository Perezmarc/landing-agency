import { forwardRef } from 'react'

/* Switch — the single on/off toggle for the whole app.

   Renders a real <button role="switch"> with aria-checked, so it is
   keyboard-operable and announced correctly. Don't rebuild this from a styled
   checkbox per page.

   Props:
     checked        — on/off state
     onChange(next) — called with the NEXT boolean on toggle
     disabled       — non-interactive (e.g. while saving)
     size           — 'md' (default, 38×22) or 'sm' (32×18)
     className      — extra classes on the button
     ...rest        — forwarded (aria-label, id, title, …)

   An icon-less switch has no visible text, so give it an `aria-label` (or wire
   `id` to a <label>) at every call site. */
const Switch = forwardRef(function Switch(
  { checked = false, onChange, disabled = false, size = 'md', className = '', ...rest },
  ref,
) {
  const cls = [
    'ui-switch',
    size === 'sm' && 'ui-switch--sm',
    checked && 'on',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cls}
      onClick={() => onChange?.(!checked)}
      {...rest}
    >
      <span className="ui-switch-knob" aria-hidden="true" />
    </button>
  )
})

export default Switch
