import { useCallback, useEffect, useRef, useState } from 'react'

/* Toast — the transient confirmation ("Saved", "Copied", "Couldn't save").

   Deliberately NOT a global provider. A context + portal setup is a lot of
   machinery for a message that belongs to one screen, and it makes the toast
   outlive the page that raised it. Instead each page owns its toast:

     const [toast, showToast] = useToast()
     …
     showToast('Saved')
     showToast("Couldn't save", { error: true })
     …
     <Toast {...toast} />

   If you later need cross-page toasts, lift `useToast` into a context — the
   component below doesn't change.

   Rendering: `role="status"` + `aria-live="polite"` so it is announced without
   stealing focus. Errors use `assertive`, because a failed save is worth
   interrupting for. */

const DEFAULT_MS = 2600

export function useToast(duration = DEFAULT_MS) {
  const [state, setState] = useState({ message: '', error: false, open: false })
  const timerRef = useRef(null)

  const showToast = useCallback((message, { error = false } = {}) => {
    clearTimeout(timerRef.current)
    setState({ message, error, open: true })
    timerRef.current = setTimeout(() => setState(s => ({ ...s, open: false })), duration)
  }, [duration])

  // A pending timer that fires after unmount would set state on a dead
  // component; clear it on the way out.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return [state, showToast]
}

export default function Toast({ message, error = false, open = false }) {
  // Kept mounted while empty so the fade-out can run; an unmount would make the
  // toast vanish instantly instead of easing away.
  return (
    <div
      className={`ui-toast${open ? ' show' : ''}${error ? ' ui-toast--err' : ''}`}
      role="status"
      aria-live={error ? 'assertive' : 'polite'}
    >
      {message}
    </div>
  )
}
