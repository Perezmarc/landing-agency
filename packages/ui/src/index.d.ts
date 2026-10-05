/* Types for the kit's public surface. Only Button and TextInput are fully
   typed today — those are the two with enough variants that getting one wrong
   is easy — and the rest are declared loosely rather than wrongly. Tighten one
   by adding a `<Name>.d.ts` beside the component and re-exporting it here. */

export { default as Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { default as TextInput } from './TextInput'
export type { TextInputProps } from './TextInput'

export declare const IconButton: any
export declare const Select: any
export declare const Switch: any
export declare const SegmentedControl: any
export declare const Card: any
export declare const Chip: any
export declare const Modal: any
export declare const EmptyState: any
export declare const Spinner: any
export declare const BrandMark: any
export declare const Reveal: any
export declare const Toast: any
export declare const Skeleton: any
export declare const SkeletonText: any
export declare const SkeletonCircle: any
export declare const SkeletonButton: any
export declare const SkeletonGroup: any
export declare const Ico: any
export declare const ICONS: Record<string, unknown>
export declare function useReveal(options?: Record<string, unknown>): any
export declare function useToast(duration?: number): any
