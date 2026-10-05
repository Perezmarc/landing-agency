/* Types for the manifest. The implementation is plain JavaScript (see the
   header of index.js for why); this file is what makes `forge.brand.nmae` a
   type error instead of an undefined at runtime. */

export interface BrandInput {
  name: string
  /** Bare host, no scheme, no trailing slash. Every origin derives from it. */
  domain: string
  shortName?: string
  tagline?: string
  description?: string
  /** Defaults to `https://{domain}`. */
  url?: string
  /** Where "Book a call" goes. Defaults to `mailto:{email.support}`. */
  bookingUrl?: string
  email?: Partial<Record<'support' | 'sales' | 'privacy' | 'legal', string>>
  legal?: { entity?: string; jurisdiction?: string; since?: number }
  social?: { x?: string; linkedin?: string; github?: string }
}

export interface Brand extends Required<Omit<BrandInput, 'email' | 'legal' | 'social'>> {
  email: Record<'support' | 'sales' | 'privacy' | 'legal', string>
  legal: { entity: string; jurisdiction: string; since: number }
  social: { x: string; linkedin: string; github: string }
}

export interface ForgeManifestInput {
  brand: BrandInput
  locales?: { default?: string; published?: string[] }
}

export interface ForgeManifest {
  readonly brand: Readonly<Brand>
  readonly locales: Readonly<{ default: string; published: readonly string[] }>
  /** Absolute URL on the site's origin. */
  absoluteUrl(path?: string): string
}

export declare class ForgeConfigError extends Error {
  path: string
}

export declare function defineForge(manifest: ForgeManifestInput): ForgeManifest
export default defineForge
