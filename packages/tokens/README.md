# @forge/tokens

Every colour, radius, shadow, duration and font stack the product uses, as CSS
custom properties on `:root`.

```css
@import '@forge/tokens/tokens.css';
```

## One scope, deliberately

Every token is declared on `:root` and nowhere else. There is no scoped
parallel set (`--x-ink` inside one wrapper, `--ink` outside), so a component
renders identically wherever it is placed.

That is on purpose: with two scopes, every component change has to be checked against
"which scope did this land in", and the answer is wrong often enough to matter.
It is also what lets `design-system/build-ds-css.mjs` publish the kit to an
external canvas as a plain concatenation — a scoped set would have to be
flattened first.

## Theming

A theme is a second stylesheet that redeclares the tokens, imported after
`tokens.css`:

```js
import '@forge/tokens/tokens.css'
import '@forge/tokens/themes/warm-linen.css'
```

`themes/warm-linen.css` is a complete worked re-theme — every token a palette
change touches, with nothing else altered. Copy it, change the values, and the
whole site follows: the kit and every page read the same variables.

Adding a token is the right move whenever you would otherwise write a literal
colour in a component. A hex eyeballed to "look right" is invisible to a theme
and to dark mode alike.
