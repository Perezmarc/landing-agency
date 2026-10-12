# Landing page: art direction and motion

The decisions behind the homepage, so they live in the repository rather than
in a design session. Change them deliberately, and update this file when you do.

## The image

Rain falls on a rough, raw quartz crystal and breaks into messy drops. The
crystal becomes polished, and the water leaves it as **one calm stream**. The
water lives in the hero; below it the page is calm white with still crystal
stones. (Water may come back further down, but only as dedicated clips attached
to specific elements, never as a continuous line down the page.)

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
screen through the burst, and a normal scroll sees the whole 2.46 s crash. The
crash is never scrubbed: the extra length only keeps the stage in view while
the clip plays on its own clock. The layers, bottom to top:

1. the AFTER poster and AFTER loop (the polished crystal, one stream);
2. the transition clip, which plays once;
3. the BEFORE layer (the raw rock in the rain): poster and loop;
4. the copy.

The transition clip's first frame is the raw rock and its last frame is the
polished crystal: the rock shatters, its fragments fly out, and the water
gathers into one stream. Every swap between layers is therefore invisible.

States (`motion/hero-state.js`): `before → crashing → after → reassembling`.

- The first scroll past 24px crashes; only `scrollY ≤ 4` goes back.
- A fling, a hash link or a restored scroll position (a first reading already
  past the pin) snaps to the end state with no crash.
- The state is exposed as `data-hero-state`.

The crash clip is 2.46 s (59 frames). The source holds the unchanged rock for
0.58 s, so the pipeline drops its first 13 frames (`CRASH_HEAD`): the clip
opens one frame before the cracks, the burst follows 0.13 s later, the
polished crystal shows from about 0.7 s, and the fragments clear by the end.
It runs on this timeline:

| Time | What happens |
|---|---|
| trigger | `play()` is called on the clip; the BEFORE layer stays up (`is-arming`). |
| first presented frame | BEFORE is cut and the clip shows (`is-transitioning`). |
| + 700 ms (`--delay-hero-crystal`) | The headline's black line moves from the first to the second. |
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
saving.") is black and the second grey; once the polished crystal shows, the second line is black and the
first grey. The server HTML, like the poster, is the AFTER.

Going back fades the BEFORE layer in over `--dur-hero-fade` (400 ms). Devices
that get no video crossfade the two posters instead.

### Portrait

All three 9:16 hero clips (BEFORE, crash, AFTER) are composed from the 16:9
ones (`composePortrait`), so the crystal has the same place and size in each
and the cuts stay invisible. The landscape frame is scaled until the crystal is
61% of the portrait width, centred, with its centre at 80% of the height.
At that scale the landscape frame covers the whole width and runs past the
bottom, so nothing around or below the crystal is invented (the old
composition repeated a strip of each frame down the stream, which stacked
fragments into squares during the crash). Above the crystal the frame
feathers into a still, smooth plate that the grade takes to white, so the copy
sits on white and flying fragments fade out rather than meet a seam. The media
box is anchored to the stage's bottom: on a phone it is exactly the stage, and
the crystal sits below the buttons from 375×740 to 430×932 (on a 375×667
iPhone SE the second button overlaps its top).

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
- **Surfaces.** Both cards are plain white cards, `position: relative`, with
  nothing clipped at their edges, so a later water layer can splash over the
  BEFORE card's top border and flow around the AFTER card.
- Native radio tabs (`@forge/ui` `Tabs`) work without JavaScript.
- The weeks are illustrations with no totals, hours or percentages, and the
  page says so on every tab.

## Fallbacks

| Case | What the visitor sees |
|---|---|
| No JS | The AFTER poster, the stones (their float is CSS), the final calendar (side by side, stacked weeks or one day, by width). |
| Reduced motion | Posters with a crossfade instead of the crash, still stones, no videos, no reveals. |
| Save-Data, 2g, or a device that reports under 4 GB (`deviceMemory`) | Motion, but posters only: no video requests; the crash is a poster crossfade. A browser that reports no memory (Safari, Firefox) gets the clips. |
| `play()` refused (iOS Low Power Mode) | The posters crossfade; the state and the headline still change. |

## Media pipeline

`scripts/media/build-media.mjs` runs offline. Its sources are listed by
permanent URL in `scripts/media/sources.json`, and only the outputs are
committed (`apps/site/src/media/`). It does the following:

The hero clips are BEFORE (loop), the transition (once) and AFTER (loop), in
16:9 and 9:16.

1. **Grade to white.**
   - The void field is the per-pixel 90th percentile over all frames,
     low-passed and iterated so objects drop out.
   - The gain is `255 / field`, applied to the void only, using an object
     weight of `smoothstep(|frame − field|, 8, 56)`.
   - Near-white is soft-snapped to pure white, and exposure is normalised per
     frame.
   - Hero clips keep half of the overhead light above the crystal; a
     portrait clip's top, where the copy sits, goes to white.
2. **Loop:** the last second is cross-faded into the first. The transition is
   not looped.
3. **Encode** AV1 WebM and H.264 MP4: closed GOP, BT.709, `+faststart`, no
   audio.
4. **Write** the loops' posters (first frame), the stones and `media.json`
   (the crash's duration and the stone counts).

`node scripts/media/build-media.mjs --check` reports sizes, decoded void luma,
the loop-seam PSNR and the crash's two cuts (PSNR between the BEFORE loop's
first frame and the crash's first, and between the crash's last frame and the
AFTER loop's first).

| Check | Target | Current |
|---|---|---|
| Void luma | ≥ 234 | 235 on every clip |
| Loop-seam PSNR | ≥ 30 dB | 33–46 dB |
| Crash cut in / out, 16:9 | as close as the BEFORE loop to itself (about 31–32 dB frame to frame, the rain moving) | 29.7 / 31.5 dB |
| Crash cut in / out, 9:16 | the same | 33.1 / 33.6 dB |
| Crash clip | starts at the shatter | 2.46 s (first 13 source frames dropped) |
| Desktop hero media (BEFORE, transition and AFTER, WebM) | ≤ 2.5 MB | about 1.0 MB (556 + 321 + 130 KB) |
| Mobile hero media (WebM) | ≤ 1.2 MB | about 0.45 MB (244 + 154 + 53 KB) |

**Sources and credits.** Everything was generated on Higgsfield:

- **The BEFORE still:** a `flux_3_image` still chosen in the design session.
- **The polished AFTER still:** a `flux_3_image` edit of the BEFORE still that
  keeps the same silhouette, position and framing.
- **The loops:** Gemini Omni Flash 1.1 image-to-video with the same still as
  both start and end frame. The prompt was "static locked-off camera, only the
  water moves".
- **The transition:** Gemini Omni Flash 1.1 from the BEFORE still to the AFTER
  still.

A clip is rejected if the crystal drifts or the camera moves. Web outputs are
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
