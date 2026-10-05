---
category: Foundations
---

# Design tokens

Every colour, radius, shadow, duration and font stack in the product is a token
on `:root`, defined once in `src/styles/tokens.css`. Nothing else hardcodes a
value.

**One scope, on purpose.** There is no parallel token set scoped to the app
shell. A design system with two scopes spends the rest of its life answering
"which scope did this component land in", and getting it wrong often enough to
matter.

## Colour

| Group | Tokens | Use for |
|---|---|---|
| Surfaces | `--bg` · `--surface` · `--surface-2` | the page · a card on it · a recessed area (rail, table header) |
| Ink | `--ink` · `--ink-2` · `--mute` · `--mute-2` | body text · dense UI · secondary copy · labels and placeholders |
| Lines | `--line` · `--line-2` | separators · quieter internal dividers |
| Accent | `--accent` · `--accent-soft` · `--accent-ink` · `--accent-line` | the one brand colour: links, focus, the active nav tick |
| Status | `--good` · `--warn` · `--bad` | each with `-soft` (fill), `-ink` (text on that fill), `-line` (border) |
| Marketing | `--mk-dark` · `--mk-light` · `--mk-light-dim` | the dark register the hero and final CTA sit on |

The status families come as a set of four for a reason: a status pill needs a
fill, text that passes contrast **on that fill**, and a border. Picking a
`-soft` fill and then using `--ink` for the text is how status colours end up
failing contrast.

## Shape

`--r-xs` 6 · `--r-sm` 9 (controls) · `--r-md` 12 (nested panels) ·
`--r-lg` 16 (cards) · `--r-xl` 20 (hero surfaces) · `--r-pill`.

Reference the step, never a raw px. That is what gives the product one shape
rhythm instead of a radius picked per rule.

## Elevation

`--elev-1` · `--elev-2` · `--elev-3`, plus `--card-ring` — an inset top
highlight and hairline that, paired with `--elev-1`, makes a flat surface read
as a physical card:

```css
.thing {
  background: var(--surface);
  border-radius: var(--r-lg);
  box-shadow: var(--elev-1), var(--card-ring);
}
```

Inputs use the opposite recipe (a faint *inner* shadow) so fields read as wells
against the cards' raised paper.

## Motion

`--dur-fast` 0.12s · `--dur` 0.2s · `--dur-slow` 0.34s, with `--ease-out` for
most things and `--ease-spring` for a tactile settle. One ramp, so
micro-interactions don't each invent a duration.

Everything that animates must be quiet under `prefers-reduced-motion: reduce`.

## Type

`--font-body` · `--font-display` · `--font-mono`. System stacks by default:
nothing to download, identical in CI, fast on first paint. To use a web font,
add its `<link>` to `index.html` and change the stack here — every heading and
control follows, because nothing else names a font family.

## Re-theming

Change the Palette block in `tokens.css` and the whole product follows.
`src/styles/themes/warm-linen.css` is a complete worked example (warm linen and
amber) showing the three decisions that make a palette hang together: tint the
surfaces, tint the ink to match, and nudge every semantic family toward the same
warmth.

If a re-theme ever requires editing a component stylesheet, that component is
hardcoding a colour it should be reading from a token.
