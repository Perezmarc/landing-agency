/* Icons — one dependency-free icon set for the whole product.
   No icon library: a handful of hand-written 24×24 stroke paths weigh nothing,
   never break on a major version bump, and inherit currentColor so they sit
   correctly on every surface.

   Usage:  <Ico name="check" />  ·  <Ico name="trash" size={12} />

   Adding one: draw it on a 24×24 grid with a 1.8 stroke and no fill, then add
   the path here. Keep the set small — an icon nobody uses is dead weight.

   This module imports nothing, so components that need an icon pull in
   nothing else along with it. */

export const ICONS = {
  home:      <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />,
  settings:  <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.54 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.06 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.54 1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  user:      <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6" /></>,
  users:     <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.3 3-5.2 6.5-5.2s6.5 1.9 6.5 5.2M17 5.2a3.2 3.2 0 0 1 0 6M18.5 14.6c2 .6 3.5 1.9 3.5 4" /></>,
  billing:   <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></>,
  check:     <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  x:         <path d="M6 6l12 12M18 6 6 18" />,
  plus:      <path d="M12 5v14M5 12h14" />,
  minus:     <path d="M5 12h14" />,
  trash:     <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.9 12.1A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />,
  search:    <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  external:  <path d="M14 4h6v6M20 4l-9 9M17.5 14v5.5A1.5 1.5 0 0 1 16 21H5.5A1.5 1.5 0 0 1 4 19.5V8.5A1.5 1.5 0 0 1 5.5 7H11" />,
  arrowRight:<path d="M5 12h14M13 6l6 6-6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  chevronRight:<path d="M9.5 6l6 6-6 6" />,
  logout:    <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h10" />,
  info:      <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></>,
  alert:     <><path d="M12 4.5 21 19.5H3z" /><path d="M12 10v4M12 17v.2" /></>,
  sparkle:   <path d="M12 3.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9z" />,
  moon:      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z" />,
  bolt:      <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />,
}

/**
 * Render a named icon.
 *   name   — a key of ICONS
 *   size   — px (default 16)
 *   stroke — stroke width (default 1.8)
 * Anything else is forwarded to the <svg>. Icons are decorative by default
 * (aria-hidden); the surrounding control carries the accessible name.
 */
export function Ico({ name, size = 16, stroke = 1.8, className = '', ...rest }) {
  const path = ICONS[name]
  if (!path) return null
  return (
    <svg
      className={`ico ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  )
}

export default Ico
