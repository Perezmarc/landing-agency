/* Types for the kit's public surface. Button, TextInput and Tabs are fully
   typed today — the first two have enough variants that getting one wrong is
   easy, and Tabs has a required `name` and an item shape — and the rest are declared loosely rather than wrongly. Tighten one
   by adding a `<Name>.d.ts` beside the component and re-exporting it here. */

export { default as Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { default as TextInput } from './TextInput'
export type { TextInputProps } from './TextInput'

export declare const IconButton: any
export declare const Select: any
export declare const Switch: any
export declare const SegmentedControl: any

export interface TabsItem {
  value: string
  label: import('react').ReactNode
  panel: import('react').ReactNode
}
export interface TabsProps {
  /** Required: the radios' shared name and the id prefix. */
  name: string
  /** The group's accessible name (rendered visually hidden). */
  legend?: import('react').ReactNode
  /** At most 8 items. */
  items: TabsItem[]
  /** Initially checked value; defaults to the first item's value. */
  defaultValue?: string
  className?: string
}
export declare const Tabs: import('react').ForwardRefExoticComponent<
  TabsProps & import('react').RefAttributes<HTMLFieldSetElement>
>
export declare const Card: any
export declare const Chip: any
export declare const Modal: any
export declare const EmptyState: any
export declare const Spinner: any
export declare const BrandMark: any
export declare const Toast: any
export declare const Skeleton: any
export declare const SkeletonText: any
export declare const SkeletonCircle: any
export declare const SkeletonButton: any
export declare const SkeletonGroup: any
export declare const Ico: any
export declare const ICONS: Record<string, unknown>
export declare function useToast(duration?: number): any
