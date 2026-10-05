/* ═══════════════════════════════════════════════════════════════════════════
   @forge/ui — the UI kit, and the only import surface for it.

   Every shared, potentially reusable interactive control lives here: buttons,
   inputs, selects, switches, segmented controls, chips, modals, skeletons,
   toasts. A page never hand-rolls a `<button>` or an `<input>`; if the kit is
   missing a variant, the variant is added HERE and every usage gets it.

   ── ONE BARREL, NOT SIXTEEN PATHS ──────────────────────────────────────────
   Consumers import from the package, never from a file inside it:

       import { Button, TextInput, Ico } from '@forge/ui'

   That is what makes the kit's internal layout the kit's own business — a
   component can be split, renamed or given a folder without touching a single
   page. A deep import like `@forge/ui/src/Button.jsx` would undo that, which
   is why `exports` below deliberately publishes only this file and the
   stylesheets.

   ── THE STYLESHEETS ARE PART OF THE CONTRACT ───────────────────────────────
   These components carry classNames and nothing else — no CSS-in-JS, no
   styled-components — so an app that imports the components without the
   stylesheets renders unstyled markup. The app imports them once, in order,
   in its entry file:

       import '@forge/tokens/tokens.css'   // the tokens everything reads
       import '@forge/ui/base.css'         // document defaults, typography
       import '@forge/ui/kit.css'          // the components' material
       import '@forge/ui/button.css'       // the button family

   Tokens live in @forge/tokens, a separate package, because a theme replaces
   them and must not have to replace the components too.
   ═══════════════════════════════════════════════════════════════════════════ */

export { default as Button } from './Button.jsx'
export { default as IconButton } from './IconButton.jsx'
export { default as TextInput } from './TextInput.jsx'
export { default as Select } from './Select.jsx'
export { default as Switch } from './Switch.jsx'
export { default as SegmentedControl } from './SegmentedControl.jsx'
export { default as Card } from './Card.jsx'
export { default as Chip } from './Chip.jsx'
export { default as Modal } from './Modal.jsx'
export { default as EmptyState } from './EmptyState.jsx'
export { default as Spinner } from './Spinner.jsx'
export { default as BrandMark } from './BrandMark.jsx'

export { Ico, ICONS } from './Icons.jsx'
export { default as Reveal, useReveal } from './Reveal.jsx'
export { default as Toast, useToast } from './Toast.jsx'
export {
  default as Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonButton,
  SkeletonGroup,
} from './Skeleton.jsx'
