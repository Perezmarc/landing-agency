# Landing page: art direction and motion

The decisions behind the homepage, so they live in the repository rather than
in a design session. Change them deliberately, and update this file when you do.

## The image

Rain falls on a rough, raw quartz crystal and breaks into messy drops. The
crystal shatters, a smooth polished pebble is left, and the water leaves it as
**one calm stream**. The water lives in the hero; below it the page is calm
white with still crystal stones. Water comes back further down only as
dedicated clips attached to specific elements (the calendar's two cards),
never as a continuous line down the page.

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

## Two clocks

| Clock | Drives | Never |
|---|---|---|
| **Time** | The water. Every clip loops at normal speed. | Makes anything happen. |
| **Scroll** | One trigger (crash and reassemble), and the page's own scrolling. | Speeds up, slows down or scrubs the water. |

Scrubbing video with scroll ties the water to the visitor's thumb: it freezes
when they stop and races when they fling. Two loops and one triggered swap keep
the water natural.

## The hero

A 250svh section with a sticky 100svh stage: the stage stays pinned for 1.5
screens of scroll (`motion/hero.js` reads the pin from the layout). That is
long enough that a brisk continuous wheel (2000 px/s) still has the stage on
screen through the burst, and a normal scroll sees the 3.75 s crash. The
crash is never scrubbed: the extra length only keeps the stage in view while
the clip plays on its own clock. The layers, bottom to top:

1. the AFTER poster and AFTER loop (the polished pebble, one stream);
2. the transition clip, which plays once;
3. the BEFORE layer (the raw rock in the rain): poster and loop;
4. the copy.

The transition clip's first frame is the raw rock and its last frame is the
polished pebble: the rock shatters, its fragments fly out, the pebble is left,
and the water gathers into one stream. Every swap between layers is therefore
invisible.

States (`motion/hero-state.js`): `before → crashing → after → reassembling`.

- The first scroll past 24px crashes; only `scrollY ≤ 4` goes back.
- A fling, a hash link or a restored scroll position (a first reading already
  past the pin) snaps to the end state with no crash.
- The state is exposed as `data-hero-state`.

The crash clip is 3.75 s (90 frames). The source holds the unchanged rock for
its first 7 frames, so the pipeline drops its first 6 (`CRASH_HEAD`): the clip
opens one frame before the burst, the pebble shows clear of the fragments at
about 1.25 s, a drop forms under it from about 2 s, and one stream runs from
about 2.7 s to the end. It runs on this timeline:

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
back) its first line ("Find out how much time your whole team could be
saving.") is black and the second grey; once the polished pebble shows, the second line is black and the
first grey. The server HTML, like the poster, is the AFTER.

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
sits on white and flying fragments fade out rather than meet a seam. The media
box is anchored to the stage's bottom: on a phone it is exactly the stage, and
the rock and the pebble sit below the buttons from 375×667 (iPhone SE) to
430×932.

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
  splash over the BEFORE card's top border and flow behind and around the
  AFTER card. The section clips sideways only (`overflow-x: clip`), so the
  water never widens the page.
- **Water** (`motion/water.js`, the media tier only). Once the calendar is
  within half a screen of the viewport (and after `load`), two looping clips
  are created and put in the chosen team's cards; they move with the tabs,
  and pause off screen, in a hidden tab and on `pagehide`. Nothing is
  requested before, the server HTML has no video, and the CSS default is the
  finished calendar without water; reduced motion and Save-Data get none.
  Each clip carries the box in its frame that is fitted to its card (`fit`
  in `media.json`, written by the pipeline) as custom properties, and
  `marketing.css` does the placement, in percentages of the card, so it
  follows every layout:
  - **BEFORE ("Today"): on the card.** A pale slab with uneven streams
    splashing over its top edge. The clip is cropped to the slab's width, so
    the slab spans the card's border box, its top edge on the card's top
    border; it is multiplied (`mix-blend-mode: multiply`), so its white
    disappears and only the water shows. A mask keeps 56px of streams above
    the border and fades the drips out within 100px of it, so no chip label
    is covered for long.
  - **AFTER ("With an agent"): behind the card.** One stream lands on a slab,
    runs down just inside both side edges and leaves below as one stream. The
    clip sits at `z-index: -1` inside the card, under its white surface,
    which hides the slab's face and its ripples. Its fit box is the inner
    edges of the two side sheets and the slab's top and bottom, stretched
    onto the card (independent X and Y scale, `object-fit: fill`: the water
    is vertical, so a taller card only lengthens it), so the sheets run just
    outside the side borders, the stream enters above the card and the two
    sheets rejoin below it. The mask fades the stream in 140px above and out
    160px below.
  - **Per layout.** Side by side (1180px and up) the AFTER sheets show in
    full: on the right in the page margin, on the left in the 16px gap
    between the cards. Stacked weeks (721-1179px) the card is nearly the
    page's width with 20px margins, so the sheets are tucked 2% of the card
    under it (`--water-gap: -2%`) and what shows fits the margin. On a phone
    (one day, 720px and below) both clips are kept: the BEFORE splash fits
    the narrow card well, and the AFTER clip is stretched about 2.7 times
    vertically, which the vertical sheets and the long V below carry.
- Native radio tabs (`@forge/ui` `Tabs`) work without JavaScript.
- The weeks are illustrations with no totals, hours or percentages, and the
  page says so on every tab.

## Fallbacks

| Case | What the visitor sees |
|---|---|
| No JS | The AFTER poster, the stones (their float is CSS), the final calendar (side by side, stacked weeks or one day, by width), no water. |
| Reduced motion | Posters with a crossfade instead of the crash, still stones, no videos (no water on the calendar), no reveals. |
| Save-Data, 2g, or a device that reports under 4 GB (`deviceMemory`) | Motion, but posters only: no video requests; the crash is a poster crossfade. A browser that reports no memory (Safari, Firefox) gets the clips. |
| `play()` refused (iOS Low Power Mode) | The posters crossfade; the state and the headline still change. |

## Media pipeline

`scripts/media/build-media.mjs` runs offline. Its sources are listed by
permanent URL in `scripts/media/sources.json`, and only the outputs are
committed (`apps/site/src/media/`). It does the following:

The hero clips are BEFORE (loop), the transition (once) and AFTER (loop), in
16:9 and 9:16; the card clips are the calendar's two loops.

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
2. **Loop:** the last second is cross-faded into the first. The transition is
   not looped. The AFTER card loop starts at source frame 48: before that
   the flow builds up from a dry slab (those frames still feed the plate).
3. **Encode** AV1 WebM and H.264 MP4: closed GOP, BT.709, `+faststart`, no
   audio.
4. **Write** the hero loops' posters (first frame), the stones and
   `media.json` (the crash's duration, each card clip's aspect and fit box,
   and the stone counts). The card clips need no posters: they only play
   over the finished card.

`node scripts/media/build-media.mjs --check` reports sizes, decoded void luma,
the loop-seam PSNR (beside the clip's median frame-to-frame PSNR) and the
crash's two cuts (PSNR between the BEFORE loop's first frame and the crash's
first, and between the crash's last frame and the AFTER loop's first).
`--only card-before,card-after` rebuilds some clips (and leaves `media.json`).

| Check | Target | Current |
|---|---|---|
| Void luma | ≥ 234 | 235 on every clip |
| Loop-seam PSNR | ≥ 30 dB, or, for water busier than that frame to frame, no worse than its median frame step less 1 dB | hero 33.6–40.4 dB; AFTER card 32.5 dB; BEFORE card 29.5 dB (its splashes step at 30.1 dB) |
| Crash cut in / out, 16:9 | as close as the BEFORE loop to itself (about 31–33 dB frame to frame, the rain moving) | 29.7 / 32.7 dB |
| Crash cut in / out, 9:16 | the same | 32.0 / 34.4 dB |
| Crash clip | starts at the shatter | 3.75 s (first 6 source frames dropped) |
| Desktop hero media (BEFORE, transition and AFTER, WebM) | ≤ 2.5 MB | about 1.2 MB (661 + 420 + 163 KB; MP4 1.8 MB) |
| Mobile hero media (WebM) | ≤ 1.2 MB | about 0.57 MB (299 + 211 + 70 KB; MP4 0.72 MB) |
| Calendar water (WebM, every tier with media) | ≤ 960 wide | 960×402 + 710×680, 195 + 57 KB (MP4 267 + 82 KB) |

**Sources and credits.** Everything was generated on Higgsfield (the clips
by URL in `sources.json`):

- **The BEFORE still** (`f59fa925`): the raw rock in visible, splashy rain.
- **The AFTER still** (`01381381`, `hf_20261012_161912_01381381-...png`): a
  smooth elliptical polished pebble in the same place, smooth water, one
  stream.
- **The hero loops:** image-to-video with the same still as both start and
  end frame, the camera locked off and only the water moving.
- **The transition:** image-to-video from the BEFORE still to the AFTER
  still: the rock bursts, the pebble is left and the water gathers into one
  stream.
- **The card clips:** image-to-video of a pale static slab under water: for
  BEFORE, uneven streams splashing over its top edge (horizontal, at about
  40% of the frame) and dripping down its face; for AFTER, one stream
  landing on its top edge, running down both sides and rejoining below.

The polished faceted crystal of the first version is retired; none of its
clips or stills is referenced any more. A clip is rejected if the stone
drifts or the camera moves. Web outputs are
1600 wide at most (720 on portrait); the generation stills are 2K, and nothing
4K ships.

All three portrait hero clips are composed frame by frame from the landscape
clips (`composePortrait` in the script; see "Portrait" above). A separately
generated 9:16 BEFORE clip was used before; it was framed for the old
right-hand crystal and could not be matched to the centred composition, so it
was dropped from `sources.json`. Outpainting was tried first and recomposed
the scene.

**Generating anything new costs credits, and the owner approves the total
first.**
