# Landing page: art direction and motion

The decisions behind the homepage, so they live in the repository rather than
in a design session. Change them deliberately, and update this file when you do.

## The image

Rain falls on a rough, raw quartz crystal and breaks into messy drops. The
crystal becomes polished, and the water leaves it as **one calm stream**. That
stream then runs down the whole page, to the final CTA, where it thins into its
last drops.

- **Light:** soft, neutral, from above. No colour.
- **Page:** pure white. Every image and clip is graded to it, so nothing reads
  as a box, and every section is transparent so the stream is continuous.
- **Material discipline:** crystal and water only. Small raw fragments appear
  near the problem section; polished pebbles further down.
- **Palette:** white and warm grey, near-black ink, one sage accent. Headlines
  are light and tight: a grey line, then a black line.

## Page order

1. Hero: the crash.
2. A day, before and after: six team tabs.
3. The problem: "Your process document is not your process."
4. How we find the real process.
5. Sort every step. The pebble moment sits beside "An agent".
6. Supplier invoices, step by step (an illustration, labelled as one).
7. How an engagement works.
8. Built on your systems.
9. FAQ.
10. Final CTA, with the stream's last drops.

## Two clocks

| Clock | Drives | Never |
|---|---|---|
| **Time** | The water. Every clip loops at normal speed; the rail flows on a fixed CSS timer. | Makes anything happen. |
| **Scroll** | One trigger (crash and reassemble), and the page's own scrolling. | Speeds up, slows down or scrubs the water. |

Scrubbing video with scroll ties the water to the visitor's thumb: it freezes
when they stop and races when they fling. Two loops and one triggered swap keep
the water natural.

## The hero

A 150svh section with a sticky 100svh stage. The layers, bottom to top:

1. the AFTER poster and AFTER video (polished crystal, one stream);
2. the BEFORE layer (raw crystal in the rain): poster and video;
3. the burst canvas (only during the crash);
4. the copy.

States (`motion/hero-state.js`): `before → crashing → after → reassembling`.

- The first scroll past 24px crashes; only `scrollY ≤ 4` reassembles.
- A fling, a hash link or a restored scroll position snaps to the end state
  with no burst.
- A reversal mid-burst runs back from where it is.
- The state is exposed as `data-hero-state`.

The crash runs on this timeline:

| Time | What happens |
|---|---|
| 0 ms | BEFORE pauses and the canvas takes over the crystal. |
| 0–1400 ms | About 600–8000 particles fly out and fade. The count depends on the tier. |
| 120 ms | AFTER starts playing. |
| 150–600 ms | A radial wipe from the crystal's centre opens the BEFORE layer. |
| 600–1300 ms | The rail's mask "pours" down into the page. |

The reverse takes 900 ms.

## The stream rail

One element down `.mk-flow`, at exactly the hero's stream exit:

```
--rail-x = 50cqw + (exit-x − 0.5) × max(100cqw, 177.78svh)
```

On portrait screens the 9:16 rendition is used and `177.78svh` becomes
`56.25svh`.

- Its picture is a short transparent strip of the stream, repeated vertically
  and slid down one tile per `--flow-period` by a compositor animation.
- It is part of the document, so it scrolls exactly like the text: no parallax
  and no lag.
- **Moments** (the pebble and the end) are clips placed on the rail. Each
  enters and leaves the frame at its centre, at the rail's stream width, and
  its edges are feathered. `streams.test.js` holds every clip to this.

Rail x per breakpoint:

| Viewport | Stream x | Layout |
|---|---|---|
| Landscape | about 68% (the hero exit) | Copy columns stay within about 46% of the width. |
| Portrait | about 76% of the 9:16 frame (about 82% on a 375px phone) | Copy gets a right padding, so text never sits on the stream; the pebble gets its own gap. |

## The calendar

- Native radio tabs (`@forge/ui` `Tabs`) work without JavaScript.
- The AFTER card is frosted glass over the rail, so its free time shows the
  stream.
- No ancestor of that card may carry an opacity, filter, mask, clip-path,
  `mix-blend-mode` or `will-change`, or the glass stops seeing through.
- The FLIP animation runs in `motion/calendar.js`.
- The days are illustrations (`apps/site/src/data/day.js`) with no totals,
  hours or percentages, and the page says so on every tab.

## Fallbacks

| Case | What the visitor sees |
|---|---|
| No JS | The AFTER poster, a still stream, the final calendar. |
| Reduced motion | Posters with a 300 ms crossfade instead of the crash, a still stream, no videos, no reveals. |
| Save-Data, 2g or a weak device | Motion, but posters only: no video requests and no particles. |
| No WebGL2 | Videos and the wipe, with no particles. |

## Media pipeline

`scripts/media/build-media.mjs` runs offline. Its sources are listed by
permanent URL in `scripts/media/sources.json`, and only the outputs are
committed (`apps/site/src/media/`). It does the following:

1. **Grade to white.**
   - The void field is the per-pixel 90th percentile over all frames,
     low-passed and iterated so objects drop out.
   - The gain is `255 / field`, applied to the void only, using an object
     weight of `smoothstep(|frame − field|, 8, 56)`.
   - Near-white is soft-snapped to pure white, and exposure is normalised per
     frame.
   - Hero clips keep half of the overhead light in the top of the frame.
2. **Loop:** the last second is cross-faded into the first.
3. **Encode** AV1 WebM and H.264 MP4: closed GOP, BT.709, `+faststart`, no
   audio.
4. **Write** the posters (first frame), the rail strip, the burst cutouts, the
   stones and `streams.json`.

`node scripts/media/build-media.mjs --check` reports sizes, decoded void luma
and the loop-seam PSNR.

| Check | Target | Current |
|---|---|---|
| Void luma | ≥ 234 | 235 on every clip |
| Loop-seam PSNR | ≥ 30 dB | 31–43 dB |
| Desktop hero media before interaction | ≤ 2.5 MB | about 0.6 MB |
| Mobile hero media before interaction | ≤ 1.2 MB | about 0.15 MB |

**Sources and credits.** The stills and clips were generated on Higgsfield:
four `flux_3_image` stills chosen in the design session, then Gemini Omni Flash
1.1 image-to-video with the same still as both start and end frame. The prompt
was "static locked-off camera, only the water moves". A clip is rejected if the
crystal drifts or the camera moves.

The portrait hero frames were composed locally from the 16:9 stills (see
`PORTRAIT` in the script) rather than outpainted: outpainting recomposed the
scene.

**Generating anything new costs credits, and the owner approves the total
first.**
