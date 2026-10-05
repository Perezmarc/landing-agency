import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT — articles and legal pages, as files.

   WHY FILES AND NOT A DATABASE: an article is reviewed in a pull request,
   versioned with the code, typed against the schema below, and built into
   static HTML. There is no editor to build, no draft that can leak through a
   missing policy, and no runtime query on the critical path of a page whose
   content changed last on Tuesday.

   The cost is honest: publishing needs a deploy, and a non-technical author
   needs a git client or a CMS pointed at this directory.

   LANGUAGE IS THE DIRECTORY. `blog/en/hello-world.md`, `blog/es/hola-mundo.md`
   and `blog/it/ciao-mondo.md` are three articles, not one article translated: they
   have their own slugs, their own dates and their own length. Where they ARE
   translations of each other, `translationOf` links them so the hreflang tags
   can say so.
   ═══════════════════════════════════════════════════════════════════════════ */

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().max(120),
    // Used as the meta description and the card copy. Long enough to be worth
    // reading in a search result, short enough not to be truncated in one.
    excerpt: z.string().min(50).max(200),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().optional(),
    // A draft is built locally but never listed or built for production, so
    // "unpublished" is the absence of a page rather than a hidden one.
    draft: z.boolean().default(false),
    // The slug of the same article in the default locale, when this is a
    // translation. Drives the hreflang pairs; omit it for an article that
    // exists only in this language.
    translationOf: z.string().optional(),
  }),
})

const legal = defineCollection({
  loader: glob({ base: './src/content/legal', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    // The date the terms took effect — not the date the file was edited.
    effective: z.coerce.date(),
  }),
})

export const collections = {
  blog,
  legal,
}
