import type { ComponentPropsWithoutRef, ElementType, ReactNode, CSSProperties } from 'react'

export type ButtonVariant =
  | 'cta'
  | 'dark'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'white'
  | 'glass'
  | 'plain'
  /** Aliases for 'dark'. */
  | 'black'
  | 'primary'

export type ButtonSize =
  | 'sm'
  | 'md'
  | 'default'
  | 'lg'
  | 'compact'
  | 'tiny'
  | 'icon'
  | 'iconCompact'

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'type'> {
  as?: ElementType
  href?: string
  to?: string
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: ButtonSize
  onDark?: boolean
  /** Full-width WRAP. Never use inside a flex row with `flex: 1` siblings. */
  block?: boolean
  pill?: boolean
  glare?: boolean
  icon?: ReactNode
  /** An icon by name, for templates that cannot pass a node (see Button.jsx). */
  iconName?: string
  iconRightName?: string
  iconRight?: ReactNode
  className?: string
  contentClassName?: string
  wrapStyle?: CSSProperties
  children?: ReactNode
}

declare const Button: React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLElement>
>
export default Button
