/* The glyph beside each use case on the use cases page: a small picture of
   what the agent does there, drawn by components/CaseGlyph.astro. Indexed
   like the catalog (useCases.industries[n].cases[i]), which keeps the same
   order in every language; use-cases.test.js holds the two to one shape. */

export const GLYPH_NAMES = ['read', 'match', 'route', 'chase', 'gather', 'draft', 'check', 'sort', 'report', 'track', 'time']

export const GLYPHS = [
  ['read', 'route', 'draft', 'match'],   // manufacturing
  ['track', 'match', 'gather', 'draft'], // distribution and logistics
  ['check', 'draft', 'sort', 'match'],   // retail and e-commerce
  ['check', 'gather', 'read', 'report'], // financial services and insurance
  ['gather', 'sort', 'check', 'time'],   // professional services
  ['route', 'chase', 'match', 'report'], // real estate
  ['draft', 'time', 'match', 'sort'],    // hospitality and travel
  ['chase', 'time', 'match', 'route'],   // private healthcare
]
