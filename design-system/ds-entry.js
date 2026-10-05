/* Importable entry for the design system.
 *
 * Re-exports the UI kit so an external design tool (claude.ai/design, a
 * Storybook-style canvas, a docs site) builds with the REAL components rather
 * than a re-implementation that drifts from them.
 *
 * Consumed by /design-sync as cfg.entry — see .design-sync/config.json.
 *
 * Everything the kit publishes is exported. The site's own Astro components
 * (nav, footer, page sections) live in apps/site, not in the kit.
 */
export * from '@forge/ui'
