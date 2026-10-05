/* Chip — the small status/label pill: a plan badge, a state ("Active",
   "Paused"), a tag. Not interactive; for a clickable pill use
   <Button size="tiny" pill>.

   Props:
     tone   — 'default' | 'good' | 'warn' | 'bad' | 'accent'
     dot    — show a leading status dot in the tone's colour
     ...rest — forwarded to the <span> */
export default function Chip({ tone = 'default', dot = false, className = '', children, ...rest }) {
  const cls = ['ui-chip', tone !== 'default' && tone, className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...rest}>
      {dot && <span className="ui-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
