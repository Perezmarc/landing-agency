/* BrandMark — the product's logo mark.

   REPLACE THIS with your own artwork. It is deliberately a simple geometric
   placeholder rather than a generic "app" glyph, so it reads as intentional
   until you swap it and is obvious when you haven't.

   Rules for whatever replaces it:
     • Draw with `currentColor`, never a hardcoded fill — the mark appears on
       the light rail, the dark sign-in panel and the marketing header, and it
       must be legible on all three.
     • Keep it square and viewBox-based so `size` is the only dimension prop.
     • No <title> here: the mark is decorative and always sits next to the
       product name in text. If you ever render it alone, pass a `title`. */
export default function BrandMark({ size = 28, title, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8.75" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 21.5 16 9l6 12.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.6 18h6.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}
