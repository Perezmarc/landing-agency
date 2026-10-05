/* EmptyState — the honest "nothing here yet" panel.

   Use this instead of rendering fake sample rows when a list is empty: an
   empty state that explains what the thing is and how to create the first one
   is more useful than placeholder data, and it can't be mistaken for real
   content.

   Props:
     icon    — optional node shown in the tinted badge
     title   — the headline ("No projects yet")
     children — the explanatory line
     action  — optional node (usually a <Button>) for the primary next step */
export default function EmptyState({ icon, title, action, className = '', children }) {
  return (
    <div className={`app-empty ${className}`.trim()}>
      {icon && <div className="app-empty-icon" aria-hidden="true">{icon}</div>}
      {title && <div className="app-empty-title">{title}</div>}
      {children && <p className="app-empty-sub">{children}</p>}
      {action && <div className="app-empty-action">{action}</div>}
    </div>
  )
}
