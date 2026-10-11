/* The stream's geometry, mirrored from marketing.css (.mk-home) so it can be
   tested. Pure. The CSS is what renders; this is the contract it follows. */

/** Width of the hero media box: the clip covering the stage. */
export function boxWidth(viewW, viewH) {
  return viewW / viewH <= 1 ? Math.max(viewW, viewH * 9 / 16) : Math.max(viewW, viewH * 16 / 9)
}

/** Page x of the stream rail, from the clip's exit fraction. */
export function railX(viewW, viewH, exitX) {
  return viewW / 2 + (exitX - 0.5) * boxWidth(viewW, viewH)
}
