/**
 * Turns a display name into a URL-safe slug.
 * Strips Hungarian accents (á→a, ő→o, ű→u …), lowercases, and collapses
 * everything else to single hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop combining accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
