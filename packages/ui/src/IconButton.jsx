import { forwardRef } from 'react'

/* IconButton — the compact square icon button used in dense rows: reorder,
   delete and overflow controls on list cards and table rows.

   For toolbar-height icon buttons use <Button size="iconCompact"> instead;
   this one is deliberately smaller than the button kit's smallest size.

   Props:
     small    — 22px square (dense rows) instead of the default 26px
     danger   — destructive intent (red hover treatment)
     children — the icon (e.g. <Ico name="trash" size={12} />)
     ...rest  — forwarded to the <button> (onClick, disabled, title, aria-*)

   Icon-only: always pass an `aria-label`. */
const IconButton = forwardRef(function IconButton(
  { small = false, danger = false, className = '', children, ...rest },
  ref,
) {
  const cls = ['ui-icon-btn', small && 'small', danger && 'danger', className]
    .filter(Boolean).join(' ')
  return (
    <button ref={ref} type="button" className={cls} {...rest}>
      {children}
    </button>
  )
})

export default IconButton
