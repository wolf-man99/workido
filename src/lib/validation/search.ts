/**
 * Escapes user input for PostgREST `ilike` filters: LIKE wildcards are
 * neutralised and characters with meaning in filter syntax are removed.
 */
export function escapeLikeForFilter(value: string): string {
  return value
    .replace(/[\\%_]/g, (char) => `\\${char}`)
    .replace(/[,()*:"]/g, " ")
    .trim();
}
