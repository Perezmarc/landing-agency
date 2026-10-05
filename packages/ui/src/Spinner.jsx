/* Spinner — the indeterminate loading indicator, for waits with no known shape
   (a route chunk downloading, an OAuth round-trip).

   Prefer <Skeleton> whenever you DO know the shape of what's coming: a
   skeleton that matches the incoming layout reads as faster than a spinner,
   because the page doesn't jump when the content lands.

   Props:
     full   — centre it in a full-screen container
     label  — accessible label announced to screen readers */
export default function Spinner({ full = false, label = 'Loading', className = '' }) {
  const spinner = (
    <span className={`app-spinner ${className}`.trim()} role="status" aria-label={label} />
  )
  return full ? <div className="app-loading">{spinner}</div> : spinner
}
