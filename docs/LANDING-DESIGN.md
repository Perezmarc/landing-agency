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

A 150svh section with a sticky 100svh stage. The layers, bottom to top:

1. the AFTER poster and AFTER loop (the polished crystal, one stream);
2. the transition clip, which plays once;
3. the BEFORE layer (the raw rock in the rain): poster and loop;
4. the copy.

The transition clip's first frame is the raw rock and its last frame is the
polished crystal: the rock shatters, its fragments fly out, and the water
gathers into one stream. Every swap between layers is therefore invisible.

States (`motion/hero-state.js`): `before → crashing → after → reassembling`.

- The first scroll past 24px crashes; only `scrollY ≤ 4` goes back.
- A fling, a hash link or a restored scroll position snaps to the end state
  with no crash.
- The state is exposed as `data-hero-state`.

The crash runs on this timeline:

| Time | What happens |
|---|---|
| 0 | BEFORE is cut and the transition clip plays from its first frame. |
| 250 ms before the end | The AFTER loop starts underneath. |
| end | The transition fades out over the AFTER loop. |

Going back fades the BEFORE layer in over `--dur-hero-fade` (400 ms). Devices
that get no video crossfade the two posters instead.

## The calendar

"We are taking tasks off your week": two calendars, stacked, on one time
axis. **BEFORE** ("Today") lists every task of the week, the decisions
included. **AFTER** ("With an agent") is the same calendar minus the
eliminated tasks: the kept ones stay in exactly the same day and slot, with
the same colour, and every eliminated task leaves an empty space. Nothing is
added, moved or condensed; the empty grid is the message.

- **Week or day, by CSS alone.** From 721px up, five day columns (Mon–Fri)
  share one hour axis. At 720px and below (the site's mobile breakpoint) a
  phone shows Monday alone, so Monday holds every category in every team
  (`week.test.js`). Weekday names come from `Intl.DateTimeFormat` (short,
  pinned dates, UTC), so they need no catalog strings.
- **Chips.** Near-black (`--task-chip`, white text at 18:1) with a solid
  4px left bar in the category's colour: manual work blue, chasing amber,
  waiting pink, decision green (`--cat-*` in `tokens.css`, each above 6:1
  against the chip). A legend with the same swatches sits above the cards;
  the category is also in each chip's screen-reader text.
- **Scale.** One 15-minute slot is `--slot` tall and is exactly one label
  line, so a chip's line clamp (`--lines`, inline) depends on its duration
  only. Every task lasts at least 30 minutes.
- **Data.** `apps/site/src/data/week.js`: per team, a catalog of tasks (id,
  category, kept) and a Monday-to-Friday schedule. Labels are in
  `home.day.teams.<team>.blocks`, categories in `home.day.kinds`. Decisions
  are always kept and waiting is never kept.
- **Motion** (`motion/calendar.js`, motion tiers only). The server HTML is
  the final AFTER. On reveal or a tab change, the eliminated tasks are copied
  from BEFORE into the same AFTER slots, then fade and collapse out, earliest
  slot first, and are removed: the end state is the no-JS DOM.
- **Surfaces.** Both cards are plain white cards, `position: relative`, with
  nothing clipped at their edges, so a later water layer can splash over the
  BEFORE card's top border and flow around the AFTER card.
- Native radio tabs (`@forge/ui` `Tabs`) work without JavaScript.
- The weeks are illustrations with no totals, hours or percentages, and the
  page says so on every tab.

## Fallbacks

| Case | What the visitor sees |
|---|---|
| No JS | The AFTER poster, the stones (their float is CSS), the final calendar (week or day by width). |
| Reduced motion | Posters with a crossfade instead of the crash, still stones, no videos, no reveals. |
| Save-Data, 2g or a weak device | Motion, but posters only: no video requests; the crash is a poster crossfade. |

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
   - Hero clips keep half of the overhead light in the top of the frame.
2. **Loop:** the last second is cross-faded into the first. The transition is
   not looped.
3. **Encode** AV1 WebM and H.264 MP4: closed GOP, BT.709, `+faststart`, no
   audio.
4. **Write** the loops' posters (first frame), the stones and `media.json`
   (the crash's duration and the stone counts).

`node scripts/media/build-media.mjs --check` reports sizes, decoded void luma
and the loop-seam PSNR.

| Check | Target | Current |
|---|---|---|
| Void luma | ≥ 234 | 235 on every clip |
| Loop-seam PSNR | ≥ 30 dB | 31–43 dB |
| Desktop hero media (BEFORE, transition and AFTER, WebM) | ≤ 2.5 MB | about 1.05 MB |
| Mobile hero media (WebM) | ≤ 1.2 MB | about 0.4 MB |

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

The portrait BEFORE frame was composed locally from the 16:9 still. The
portrait transition and AFTER are composed frame by frame from the landscape
clips (`composePortrait` in the script). Outpainting was tried first and
recomposed the scene.

**Generating anything new costs credits, and the owner approves the total
first.**
