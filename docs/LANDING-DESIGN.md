# Landing page: art direction and motion

The decisions behind the homepage, so they live in the repository rather than
in a design session. Change them deliberately, and update this file when you do.

## The image

Rain falls on a rough, raw quartz crystal and breaks into messy drops. The
crystal shatters, a smooth polished pebble is left, the rain stops, and one
thin stream runs over the pebble in a smooth film and leaves it as **one calm
stream**. The water lives in the hero; below it the page is calm
white with still crystal stones. Water comes back further down only as
dedicated clips attached to specific elements (the calendar's two cards), as
a thin accent on their borders, and as the one stream that left the hero,
carried on the same x, unbroken, down to the AFTER card. At the bottom, the footer is all
the water that has fallen: a filled container seen from the side, a flat
waterline edge to edge and the body of water below it.

- **Light:** soft, neutral, from above. No colour.
- **Page:** pure white. Every image and clip is graded to it, so nothing reads
  as a box, and every section is transparent.
- **Material discipline:** crystal and water only. Small raw fragments appear
  beside the problem copy; polished pebbles beside later section heads. Stones
  never sit under text: on landscape they keep to the empty right side of a
  section, on portrait a few small ones sit in the section's top padding.
- **Palette:** white and warm grey, near-black ink, one sage accent. Headlines
  are light and tight: a grey line, then a black line.

## Page order

1. Hero: the crash.
2. A week, before and after: six team tabs.
3. The problem: "Your process document is not your process."
4. How we find the real process.
5. Sort every step.
6. Supplier invoices, step by step (an illustration, labelled as one).
7. How an engagement works.
8. Built on your systems.
9. FAQ.
10. Final CTA.
11. The footer: the pool (on every page).

## Two clocks

| Clock | Drives | Never |
|---|---|---|
| **Time** | The water. Every clip loops at normal speed. | Makes anything happen. |
| **Scroll** | One trigger (crash and reassemble), and the page's own scrolling. | Speeds up, slows down or scrubs the water. |

Scrubbing video with scroll ties the water to the visitor's thumb: it freezes
when they stop and races when they fling. Two loops and one triggered swap keep
the water natural.

## The hero

A `150svh + 100lvh` section with a sticky 100lvh stage: the stage stays
pinned for 1.5 screens of scroll (`motion/hero.js` reads the pin from the
layout). The stage is the large viewport so that when a phone's browser bars
collapse the screen never shows the page under it (Safari's bars take about
a fifth of an iPhone's screen; with a 100svh stage the stream stopped that
far above the bottom, on white). The copy and the pebble are laid out in the
small viewport (100svh), which is always on screen. **The stream never ends
in mid-air:** in every layout it leaves through the stage's bottom edge
(landscape: the 16:9 box covers the 100lvh stage and the stream runs out
through the frame's bottom; portrait: see below). That is
long enough that a brisk continuous wheel (2000 px/s) still has the stage on
screen through the burst, and a normal scroll sees the 3.75 s crash. The
crash is never scrubbed: the extra length only keeps the stage in view while
the clip plays on its own clock. The layers, bottom to top:

1. the AFTER poster and AFTER loop (the polished pebble, one stream in, one out);
2. the transition clip, which plays once;
3. the BEFORE layer (the raw rock in the rain): poster and loop;
4. the copy.

The transition clip's first frame is the raw rock and its last frame is the
polished pebble: the rock shatters, its fragments fly out, the pebble is left,
and the water draws together into the two thin streams. Every swap between layers is therefore
invisible.

States (`motion/hero-state.js`): `before → crashing → after → reassembling`.

- The first scroll past 24px crashes; only `scrollY ≤ 4` goes back.
- A fling, a hash link or a restored scroll position (a first reading already
  past the pin) snaps to the end state with no crash.
- The state is exposed as `data-hero-state`.

The crash clip is 3.75 s (90 frames). The source holds the unchanged rock for
its first 7 frames, so the pipeline drops its first 6 (`CRASH_HEAD`): the clip
opens one frame before the burst, the pebble shows clear of the fragments at
about 1.25 s, the splashes settle from about 2 s, and the two streams run
from about 2.7 s to the end. It runs on this timeline:

| Time | What happens |
|---|---|
| trigger | `play()` is called on the clip; the BEFORE layer stays up (`is-arming`). |
| first presented frame | BEFORE is cut and the clip shows (`is-transitioning`). |
| + 1250 ms (`--delay-hero-crystal`) | The pebble is clear of the fragments: the headline's black line moves from the first to the second. |
| 250 ms before the end | The AFTER loop starts underneath. |
| end | The transition fades out over the AFTER loop. |

The clip is never required to be preloaded: iOS Safari ignores `preload` and
decodes nothing before `play()`. The media tier primes it right after `load`
(play, then pause at 0) so it starts at once; if it still presents no frame
within 700 ms, or `play()` is refused (iOS Low Power Mode), the posters
crossfade instead. Every way into a rest state (after the clip, after the
poster crossfade, a snap, a hash link, a page restored from the cache) plays
that state's loop, so the AFTER is never left a still when a video exists.

The headline follows the image: over the raw rock (BEFORE, and on the way
back) its first line ("Understand your processes.") is black and the second
("Then automate them with AI agents.") grey; once the polished pebble shows,
the second line is black and the first grey. The server HTML, like the poster, is the AFTER.

Going back fades the BEFORE layer in over `--dur-hero-fade` (400 ms). Devices
that get no video crossfade the two posters instead.

### Portrait

All three 9:16 hero clips (BEFORE, crash, AFTER) are composed from the 16:9
ones (`composePortrait`), so the pebble has the same place and size in each
and the cuts stay invisible. The landscape frame is scaled until the pebble
(measured at 39.8% of the landscape width, centred at 66.7% across and 48.5%
down; the rock sits on the same spot) is 64% of the portrait width, centred,
with its centre at 80% of the height. The pebble is flatter than the old
crystal, so it is shown a little wider. At that scale the landscape frame
covers the whole width and runs past the
bottom, so nothing around or below the pebble is invented (the old
composition repeated a strip of each frame down the stream, which stacked
fragments into squares during the crash). Above the pebble the frame
feathers into a still, smooth plate that the grade takes to white, so the copy
sits on white and flying fragments fade out rather than meet a seam. The 9:16
frame is anchored to the bottom of the small viewport (`top: 100svh − frame
height`, the frame sized from the stage as a size container:
`max(177.78cqw, 100svh)`): on a phone it is exactly the small viewport, and
the rock and the pebble sit below the buttons from 375×667 (iPhone SE) to
430×932.

**The extension.** Every portrait clip runs on 0.4 of its 9:16 height below
its frame (720×1792; `--hero-extend` from `media.json`, set on the section
by `Home.astro`), so where the stage is taller than the small viewport (bars
collapsed: up to about 1.3 small viewports) the stream still reaches the
stage's bottom. On a desktop browser the extension is simply cropped. The
landscape source ends at the frame's bottom, so the pipeline makes those
rows by advection (`EXTEND` in the script): a row r pixels below the frame
is the frame's own bottom row a moment earlier, the time water takes to
fall that far (leaving the edge at 9 px a frame, the BEFORE drops' measured
speed, and gaining 1.5 px a frame, every frame). Whatever crosses the edge
keeps falling: the stream, a drop, the BEFORE loop's drips (which stretch
into rain streaks as they speed up). Nothing is tiled and there is no seam:
each row is a different moment of the same edge, and a loop takes its past
from itself, wrapping, so its loop seam is untouched. The crash takes the
past before its first frame from the BEFORE loop, so the drips already
falling keep falling through the cut; the burst's fragments fade out within
48 px of the edge instead of being drawn into streaks (the last one crosses
it before frame 56); its new stream reaches the edge at about frame 66 and
fills the extension 21 frames later, so the crash ends, like the AFTER
loop, with the stream running the whole way down. The last 12% of the rows
fade to white, so a screen taller than all that sees the stream fade, not
stop. `e2e/stream.spec.js` samples the stream column at the stage's bottom
edge at 390×844, 430×932, 375×667, 1440×900 and 1920×1080 (poster and AFTER
loop), and with the small viewport set to 75% of a 390×844 and a 375×667
screen.

## The calendar

"We are taking tasks off your week": two calendars on one time scale, side
by side on a desktop. **BEFORE** ("Today") lists every task of the week, the decisions
included. **AFTER** ("With an agent") is the same calendar minus the
eliminated tasks: the kept ones stay in exactly the same day and slot, with
the same colour, and every eliminated task leaves an empty space. Nothing is
added, moved or condensed; the empty grid is the message.

- **Layout, by CSS alone.** Three widths:
  - **1180px and up: side by side.** BEFORE left, AFTER right, tops level,
    each a full Mon–Fri week with its own hour axis. Both cards are the same
    width on the same scale, so a kept task has the same box in both and a
    level line through a time meets the same slot left and right. (An axis
    on the left card only would make the two grids different widths.)
  - **721–1179px: stacked weeks**, AFTER below BEFORE, five columns each.
  - **720px and below** (the site's mobile breakpoint): stacked, Monday
    alone, so Monday holds every category in every team (`week.test.js`).

  1180px was measured, not guessed. Side by side, a day column is
  `(card − axis) / 5`: 96–98px from 1180px (the 1160px wrap caps it),
  88px at 1100px, 80px at 1024px. Across all six teams the share of clipped
  labels is at its floor from 1180px (English 3–4%, Italian 27–29%, Spanish
  33%; the long ones end in an ellipsis), and climbs fast below it (English
  14% at 1100px, 26% at 1024px). Stacked, a tablet keeps 170px+ columns, so
  the side-by-side view waits for the width that can carry it. 1180px also
  puts an iPad held landscape on the side-by-side view.

  Weekday names come from `Intl.DateTimeFormat` (short, pinned dates, UTC),
  so they need no catalog strings.
- **Chips.** Near-black (`--task-chip`, white text at 18:1) with a solid
  4px left bar in the category's colour: manual work blue, chasing amber,
  waiting pink, decision green (`--cat-*` in `tokens.css`, each above 6:1
  against the chip). A legend with the same swatches sits above the cards;
  the category is also in each chip's screen-reader text.
- **Scale.** Stacked, one 15-minute slot is `--slot` tall (14px, 16px on a
  phone) and is exactly one label line, so a chip's line clamp (`--lines`)
  depends on its duration only. Side by side the chips are tighter: 16px
  slots, 10.5px labels on 12px lines (three quarters of a slot), 2/4/0/8px
  padding, 4px column gaps, a 34px axis, and a denser clamp
  (`--lines-dense`), so a 30-minute chip shows two lines, a 60-minute one
  five. Both clamps are inline and come from `labelLines()` in `week.js`
  (unit-tested), never from the screen. Every task lasts at least 30
  minutes.
- **Data.** `apps/site/src/data/week.js`: per team, a catalog of tasks (id,
  category, kept) and a Monday-to-Friday schedule. Labels are in
  `home.day.teams.<team>.blocks`, categories in `home.day.kinds`. Decisions
  are always kept and waiting is never kept.
- **Motion** (`motion/calendar.js`, motion tiers only). The server HTML is
  the final AFTER. On reveal or a tab change, the eliminated tasks are copied
  from BEFORE into the same AFTER slots, then fade and collapse out, earliest
  slot first, and are removed: the end state is the no-JS DOM. It plays
  when 40% of the AFTER card is on screen; side by side both cards are in
  view together, so the eye sees the left week and the right one emptying.
- **Surfaces.** Both cards are plain white cards, `position: relative`, that
  make no stacking context and clip nothing at their edges, so the water can
  splash on the BEFORE card's top border and flow behind and around the
  AFTER card. The section clips sideways only (`overflow-x: clip`), so the
  water never widens the page. The cards sit 48px below the note and legend
  (36px on a phone), the room the BEFORE water's band needs. Stacked (below
  1180px) the cards are 64px apart, so the stream falling onto the AFTER card
  shows between them.
- **Water** (`motion/water.js`, the media tier only). An accent on the
  borders, never over the content: no chip, tab, title, note or legend is
  covered. Once the calendar is within a screen of the viewport (and after
  `load`), the card clips are created and put in the chosen team's cards,
  with the stream's copies; they move with the tabs. Each clip plays only
  from half a screen before it is on screen, and pauses in a hidden tab and
  on `pagehide`. Nothing is requested before, the server HTML has no video,
  and the CSS default is the finished calendar without water; reduced
  motion and Save-Data get none (and so no stream below the hero: the static
  page shows none, by design). Each card clip carries the box in its frame
  that is fitted to its card (`fit` in `media.json`, written by the
  pipeline) as custom properties, and `marketing.css` does the placement, in
  percentages of the card, so it follows every layout. No media was
  regenerated for this: the band, the strength and the stacking are all CSS
  masks, opacity and JS placement on the existing clips.
  - **BEFORE ("Today"): splashes around the top border.** The rain clip (a
    pale slab with streams falling onto its top edge and splashing) sits ON
    the card, multiplied (`mix-blend-mode: multiply`, its near-white lifted
    to white by `brightness(1.06)` so the band has no edge), at half
    strength (`--water-alpha`: 0.5; 0.4 stacked, where the clip is about 1.7
    times its side-by-side scale). The slab's top edge is the card's top
    border and it spans the card widened by `--water-out` (14px; 10px on a
    phone). A mask of four layers keeps a thin band: 40px over the top border
    (32px stacked, 28px on a phone), fading in from the page, and 10px under
    it (inside the card's 16-18px padding), plus side strips 12px out and 8px
    in, down to 120px (80px on a phone); everything is cut to the card's
    width plus that strip. So the splashes and droplets break along the top
    edge; the falling streams above and the drips below are masked away. The
    source has little water at the slab's side edges, so the side strips
    mostly stay empty.
  - **AFTER ("With an agent"): a thin flow down the sides and out below.**
    The clip sits at `z-index: -1` inside the card, under its white surface,
    which hides the slab's face. Its fit box (the inner edges of the two side
    sheets, the slab's top and bottom) is stretched onto the card
    (independent X and Y scale, `object-fit: fill`), with the sides tucked
    under the card by `--water-gap` (-3.5%; -4% stacked, -3% on a phone), so
    only the outer edge of each sheet shows, about 10-20px. It is at 60%
    strength, and the mask lets the water leave below within 56px (40px on
    a phone).
  - **The stream from the hero to the AFTER card.** `card-stream` is cut from
    the hero AFTER loop's graded frames: the column under the pebble, 64×250
    of the 1600×900 frame, from row 650 to the frame's bottom, centred on the
    stream. One clip is short, and stretching it would show, so it is
    stacked: copies of the same clip, each at its own time (the golden ratio
    of the loop apart), each showing only its rows below 40% (the clip
    narrows down the column, and its lower rows have the width the stream
    has at the hero's edge), fading in from 40% to 55% over the solid rows of
    the copy above, 45% of a copy apart. The first copy's solid rows start at
    the hero section's bottom edge (where the hero's stream is cut off); the
    last runs 24px under the AFTER card's top border. A copy wholly behind
    the BEFORE card (stacked layouts) is left out. All of them are children
    of the AFTER card at `z-index: -1`, so they paint under the page's text
    and the cards; the section intro, note and legend carry a white
    `text-shadow` halo, so where the stream passes behind them (through the
    middle of the paragraph on a phone, past the legend side by side) every
    glyph stays clear of it. `motion/water.js` measures where the hero's
    stream leaves the hero on screen (the hero media box and the stream's x
    from `media.json`, for the rendition in use), held at least 24px inside
    the card, and the hero's scale, and hands each copy `--stream-left`,
    `--stream-top`, `--stream-w` and its `--stream-hide` / `--stream-solid`
    rows. It re-measures whenever the page's box changes (a
    `ResizeObserver` on the body: resizes, fonts, images, a taller week) and
    each time the calendar comes near, so a later layout shift cannot leave
    the stream short of the card. Measured (`e2e/stream.spec.js` holds the x
    to 2px and the gap to 3px):

    | Layout | Viewport | Hero bottom → AFTER card top | Copies | Largest gap |
    |---|---|---|---|---|
    | side by side | 1440×900 | 654px | 7 | 0px |
    | side by side | 1180×820 | 591px | 6 | 0px |
    | stacked weeks | 1024×768 | 1252px (622 behind the BEFORE card) | 9 | 0px |
    | one day | 390×844 | 1363px (692 behind the BEFORE card) | 14 | 0px |

    With JavaScript off, reduced motion or Save-Data there are no copies:
    the hero's stream ends at the hero's edge and the page below is plain.
  - **How far the card water reaches** (measured in `e2e/water.spec.js`,
    which shoots the page with each card clip shown and hidden; it holds
    every changed pixel out of the content box and within 60px of the border
    box, 44px on a phone):

    | Viewport | BEFORE: above the top border | AFTER: below / left / right |
    |---|---|---|
    | 1440×900 | 36px | 49 / 12 / 22px |
    | 1024×768 | 28px | 50 / 12 / 20px |
    | 375×812 | 23px | 34 / 8 / 15px |
- Native radio tabs (`@forge/ui` `Tabs`) work without JavaScript.
- The weeks are illustrations with no totals, hours or percentages, and the
  page says so on every tab.

## The footer pool

The footer's background is the water that has fallen down the page, in 2D
with no perspective: a filled container seen exactly from the side, a flat
horizontal waterline (a thin meniscus) at the footer's top edge and the body
of water below it, clear and nearly colourless (a pale, neutral grey with a
whisper of cool, no green) with soft caustics. Now and then a drop
hits the line, dimples it and sends tiny bubbles sinking and light rings
drifting through the water. It is the shared footer, so every page has it.

- **The poster is CSS** (`.mk-footer` in `marketing.css`): AVIF through
  `image-set()`, WebP for the rest, `cover`, anchored at the top
  (`--pool-at: 50% 0%`). Blog, contact and legal get it with no JavaScript.
  Two renditions, both at the source's own scale (1 source pixel per pixel,
  nothing upscaled): the full band, 1920x532, and at 720px wide and under
  `footer-pool-narrow`, its centre 1080x532, which is all a phone's footer
  shows of it. The same media query sets `--pool-clip` (`wide`/`narrow`),
  which `motion/pool.js` reads to pick the matching clip.
  The footer sits outside the content wrapper, so the water spans the
  viewport edge to edge; only its copy is in `.mk-wrap`.
- **The waterline is the footer's top edge.** The band's first rows are pure
  white (the first row decodes at 254 and up in the AVIF), so the white
  page runs straight into the line, and the line is 1.5% of the band down
  (`media.json` `footer.pool.waterline`): about 6px at 1440 and 1024, and
  8px on a phone, where the band is drawn larger. The line is flat to a
  pixel and the same from edge to edge (the grade gives every column one
  row profile), so there is no box edge anywhere, only the water's own
  line. The footer has no border or tint.
- **Layout.** 112px of top padding (88px on a phone) leaves a strip of
  water between the line and the copy. At 1440 and 1024 the footer is about
  360px tall, shorter than the band drawn at the viewport's width (399px at
  1440), so the band is cropped at the bottom; on a 2x screen at 1440 the
  1920 band is drawn over 2880 device pixels (1.5x, the most the 1080p
  source allows). On a phone `cover` fits the footer's height (568px at
  390 wide) and shows the middle of the narrow rendition at 1.07 CSS pixels
  per source pixel (it was 1.3 when the band was encoded at 1600x440); the
  link columns sit two to a row under the brand there, which keeps the
  footer, and so the scale, down.
- **Readable copy.** The water is graded clear (mean luma 230, 2nd
  percentile 219), and its darkest moving tones (a drop's outline, a
  bubble) are floored by the grade (luma 160 before the water is made clear,
  about 193 after; see the pipeline). The footer's text is
  `--ink`/`--ink-2` with a soft halo of the page's white (`text-shadow`),
  and links underline on hover. `e2e/pool.spec.js` measures every piece of
  footer text against the darkest 2% of the water actually painted under
  it, without the halo: the lowest is 10.8:1 on the poster at 1440 (2x) and
  11.2:1 at 390 (3x), and 11.0:1 / 10.9:1 over the clip there (it was
  8.9 and 9.4 on the poster, 8.9 and 8.8 on the clip, with the green water).
- **Motion** (`motion/pool.js`, the media tier only, home page only). The
  home page hands the footer the clip's URLs (`data-pool`, from
  `Home.astro` through `Base.astro`). Once the footer is within half a
  screen (and after `load`), one looping `<video>` is created in the footer,
  `position: absolute; inset: 0`, `object-fit: cover` with the same
  `--pool-at` as the background, under the copy (`z-index: -1`), in the
  rendition the stylesheet's `--pool-clip` names (a resize across the
  query swaps it). Its WebM `<source>` carries its own codec string from
  `media.json` (`av01.0.05M.10`, 10-bit). It opens on the poster's own
  frame, so when it fades in (`is-ready`) nothing changes: measured at
  t = 0, the clip and the poster differ by about 0.6 levels on average
  (0.8 for the H.264). It is not masked: its top is the same white and line as the
  poster's. It pauses off screen, in a hidden tab and on `pagehide`; a
  refused `play()` removes it and leaves the poster (an `AbortError` from a
  pause is not a refusal). Reduced motion and Save-Data get the poster only.

## Fallbacks

| Case | What the visitor sees |
|---|---|
| No JS (and every page but home) | The AFTER poster, the stones (their float is CSS), the final calendar (side by side, stacked weeks or one day, by width) with no water on it; the footer's pool as its still poster. |
| Reduced motion | Posters with a crossfade instead of the crash, still stones, no videos (no water on the calendar, the pool's poster in the footer), no reveals. |
| Save-Data, 2g, or a device that reports under 4 GB (`deviceMemory`) | Motion, but posters only: no video requests; the crash is a poster crossfade and the footer is the pool's poster. A browser that reports no memory (Safari, Firefox) gets the clips. |
| `play()` refused (iOS Low Power Mode) | The posters crossfade; the state and the headline still change. |

## Media pipeline

`scripts/media/build-media.mjs` runs offline. Its sources are listed by
permanent URL in `scripts/media/sources.json`, and only the outputs are
committed (`apps/site/src/media/`). It does the following:

The hero clips are BEFORE (loop), the transition (once) and AFTER (loop), in
16:9 and 9:16 (the 9:16 ones extended below their frame, see "Portrait");
the card clips are the calendar's two loops and the stream onto the AFTER
card (cut from the hero AFTER loop); the footer pool is one wide loop.

1. **Grade to white.**
   - The void field is the per-pixel 90th percentile over all frames,
     low-passed and iterated so objects drop out.
   - The gain is `255 / field`, applied to the void only, using an object
     weight of `smoothstep(|frame − field|, 8, 56)`.
   - Near-white is soft-snapped to pure white, and exposure is normalised per
     frame.
   - The rain is white streaks in the soft overhead light, so graded to
     white with it, it vanishes. Hero clips keep 85% of that light in the
     cone over the stone (14% of the frame's width either side of it, fading
     out by 24%) and 40% on the wall either side, where the copy sits, in
     the top 65% of the frame (`LIGHT`, `keepMap`). Measured on the BEFORE
     loop, 12% down the frame: the cone sits at luma 224 (source 221) and
     the brightest streaks stand 20-36 above it (source 26-38); with the old
     flat 50% the cone was 234 and the streaks 16-22. The wall beside the
     copy is 252. A portrait clip's top, where the copy sits, goes to white.
   - **Card clips** (`cardPlate`) are cropped to their slab first, then
     divided by a clean plate of the slab and the wall: the wall is the
     90th percentile, low-passed over the wall only with objects iterated
     out; the slab's face is the median, low-passed over the face only, so
     drips, sheets and ripples drop out; the slab's sharp rim (7px either
     side of its edge) is the median of its calmest 8 frames, where it is
     dry. The slab and the wall come out white and the water keeps its own
     light and shade, ready to be multiplied over a white card.
   - **The footer pool** (`poolGrader`, `poolRows`, `buildPool`) is cropped
     to a band from 8 rows above its waterline (y 525 in the 1920x1080
     source, flat to a pixel across the frame) to the bottom, kept at the
     source's scale: 1920x532 (554 rows less the squeezed meniscus). The 15
     rows above the line are a grey strip of the surface seen from just
     above, and the 34 below it (the meniscus moving up and down a few
     pixels as the surface rocks, and the surface's underside reflected in
     it) read as a thick glassy band; both are perspective. The strip is
     cropped away and graded to white, and the meniscus is squeezed into 12
     rows, so the footer's edge is one thin line with the water right under
     it. Then everything that does not move (the white, the meniscus, the
     water's tone, a vignette that takes the white from luma 236 in the
     middle to 212 at the edges, and a meniscus drawn near-black at the
     edges and mid-grey in the middle) is the per-pixel median frame, and
     it is replaced by one row profile for every column: the centre third's
     median, white-balanced on a patch of the white above the line (to
     255), and pure white above the line. What moves (drops, bubbles, rings,
     caustics) is each frame's difference from the median, added back as
     luma. Its darkest tones are lifted onto a soft floor, also in luma
     (below 200, `v -> 160 + 40 * sqrt(v / 200)`). Then the water is made
     clear and given one colour (`POOL.clear`, `POOL.tint`): its distance
     from white is scaled by 0.65 (lighter, the caustics' shape kept), and
     per channel by the tint (1.069, 0.994, 0.855, normalised to keep the
     luma), a whisper of cool grey with no green. The source's water is
     cyan: on the page it measured Lab a* -4.5, b* -1.2 (mean RGB 207, 220,
     219, luma 217); it now measures a* +0.3, b* -2.0 on the poster and
     a* -0.5, b* -1.4 over the clip (mean RGB 229, 230, 234, luma 230). The
     grade stays in floating point up to the encode (a 16-bit FFV1 RGB
     intermediate), and the posters are dithered to 8 bits.
2. **Loop:** the last second is cross-faded into the first. The transition is
   not looped. The AFTER card loop starts at source frame 48: before that
   the flow builds up from a dry slab (those frames still feed the plate).
   The pool's source already ends on its first frame (PSNR 40.3 dB between
   them, as close as its own frame steps), so it is not cross-faded (that
   would ghost two sets of caustics together): it plays frames 0-142 and
   wraps (`seamless`). Frame 0, its poster, is one of its calmest: no drop
   in the water under the copy.
3. **Encode** AV1 WebM and H.264 MP4: closed GOP, BT.709, `+faststart`, no
   audio. The pool is shown full-bleed, so it is encoded for quality, in
   two renditions (the band and its centre 1080 for phones): AV1 in 10 bits
   (`yuv420p10le`, SVT-AV1 CRF 16, preset 4, `tune=0`), where its flat
   gradients keep no 8-bit steps and the blocks stay under one 8-bit level
   from the graded frames; H.264 at CRF 20, preset slower, `aq-mode=3` (bits
   go to the flat areas) and `deblock=-1,-1`. The YUV conversion is BT.709,
   as the streams are tagged. (At the old CRF 42 at 1600 wide, AV1 showed
   64px blocks in the water; a dither in the H.264's 8-bit input was tried
   and does not survive its quantiser.)
4. **Write** the hero loops' posters (first frame), the pool's posters (its
   first frame in both renditions, as AVIF quality 85 4:4:4 and WebP
   quality 92, served as they are by the footer's CSS),
   the stones and `media.json` (the crash's duration, each card clip's
   aspect and fit box, where the hero AFTER loop's stream leaves each
   rendition and the card stream's scale, the portrait extension, the pool's
   aspects, waterline and AV1 codec strings, and the stone counts). The card
   clips need no posters: they only play over the
   finished card.

`node scripts/media/build-media.mjs --check` reports sizes, decoded void luma,
the loop-seam PSNR (beside the clip's median frame-to-frame PSNR) and the
crash's two cuts (PSNR between the BEFORE loop's first frame and the crash's
first, and between the crash's last frame and the AFTER loop's first).
`--only card-before,card-after` rebuilds some clips and patches their entries
in `media.json` (`card-stream` needs `hero-after-16x9` in the same run,
and `hero-transition-9x16` needs `hero-before-9x16`). The card stream's
seam is the hero loop's own; measured on a narrow column of moving water,
its frame steps run 21-35 dB, so it is held to the low end of them (the
5th percentile). For the pool, the void luma is measured on the white rows
above the waterline (the rest of its frame is water), and as a seamless
loop its seam is held to the frame steps either side of it.

| Check | Target | Current |
|---|---|---|
| Void luma | ≥ 234 | 235 on every clip |
| Loop-seam PSNR | ≥ 30 dB, or, for water busier than that frame to frame, no worse than its median frame step less 1 dB | hero 33.6–41.3 dB; AFTER card 32.1 dB; BEFORE card 29.6 dB (its splashes step at 30.3 dB); card stream 22.7 dB (held to its 5th-percentile step, 22.6 dB) |
| Crash cut in / out, 16:9 | as close as the BEFORE loop to itself (about 31–33 dB frame to frame, the rain moving) | 29.7 / 32.7 dB |
| Crash cut in / out, 9:16 (whole frame, extension included) | the same | 33.4 / 33.3 dB |
| Crash clip | starts at the shatter | 3.75 s (first 6 source frames dropped) |
| Desktop hero media (BEFORE, transition and AFTER, WebM) | ≤ 2.5 MB | about 1.2 MB (661 + 420 + 163 KB; MP4 1.8 MB) |
| Mobile hero media (WebM, 720×1792 with the extension) | ≤ 1.2 MB | about 0.63 MB (339 + 228 + 76 KB; MP4 0.86 MB) |
| Calendar water (WebM, every tier with media) | ≤ 960 wide | 960×510 + 710×556 + 64×250, 233 + 52 + 13 KB (MP4 332 + 77 + 15 KB) |
| Footer pool: void luma (the white above the line) / seam | ≥ 234 / no worse than the steps either side less 1 dB | 236 / 42.3 dB (steps 42.1 dB) |
| Footer pool clip, desktop (WebM, home, media tier) | ≤ 1 MB, the source's full width | 1920×532, 143 frames (5.96 s), 10-bit AV1, 489 KB (MP4 1.47 MB) |
| Footer pool clip, phone (≤ 720px) | ≤ 0.5 MB | 1080×532, 300 KB (MP4 850 KB) |
| Footer pool poster (every page) | sharp at 2x; the clip's first frame | desktop AVIF 8 KB, WebP 15 KB; phone AVIF 4 KB, WebP 9 KB; 0.6 levels from the clip's frame 0 on average |

**Sources and credits.** Everything was generated on Higgsfield (the clips
by URL in `sources.json`). The stills are FLUX 3 Image; every clip (the
hero's BEFORE, crash and AFTER loops, the two card clips and the footer
pool) is Gemini Omni Flash 1.1 image-to-video:

- **The BEFORE still** (`f59fa925`): the raw rock in visible, splashy rain.
- **The AFTER still** (`5df7194f`, `hf_20261013_124113_5df7194f-...png`,
  FLUX 3 edited from the first AFTER still `01381381`): the same smooth
  elliptical polished pebble in the same place; one thin stream falls onto
  its top, spreads into a smooth glassy film and leaves from its lowest point
  as one stream. No rain, no drops in the air, no beads on the pebble.
- **The hero loops:** image-to-video with the same still as both start and
  end frame, the camera locked off and only the water moving. The AFTER loop
  (`1295d48a`) builds its flow for its first 2.5 s, so the loop is cut from
  frame 60 (`AFTER_HEAD`); from there both streams run and keep moving.
- **The transition** (`b60be4ea`): image-to-video from the BEFORE still to
  the AFTER still: the rock bursts, the pebble is left, the rain stops and
  the water draws together into the two thin streams.

The first AFTER loop (`f9e229e4`) and transition (`f7f9f5f2`) are retired:
the rain over the pebble and the beads on its top were frozen in the source
(the mean of all its frames was its first frame), which read as fake, and
its 1 s loop cross-fade showed. None of their files is referenced any more.
- **The card clips:** image-to-video of a pale static slab under water: for
  BEFORE, uneven streams splashing over its top edge (horizontal, at about
  40% of the frame) and dripping down its face; for AFTER, one stream
  landing on its top edge, running down both sides and rejoining below.
- **The footer pool:** a still (FLUX 3, `a383150c`,
  `hf_20261013_063135_a383150c-...png`) of a filled container seen exactly
  from the side, with no perspective: pure white above a perfectly flat
  waterline (a thin bright meniscus), a pale grey-blue body of water with
  soft caustics below it; then a 6 s, 16:9, 1080p loop (Gemini Omni Flash
  1.1, `62dfd87a`) with that still as its start and end frame: now and then
  a drop hits the waterline, splashes on the line and sends tiny bubbles
  sinking, and light rings drift in the water, the camera locked off. It
  replaced a first pool (`3becacc6` / `b6cbc4b2`) that showed the water's
  surface from above, receding; the owner rejected its perspective, and
  none of its files is referenced any more.

The polished faceted crystal of the first version is retired; none of its
clips or stills is referenced any more. A clip is rejected if the stone
drifts or the camera moves. Web outputs are
1600 wide at most (720 on portrait), except the footer pool at its
source's 1920; the generation stills are 2K, and nothing 4K ships.

All three portrait hero clips are composed frame by frame from the landscape
clips (`composePortrait` in the script; see "Portrait" above). A separately
generated 9:16 BEFORE clip was used before; it was framed for the old
right-hand crystal and could not be matched to the centred composition, so it
was dropped from `sources.json`. Outpainting was tried first and recomposed
the scene.

**Generating anything new costs credits, and the owner approves the total
first.**
