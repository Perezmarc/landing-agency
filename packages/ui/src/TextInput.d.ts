import type { ComponentPropsWithoutRef } from 'react'

export interface TextInputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  /** Large variant (44px) — sign-in and other single-focus screens. */
  lg?: boolean
  error?: boolean
  /** Render a <textarea> with the same look instead of an <input>. */
  multiline?: boolean
  rows?: number
}

declare const TextInput: React.ForwardRefExoticComponent<
  TextInputProps & React.RefAttributes<HTMLInputElement | HTMLTextAreaElement>
>
export default TextInput
