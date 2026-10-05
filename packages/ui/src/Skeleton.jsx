import { forwardRef } from 'react'

/* Skeleton — the shared loading placeholder primitives.

   The idea: instead of hand-maintaining one page-shaped scaffold per screen
   (which silently drifts from the real UI on every change), compose a
   component's loading state from these primitives right where the component
   lives — a card renders its own skeleton, a list renders skeleton rows.

   Primitives:
     • <Skeleton>        — one shimmer block. Props:
         w / h           — width / height (number → px, or any CSS length)
         radius          — border-radius (number → px, or CSS length)
         shape           — 'block' (default) | 'circle' | 'pill'
         tone            — 'default' | 'strong' (denser) | 'ink' (solid, no
                           sheen — mimics a primary button) | 'night' (legible
                           on dark panels)
         grow            — flex: 1 (fill remaining space in a .sk-row)
         className/style — extra class / inline CSS custom props
     • <SkeletonText>    — a paragraph of `lines` blocks; last line shorter.
     • <SkeletonCircle>  — a round block (avatars, icons).
     • <SkeletonButton>  — a button-shaped block.
     • <SkeletonGroup>   — an accessible wrapper (role="status", aria-busy) with
                           an sr-only label. Individual blocks are aria-hidden,
                           so wrap a loading region in this to announce it once.

   Layout helpers (plain CSS classes): sk-stack (column), sk-row (aligned row),
   sk-panel (padded card body), sk-contents (announce without joining layout). */

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

// number → px; strings ('50%', '2rem') pass through untouched.
function len(v) {
  return typeof v === 'number' ? `${v}px` : v
}

const SHAPE_CLASS = { circle: 'sk--circle', pill: 'sk--pill' }
const TONE_CLASS = { strong: 'sk--strong', ink: 'sk--ink', night: 'sk--night' }

const Skeleton = forwardRef(function Skeleton(
  { w, h, radius, shape = 'block', tone = 'default', grow = false, className, style, ...rest },
  ref,
) {
  // Dimensions ride in as CSS custom properties so the component owns size
  // without writing visual styles inline.
  const vars = {
    ...(w != null ? { '--sk-w': len(w) } : {}),
    ...(h != null ? { '--sk-h': len(h) } : {}),
    ...(radius != null ? { '--sk-r': len(radius) } : {}),
    ...style,
  }
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cx('sk', SHAPE_CLASS[shape], TONE_CLASS[tone], grow && 'sk--grow', className)}
      style={vars}
      {...rest}
    />
  )
})

export default Skeleton

/* A paragraph placeholder: `lines` blocks stacked, the last shortened so it
   reads as ragged prose rather than a solid rectangle. */
export function SkeletonText({ lines = 3, h = 11, gap, w = '100%', lastW = '60%', tone, className, style }) {
  const vars = { ...(gap != null ? { '--sk-line-gap': len(gap) } : {}), ...style }
  return (
    <span className={cx('sk-text', className)} style={vars}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 && lines > 1 ? lastW : w} h={h} tone={tone} />
      ))}
    </span>
  )
}

export function SkeletonCircle({ size = 32, tone = 'strong', className, style, ...rest }) {
  return <Skeleton shape="circle" w={size} h={size} tone={tone} className={className} style={style} {...rest} />
}

export function SkeletonButton({ w = 120, h = 36, radius = 9, tone = 'strong', className, style, ...rest }) {
  return <Skeleton w={w} h={h} radius={radius} tone={tone} className={className} style={style} {...rest} />
}

/* Accessible region wrapper. Blocks are aria-hidden; this announces the loading
   state once (role="status" + aria-busy) with an sr-only label. */
export function SkeletonGroup({ label = 'Loading', className, children, ...rest }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label={label} {...rest}>
      {children}
    </div>
  )
}
