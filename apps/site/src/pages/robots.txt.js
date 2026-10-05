import { robotsTxt } from '@forge/seo/sitemap'

/* robots.txt, with the sitemap's absolute URL derived from the manifest — so
 * renaming the domain moves it rather than leaving a line pointing at the old
 * one. */
export function GET() {
  return new Response(robotsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
