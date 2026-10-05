import { forwardRef } from 'react'
import { Ico } from './Icons.jsx'

/* Button — the shared UI-kit button. THE one component for every button and
   every button-like link in the product. Never hand-write a <button> or a
   styled <a> for anything reusable; if the variant you need doesn't exist,
   add it here and in button.css rather than forking the markup.

   Structure (see styles/button.css for the material):
     .btn-wrap → .btn (interactive) → .btn-text
               + .btn-shadow

   Props:
     • variant — the role vocabulary, one material per level of hierarchy:
                 'cta'       — the premium conversion action (hero, upgrade),
                               dark body lit by the accent. Marketing AND in-app.
                 'dark'      — the in-app PRIMARY (Save / Create / Send).
                 'secondary' — the default toolbar button (surface + hairline).
                 'ghost'     — text-only until hover.
                 'danger'    — destructive.
                 'white'     — solid white, for dark surfaces.
                 'glass'     — the lightweight secondary pill (default); adapts
                               to a white outline on dark via `onDark`.
                 'plain'     — a bare element with no kit chrome (escape hatch).
                 Aliases: 'black' → 'dark', 'primary' → 'dark'.
     • size    — 'sm' | 'md'/'default' | 'lg' | 'compact' | 'tiny' |
                 'icon' | 'iconCompact'
     • pill    — full-pill (999px) shape. The default is the design-system
                 control radius (--r-sm) — the in-app/product shape. Opt into
                 `pill` on the marketing pages, where the rounded pill is the
                 register. Same component, one attribute.
     • onDark  — readability on dark surfaces. Use it wherever the button sits
                 on a dark background (hero, final CTA, sign-in brand panel).
     • glare   — periodic sheen sweep. Opt-in; reserve it for the single most
                 important conversion CTA (it's emphasis, not decoration).
     • as      — element/component to render ("a", "button", or e.g. <Link>).
                 With no `as`, an `href`/`to` renders an <a>, else a <button>.
     • icon / iconRight — leading / trailing NODES inside the text layer
     • iconName / iconRightName — the same, named instead of passed as a node.
                 For templates that are not JSX: an .astro file cannot write
                 `iconRight={<Ico … />}`, because .astro is not JSX and the
                 compiler stops at the `<`. Naming the icon keeps the marketing
                 site on the kit's real Button instead of a site-local wrapper
                 around it. A node wins if both are given.
     • block   — full-width.
                 CAUTION: `block` makes the WRAP width:100%. Inside a flex ROW
                 next to `flex: 1` siblings it consumes the row and crushes
                 them. Use it only when the button is on its own line; to go
                 full-width at mobile widths, stack the ROW
                 (flex-direction: column; align-items: stretch) instead.
     • className        — applied to the wrap (or the element, for 'plain')
     • contentClassName — applied to the text span
     • wrapStyle        — inline style for the WRAP (layout: margin, grid
                          placement). `style` in ...rest goes to the inner
                          element and is for the element itself.
     • ...rest — forwarded to the interactive element (onClick, type, disabled,
                 aria-*, target, rel, href, to, …)

   The native <button> `type` passes through untouched; a real <button>
   defaults to type="button" so it never submits a form by accident. */

const VARIANT_ALIAS = { black: 'dark', primary: 'dark' }

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

const Button = forwardRef(function Button(
  {
    as,
    href,
    to,
    variant = 'glass',
    size = 'md',
    onDark = false,
    block = false,
    pill = false,
    glare = false,
    icon = null,
    iconRight = null,
    iconName = null,
    iconRightName = null,
    className,
    contentClassName,
    wrapStyle,
    children,
    ...rest
  },
  ref,
) {
  const Element = as || (href != null ? 'a' : 'button')
  const isDomElement = typeof Element === 'string'
  const isButton = Element === 'button'
  const v = VARIANT_ALIAS[variant] || variant
  const sz = size === 'md' ? 'default' : size

  // A passed node wins; a name is resolved here. Size follows the button's,
  // so an icon never has to be sized at the call site to match its label.
  const iconSize = sz === 'lg' ? 18 : sz === 'tiny' ? 13 : 16
  const leading = icon ?? (iconName ? <Ico name={iconName} size={iconSize} /> : null)
  const trailing = iconRight ?? (iconRightName ? <Ico name={iconRightName} size={iconSize} /> : null)

  const props = { ...rest }
  if (href != null) props.href = href
  // `to` is a component prop (e.g. <Link to>), invalid on real DOM elements.
  if (!isDomElement && to != null) props.to = to
  if (isButton) props.type = props.type || 'button'

  // Plain — a bare, unstyled element (escape hatch; no kit chrome).
  if (v === 'plain') {
    return (
      <Element ref={ref} className={className} {...props}>
        {leading}
        {children}
        {trailing}
      </Element>
    )
  }

  return (
    <div
      className={cx('btn-wrap', block && 'btn-wrap--block', onDark && 'is-on-dark', className)}
      style={wrapStyle}
    >
      <Element
        ref={ref}
        className={cx(
          'btn',
          `btn--${v}`,
          `btn--${sz}`,
          pill && 'btn--pill',
          glare && 'btn--glare',
        )}
        {...props}
      >
        <span className={cx('btn-text', `btn-text--${sz}`, contentClassName)}>
          {leading}
          {children}
          {trailing}
        </span>
      </Element>
      <span className="btn-shadow" aria-hidden="true" />
    </div>
  )
})

export default Button
