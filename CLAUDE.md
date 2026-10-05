# Working notes for Claude

Project conventions, and the reasoning behind them. These override default
behaviour — follow them exactly.

## What this is

The website of an AI consulting agency: we design, build and run custom AI
agents that take over repetitive back-office workflows (finance, revenue ops,
procurement, compliance, customer ops, logistics) inside the client's existing
tools. The site's one job is to get a qualified visitor to **book a discovery
call**. It is a landing page, a blog, a contact page and legal pages, in
English, Spanish and Italian.

The name and domain are still placeholders (`Agency`, `example.com`). Never
type a name, domain or address anywhere but the manifest.

**Layout:** a workspace monorepo with one app.

| Path | What |
|---|---|
| `apps/site/…` | the site (Astro, static, no backend) |
| `packages/…` | what it is built from: `config`, `manifest`, `i18n`, `seo`, `tokens`, `ui` |
| `.agents/product-marketing.md` | positioning, audience, objections — the brief every copy change starts from |
| `.claude/skills/` | the marketingskills library (copywriting, cro, seo-audit, …) |

---

## Copy — the rules that matter here

- **Load the skills.** For any copy change, read `.agents/product-marketing.md`
  first, then follow `.claude/skills/copywriting/SKILL.md` (and `cro` for
  structure, `copy-editing` for a polish pass). Run its AI-tells self-check
  before handing anything over.
- **No invented proof.** No case studies, client logos, testimonials, metrics
  or "trusted by" lines until a real one exists. A fabricated result on an
  agency site is a legal and trust problem, not a placeholder. Where proof is
  missing, write `[NEED: …]` in `.agents/product-marketing.md`, not on the page.
- **Every CTA books a call** via `forge.brand.bookingUrl`. Don't hardcode a
  mailto or a scheduling URL in a page.
- **Three languages, always together.** English is the source. A new or
  changed key lands in `en.json`, `es.json` and `it.json` in the same change.
  Translate for the reader (natural Spanish for Spain, natural Italian), not
  word for word; one key is one whole sentence.
- **Update the context doc** when positioning changes: bump its version and add
  a changelog line.

## Iterating — replace, don't accumulate

When we change or supersede something, **remove the old version in the same
change**. Don't leave the previous implementation, dead code, unused CSS,
legacy props, or a parallel "old + new" path behind. Default to deleting what's
been replaced.

- The only exceptions are when I **explicitly ask** to keep the old thing, or
  when it still serves a **distinct, defined purpose I've called out** (not one
  you inferred). If you think something superseded should be kept, **ask
  first** — don't keep it silently.
- "Might be useful later" / "just in case" is not a reason. If it's genuinely a
  separate concern, say so and confirm rather than assuming.

## Mock data — ASK FIRST, ALWAYS

**Never add mock, placeholder, fake or hard-coded sample data without asking
me first.** This applies everywhere — components, pages, copy, tests and any
throwaway screenshot scaffolding.

- If a feature or piece of data is **not implemented** and I have **not asked
  you to implement it**, stop and ask before introducing mock data to stand in
  for it.
- Prefer real data sources, honest empty states, or a plain "not implemented"
  notice over fabricated values. Placeholder data looks finished, so it
  survives into the first demo, and then nobody can tell which numbers are real.
- Hard rule: when in doubt, ask. Do not add mock data and "mention it later".

### Mock naming convention — Marvel names only

When mock data **is** requested and you need names, use Marvel names:

- **People** → the character's *individual person* name, never the hero alias
  (`Tony Stark`, `Steve Rogers`, `Natasha Romanoff` — not "Iron Man").
- **Companies / orgs / domains** → Marvel *business* names (`Stark Industries` /
  `stark.com`, `Oscorp` / `oscorp.com`, `Roxxon`, `Pym Technologies`).

Apply this everywhere mock identities appear — sample users, test fixtures,
email tokens, avatars. The point is that a screenshot or a test
fixture can never be mistaken for a real person's data.

---

## Testing — write tests as you build

CI (`.github/workflows/ci.yml`) runs the full suite on every PR **and** as the
gate inside `deploy.yml`: if any test fails on `main`, nothing deploys. Never
remove or weaken that gate.

| Layer | Framework | Where | Run with |
|---|---|---|---|
| Packages and UI kit | Vitest (+ Testing Library in `packages/ui`) | colocated `*.test.js(x)` | `npm test` |
| The site | Playwright against the real static build | `apps/site/e2e/*.spec.js` | `npm run test:e2e` |

Every command runs from the repository root; `npm test` is `turbo run test`.

- **New page** → add it to `packages/seo/src/routes.js` with a path for every
  language, add `seo.<key>` to every catalog, add the thin wrapper under
  `apps/site/src/pages/` (and `es/`, `it/`), and put the body in
  `apps/site/src/pages-content/`. The e2e suite walks the route table, so a
  route with no page fails there.
- **New kit component** → a Testing Library test for its props, variants and
  ref contract (`TextInput.test.jsx` is the model).
- **Bug fix** → the failing regression test first.
- Tests that need a second language ask the manifest for the published ones;
  never hardcode `'es'`.
- Unit tests are clock- and timezone-independent: pin instants, pass explicit
  `timeZone`s.
- **Playwright is pinned to `1.56.x`** to match the browser build provisioned
  in CI and the Claude Code sandbox. Bump it deliberately.

---

## UI rules

The site is static HTML. Astro renders the kit's React components at build
time, so they ship no JavaScript unless a `client:` directive asks for it — and
the e2e suite fails if the landing page ships any.

### Always use the UI kit (`@forge/ui`) — hard rule

`packages/ui` is the **single source of truth** for shared
interactive UI. For **every interactive element that is even potentially
reusable** — buttons, links styled as buttons, text/email/search/number inputs,
selects, toggles, segmented controls, chips — you **must** use the existing kit
component, never a hand-rolled `<button>` / `<input>` / `<a>` / `<select>`.

Import from the package, never from a file inside it:

```js
import { Button, TextInput, Ico } from '@forge/ui'
```

`packages/ui/src/index.js` is the whole public surface, and the package's
`exports` publishes only that barrel and the stylesheets. A deep import
(`@forge/ui/src/Button.jsx`) is not resolvable on purpose: it would make the
kit's internal layout every page's business, and a component could no longer be
split or renamed without a sweep.

- **Buttons and button-like links → always `<Button>`.** It renders a `<button>`
  (actions) or an `<a>` (navigation) via the `as` / `href` / `to` props.
- **Text fields → always `<TextInput>`** (and `<Select>`, `<Switch>`,
  `<SegmentedControl>` for their kinds), never a raw element.
- If the kit is **missing** a control, a variant or a prop you need, **add it to
  the kit** and use it everywhere — do not scatter the markup inline in a page.
  Extend the component, don't fork it.
- A genuinely one-off, non-reusable control may stay inline. When in doubt, put
  it in the kit.

### "Component" means a React component, not a CSS class

A shared className is **necessary but not sufficient**. Two
`<input className="ui-input">` written in different files are still duplicated
UI, and they drift apart on the next change. The goal is one source of truth in
`packages/ui` that owns the markup, the class, the ref forwarding and the
behaviour, so every usage stays in sync automatically.

### `<Button block>` is for stacked layouts only — never inside a flex row

`block` makes the button's **wrap** `width: 100%`. Inside a `display: flex`
**row** next to `flex: 1` siblings, that full-width wrap consumes the row and
crushes the siblings to zero width.

- Use `block` only when the button sits **on its own line** — a stacked column,
  a card CTA, a mobile `flex-direction: column` layout.
- In a row, leave the button auto-width. If it must go full-width at mobile
  widths, **stack the row** (`flex-direction: column; align-items: stretch`) and
  the wrap stretches without `block`.
- When migrating a raw `<button>` to `<Button>`, **delete the old CSS in the
  same commit**. Stale rules either fight the kit or rot into dead selectors
  that a later edit wrongly targets.

### Avoid inline styles and `!important`

- **No inline `style` props** for visual properties (colour, size, shadow,
  spacing) *or* layout (flex, grid, gap, margins, positioning). They block CSS
  overrides and break responsive rules. Reach for an existing class; if none
  fits, add one in the right stylesheet.
- The accepted exceptions are **CSS custom properties carrying a computed
  value** (`style={{ '--sk-w': '120px' }}`) and **measured layout values** that
  cannot be expressed in CSS (the sliding pill in `SegmentedControl`).
- **Never use `!important`.** If you need it, move the value into a custom
  property that CSS rules can override cleanly.
- **Critical:** a custom property set inline cannot be overridden by a CSS rule
  (same cascade as any inline style). Only inject one inline when it does NOT
  need a responsive override. Anything that must be responsive belongs on the
  class, overridden in a media query.

### One token scope

Every design token lives on `:root` in `@forge/tokens`. Don't introduce a
parallel scoped token set.

### Stylesheets

| File | Owns |
|---|---|
| `@forge/tokens/tokens.css` | every colour, radius, shadow, duration, font stack |
| `@forge/tokens/themes/*.css` | optional palette overrides (worked example: `warm-linen.css`) |
| `@forge/ui/base.css` | document defaults, typography, global utilities |
| `@forge/ui/kit.css` | the shared components' material |
| `@forge/ui/button.css` | the button family |
| `apps/site/src/styles/marketing.css` | the site (`mk-`) |

All CSS is imported once, in `apps/site/src/layouts/Base.astro`. Class
prefixes: `ui-` for kit components, `mk-` for the site, `seg-` for the
segmented control.

### Duplicated / scope-shadowed rules

If a class is defined in two places, the more specific copy does **not** replace
the base — it only overrides the properties it explicitly sets, and everything
else still cascades in.

**Reset the opposite anchor edge when re-anchoring a positioned element.** If a
base rule sets `top` and your copy switches to `bottom` (or `left`/`right`),
set the old edge back to `auto`. A `position: fixed/absolute` element with both
`top` and `bottom` set and `height: auto` stretches to span both. Read **both**
rule blocks together before changing either.

### Merge conflicts touching UI markup — re-verify, don't graft

A conflict-free compile is not a verified merge. When resolving conflicts in
JSX or CSS:

- Re-evaluate every layout-affecting prop and class (`block`, widths, flex)
  against the **post-merge** markup, not the context it was written for.
- Read the CSS the merged markup lands in, both rule blocks, before accepting.
- Render the affected page (or its test) after the merge. Layout regressions on
  public pages are user-facing; check those first.

---

## Architecture notes

- **The manifest.** `packages/manifest/forge.config.js` says what this site
  IS: brand, legal entity, socials, published languages, booking link.
  Everything reads it with `import forge from '@forge/manifest'`. The origin,
  the four standard addresses and `bookingUrl` are **derived** from
  `brand.domain`; `@forge/config` is the schema and validates on import.
- **SEO.** `packages/seo/src/routes.js` is THE route table: sitemap,
  `hreflang`, nav, footer, language switcher and e2e all read it. Paths are
  translated, not prefixed (`/es/contacto`, `/it/contatti`); the default
  locale is unprefixed. A page title is copy, so it lives in `@forge/i18n`
  under `seo.<key>`, and every page's title must be unique across languages.
- **i18n.** No user-facing string lives outside `packages/i18n`.
  `locales.test.js` fails a language that is missing a key, has an extra one,
  drops a `{{placeholder}}`, changes a list's length, or leaves a sentence over
  40 characters identical to English. Lists (`home.steps`, `home.faqs`, …)
  render by index, so every language keeps the same length.
- **Blog.** Markdown files under `apps/site/src/content/blog/<locale>/`,
  typed by `content.config.js`. See `docs/BLOG.md`. Don't write articles
  without being asked.
- **Legal.** Privacy and terms are markdown templates per language with
  bracketed blanks. Not legal advice; keep the three versions aligned.

---

## Deploys

`deploy.yml` runs on push to `main`: **test → site** (Vercel). Every job is
gated on the repository variable `DEPLOY_ENABLED == 'true'`; until it is set
the workflow skips itself. Don't remove the gate to "fix" a skipped deploy —
set the variable. A production deploy is outward-facing, so confirm before
triggering one by hand.
