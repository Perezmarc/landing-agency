/* Card — the standard content surface: an optional header row, a body, and the
   kit's "paper" material (one-step shadow + inset ring).

   Use it for every panel that groups related content. Reach for a bare <div>
   only when the surface genuinely isn't a card.

   Props:
     title    — header text. Omit both title and actions for a header-less card.
     sub      — quiet secondary line beside the title
     actions  — node pinned to the right of the header (buttons, a chip)
     padded   — wrap children in the standard body padding (default true).
                Pass false for edge-to-edge content such as a table or list.
     as       — element to render (default 'section')
     ...rest  — forwarded to the element */
export default function Card({
  title,
  sub,
  actions,
  padded = true,
  as: Element = 'section',
  className = '',
  children,
  ...rest
}) {
  const hasHeader = title != null || actions != null

  return (
    <Element className={`ui-card ${className}`.trim()} {...rest}>
      {hasHeader && (
        <header className="ui-card-h">
          {title != null && <div className="ui-card-title">{title}</div>}
          {sub != null && <div className="ui-card-sub">{sub}</div>}
          {actions != null && <div className="ui-card-actions">{actions}</div>}
        </header>
      )}
      {padded ? <div className="ui-card-body">{children}</div> : children}
    </Element>
  )
}
