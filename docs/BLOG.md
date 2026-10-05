# Blog

Articles are **markdown files in this repository**. They live under
`apps/site/src/content/blog/<locale>/`, are reviewed in a pull request, are
typed against a schema at build time, and become static HTML.

There is no database table, no editor to build and no runtime query.

## Writing one

```
apps/site/src/content/blog/en/my-article.md
```

```markdown
---
title: What I learned shipping this
excerpt: One or two sentences. This is the meta description and the card copy, so write it for a search result rather than as a summary.
published: 2026-04-01
updated: 2026-04-03     # optional
author: Tony Stark      # optional
draft: false            # optional
translationOf: ""       # optional — see Translations
---

The body, in markdown.
```

The file name is the slug: `my-article.md` is served at `/blog/my-article`.

`content.config.js` types that front matter with Zod, so a missing excerpt, a
title over 120 characters or a malformed date **fails the build** rather than
rendering a page with a hole in it.

## Drafts

`draft: true` builds the article locally — so you can read it in context while
you write — and leaves it out of a production build entirely. Not hidden behind
a flag, not filtered out of a list: not built. An unpublished article has no
URL to leak, which is a stronger guarantee than any row-level security policy.

## Translations

Language is the directory. `blog/en/hello-world.md`, `blog/es/hola-mundo.md`
and `blog/it/ciao-mondo.md` are three articles, each with its own slug, date and
length — a translation is rarely the same length as its original, and forcing
them to share a row makes that awkward.

Where they *are* translations of each other, the Spanish and Italian files say so:

```yaml
translationOf: hello-world
```

That is what makes the two pages declare each other with `hreflang`, in their
`<head>` and in the sitemap. An article with no counterpart declares no
alternates at all — pointing `hreflang` at a URL that 404s is worse than
pointing it nowhere.

## Where the URLs come from

The route table in `@forge/seo`:

```js
export const BLOG_BASE = { en: '/blog', es: '/es/blog', it: '/it/blog' }
```

Paths are *translated*, not prefixed — `/es/contacto`, `/it/contatti`. A
Spanish or Italian speaker does not search in English, and the URL is part of
what a search engine reads.

## What you get for free

- **Static HTML per article**, with the title, canonical URL, `hreflang` pairs,
  Open Graph tags and `BlogPosting` structured data already in it. A crawler
  that never runs JavaScript reads the finished page.
- **A sitemap entry**, with `lastmod` from `updated` (or `published`), built
  from the same files.
- **An index page** per language, newest first.
- **The e2e suite** walks every published route from the route table, so an
  article that does not build fails CI.

## Why files, and what it costs

An article is reviewed like code. A claim about a client result gets caught
before it ships. Nothing is published because somebody
clicked the wrong button in a dashboard at eleven at night. The schema is
enforced before anything ships, and the page is on disk before the request
arrives.

The cost is real and worth naming: **publishing needs a deploy**, and an author
who is not comfortable with git needs a tool pointed at this directory — a CMS
that commits markdown, or a simple editor over the repository.

If you need runtime publishing later, replace `getCollection('blog', …)` in
`apps/site/src/pages-content/Blog.astro` and `BlogPost.astro` with a CMS query.
Start with files anyway: moving from files to a CMS is a smaller change than
the reverse.

## Until the first article

The `.gitkeep` files under `content/blog/<locale>/` keep the directories in
git. With no articles, each language's index renders the `blog.empty` line and
the build logs that the collection is empty; both stop once a file exists.
