/* @forge/seo — everything a crawler reads, generated from the route table and
   the manifest rather than written twice.

   Subpath exports exist for the build scripts that want one piece without
   pulling in the rest; this barrel is for pages, which usually want several. */

export * from './routes.js'
export * from './meta.js'
export * from './schema.js'
export * from './sitemap.js'
