/* FLIP: First, Last, Invert, Play. Pure math for calendar.js. */

/** The transform that puts an element laid out at `last` back where `first` was. */
export function invert(first, last) {
  return {
    dx: first.left - last.left,
    dy: first.top - last.top,
    sx: last.width ? first.width / last.width : 1,
    sy: last.height ? first.height / last.height : 1,
  }
}
