# Design system — how to build with it

A small React UI kit. Style with **CSS custom properties (design tokens)** and
the components' own classes. This is **not** a utility-class or style-prop
system: Tailwind classes and `sx` / `color` props won't resolve.

## Setup

No provider or wrapper is required. Every token is global on `:root` (shipped
in `styles.css`), so any component renders fully styled anywhere on the canvas.

## Styling idiom — use the tokens

Style your own layout glue with `var(--token)`. Never hardcode a colour, a
radius or a duration: the whole palette is swappable in one file, and a
hardcoded value is what breaks that.

| Group | Tokens |
|---|---|
| Surfaces | `--bg` (page) · `--surface` (card) · `--surface-2` (recessed) |
| Text | `--ink` · `--ink-2` · `--mute` · `--mute-2` |
| Lines | `--line` · `--line-2` |
| Accent | `--accent` · `--accent-soft` · `--accent-ink` · `--accent-line` |
| Status | `--good` · `--warn` · `--bad` — each with `-soft` (fill), `-ink` (text on the fill) and `-line` (border) |
| Marketing (dark) | `--mk-dark` · `--mk-light` · `--mk-light-dim` · `--mk-glass-line` |
| Radii | `--r-xs` 6 · `--r-sm` 9 (controls) · `--r-md` 12 · `--r-lg` 16 (cards) · `--r-xl` 20 · `--r-pill` |
| Elevation | `--elev-1` · `--elev-2` · `--elev-3` · `--card-ring` (the "paper card" recipe) |
| Motion | `--dur-fast` · `--dur` · `--dur-slow` · `--ease-spring` · `--ease-out` |
| Type | `--font-body` · `--font-display` · `--font-mono` |

**Fonts** are system stacks by default — nothing is fetched. Swap
`--font-body` / `--font-display` in `tokens.css` to use a web font.

## The rules that matter

1. **One component per job.** Every button is `<Button>`; every text field is
   `<TextInput>`. Don't compose a new button out of a styled `<a>` — pass
   `as`/`href` to `<Button>` instead.
2. **Variants are a role vocabulary, not a colour picker.** `cta` is the one
   conversion action, `dark` is the in-app primary, `secondary` is the default
   toolbar button, `ghost` is text-only, `danger` is destructive. Pick by role
   and the hierarchy stays legible.
3. **Two shapes, one component.** Buttons default to the squared control radius
   (the product register). Add `pill` on marketing surfaces.
4. **`block` is for stacked layouts only.** It makes the button's *wrap*
   full-width, which crushes `flex: 1` siblings in a row. Stack the row instead.
5. **On dark surfaces, pass `onDark`.** `glass` becomes a white outline and the
   solid variants adjust their cast.
6. **Empty states over placeholder data.** `<EmptyState>` exists so a design
   never has to invent rows of fake content to look finished.

## Where the truth lives

- Tokens → `src/styles/tokens.css` (a worked re-theme: `src/styles/themes/warm-linen.css`)
- Component material → `src/styles/kit.css` and `src/styles/button.css`
- Component behaviour → `src/components/*.jsx`, each with a colocated test
