import { getCollection } from 'astro:content'
import { sitemapXml } from '@forge/seo/sitemap'

/* The sitemap, generated from the route table and the article files.
 *
 * WHY AN ENDPOINT AND NOT A COMMITTED FILE: a hand-maintained sitemap.xml is
 * wrong within two releases and nothing tells you — a crawler simply stops
 * being told about the page you added. Built from the same table the pages are
 * built from, the only way to have a page missing is to have no page.
 */
export async function GET() {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  const articles = posts.map((post) => {
    const [locale, slug] = [post.id.split('/')[0], post.id.split('/').pop()]
    return {
      slug,
      locale,
      updated: post.data.updated ?? post.data.published,
      // Articles that are translations of each other share a key, so the
      // sitemap can declare their alternates the same way the pages do.
      locales: posts
        .filter(other => (other.data.translationOf ?? other.id.split('/').pop())
          === (post.data.translationOf ?? slug))
        .map(other => other.id.split('/')[0]),
    }
  })

  return new Response(
    sitemapXml(articles),
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  )
}
