import { forwardRef } from 'react'

/* TextInput — the single text-input component for the whole app. Every
   text/email/search/number/date/time field routes through here so the markup,
   class, ref forwarding and behaviour stay in one place.

   A shared className is NOT enough: two <input className="ui-input"> written in
   different files are still duplicated UI that drift apart on the next change.
   Use this component; if it's missing a variant you need, extend it.

   Props:
     lg        — large variant (44px tall), for sign-in and other single-focus
                 screens where the field is the page's main object
     error     — applies the error border treatment
     multiline — renders a <textarea> with the same look (auto-height, resizable
                 vertically) instead of a second near-identical component
     className — extra classes appended after the base/variant classes
     ...rest   — forwarded to the element (type, value, onChange, placeholder…)

   Pair it with .ui-field / <label> for the label + hint + error layout. */
const TextInput = forwardRef(function TextInput(
  { lg = false, error = false, multiline = false, className = '', ...rest },
  ref,
) {
  const cls = [
    'ui-input',
    lg && 'ui-input--lg',
    error && 'ui-input--error',
    className,
  ].filter(Boolean).join(' ')

  const Element = multiline ? 'textarea' : 'input'
  return <Element ref={ref} className={cls} aria-invalid={error || undefined} {...rest} />
})

export default TextInput
