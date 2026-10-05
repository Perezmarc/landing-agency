# @forge/ui

The UI kit: every shared, potentially reusable interactive control, in one
place, with a test each.

```js
import { Button, TextInput, Select, Ico } from '@forge/ui'
```

```js
// once, in the app's entry file — the kit ships classNames, not CSS-in-JS
import '@forge/tokens/tokens.css'
import '@forge/ui/base.css'
import '@forge/ui/kit.css'
import '@forge/ui/button.css'
```

## What's here

`Button` · `IconButton` · `TextInput` · `Select` · `Switch` ·
`SegmentedControl` · `Card` · `Chip` · `Modal` · `EmptyState` · `Spinner` ·
`Skeleton` (+ `SkeletonText`, `SkeletonCircle`, `SkeletonButton`,
`SkeletonGroup`) · `Toast` (+ `useToast`) · `Reveal` (+ `useReveal`) · `Ico` /
`ICONS` · `BrandMark`.

## One barrel

`src/index.js` is the entire public surface, and `exports` in package.json
publishes only it and the three stylesheets. `@forge/ui/src/Button.jsx` does
not resolve, on purpose: a deep import makes the kit's internal layout every
page's business, and then a component can't be split or renamed without a
sweep across the repo.

## What does NOT belong here

Page furniture. The site's nav, footer and page sections live in
`apps/site/src` — they are that site's layout, not shared controls.

## Adding to the kit

A page that needs a control the kit doesn't have has two honest options: add
the control here, or write a genuinely one-off inline element. It never has a
third — a hand-rolled `<button className="ui-btn">` in a page is duplicated UI
that drifts on the next change, which is the whole failure mode this package
exists to prevent. If the kit has the component but not the variant, extend the
component; don't fork it.

Every component ships with a colocated Testing Library test covering its props,
its variants and its ref contract (`TextInput.test.jsx` is the model).
