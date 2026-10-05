import { forwardRef } from 'react'

/* Select — the single <select> for the app, the dropdown sibling of
   <TextInput>. Routes every native select through one place so the class,
   arrow and focus ring stay consistent. Pass <option>s as children.

   The arrow is drawn in CSS rather than left to the platform, so the control
   looks the same on macOS, Windows and Android.

   Props:
     error     — error border treatment
     className — extra classes appended after the base class
     ...rest   — forwarded to <select> (value, onChange, disabled, …) */
const Select = forwardRef(function Select({ error = false, className = '', children, ...rest }, ref) {
  const cls = ['ui-select', error && 'ui-select--error', className].filter(Boolean).join(' ')

  return (
    <select ref={ref} className={cls} aria-invalid={error || undefined} {...rest}>
      {children}
    </select>
  )
})

export default Select
