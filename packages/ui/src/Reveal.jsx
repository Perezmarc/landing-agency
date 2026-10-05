import { useEffect, useRef, useState } from 'react'

/* Reveal — scroll-triggered entrance for marketing sections.

   Why a hook and not a CSS-only solution: `animation-timeline: view()` isn't
   supported widely enough yet, and an IntersectionObserver that fires ONCE is
   cheap and predictable. The observer disconnects after the first intersection,
   so a long landing page doesn't keep dozens of observers alive.

   Respects prefers-reduced-motion: reduced-motion users get the content
   immediately visible, with no transition (see .mk-reveal in marketing.css).

   Usage — hook (when you need the ref on your own element):
     const [ref, shown] = useReveal()
     <section ref={ref} className={`mk-reveal${shown ? ' is-in' : ''}`}>

   Usage — component (the common case):
     <Reveal><FeatureRow … /></Reveal> */

export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // No observer support (or a test environment): show it rather than hide it
    // forever. Content must never depend on an animation to become visible.
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        observer.disconnect()
      },
      { threshold, rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return [ref, shown]
}

export default function Reveal({ as: Element = 'div', className = '', children, ...rest }) {
  const [ref, shown] = useReveal()
  return (
    <Element ref={ref} className={`mk-reveal${shown ? ' is-in' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Element>
  )
}
