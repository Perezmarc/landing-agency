---
category: Components
---

# Button

The one component for every button and every button-like link. It renders a
`<button>` for actions or an `<a>` for navigation — never hand-write either for
something reusable.

## Variants — a role vocabulary

Pick by the role the action plays, not by the colour you want. One material per
level of hierarchy is what keeps a screen legible.

| Variant | Use for |
|---|---|
| `cta` | The one conversion action on the page — hero, upgrade. Dark body lit by the accent. |
| `dark` | The in-app primary: Save, Create, Send. (Aliases: `primary`, `black`.) |
| `secondary` | The default toolbar button. Surface with a hairline ring. |
| `ghost` | Tertiary. No material until hover. |
| `danger` | Destructive. Delete, revoke, disconnect. |
| `white` | Solid white, for dark surfaces. |
| `glass` | The lightweight secondary pill. The default variant. |
| `plain` | A bare element with no kit chrome. Escape hatch. |

```jsx
<Button variant="cta" size="lg" pill glare>Get started</Button>
<Button variant="dark" onClick={save}>Save changes</Button>
<Button variant="ghost" size="compact">Cancel</Button>
<Button variant="danger" size="compact">Delete</Button>
```

## Sizes

`sm` · `md` (default) · `lg` · `compact` (32px, the app toolbar) · `tiny` ·
`icon` (40px square) · `iconCompact` (32px square).

Icon-only sizes carry no text, so pass an `aria-label`:

```jsx
<Button size="iconCompact" variant="secondary" aria-label="Settings">
  <Ico name="settings" />
</Button>
```

## Shape — two registers, one component

The default is the design-system control radius (a squared rounded-rect): the
in-app shape, matching inputs. Marketing surfaces opt into the full pill:

```jsx
<Button pill>Get started</Button>
```

## As a link

With no `as`, an `href` renders an `<a>` and everything else renders a
`<button>`. Pass a router link component through `as`:

```jsx
<Button href="https://example.com" target="_blank" rel="noreferrer">Docs</Button>
<Button as={Link} to="/pricing">Pricing</Button>
```

## On dark surfaces

```jsx
<Button variant="glass" onDark pill>Compare plans</Button>
```

`glass` becomes a white hairline outline, the solid variants adjust their cast,
and `dark` inverts so it doesn't disappear into the background.

## `block` — the one trap

`block` makes the **wrap** `width: 100%`. Inside a flex **row** next to
`flex: 1` siblings, it consumes the row and crushes them to zero width.

- ✅ Use it when the button is on its own line — a stacked column, a card CTA.
- ❌ Never in a row. To go full-width at mobile widths, stack the row
  (`flex-direction: column; align-items: stretch`); the wrap stretches without
  `block`.

## `glare`

An opt-in sheen sweep. Reserve it for the single most important conversion CTA.
On every button it reads as noise; on one button it reads as emphasis.

## Anatomy

```
.btn-wrap → .btn (+ variant + size) → .btn-text
          + .btn-shadow
```

`className` lands on the wrap, `contentClassName` on the text span, `wrapStyle`
on the wrap (for layout), and everything else is forwarded to the interactive
element. A real `<button>` defaults to `type="button"`, so it can't submit a
form by accident.
