/**
 * Returns the first non-empty value, treating empty strings as missing.
 * Useful for environment fallbacks where a blank variable means "not set".
 */
export function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value !== '') ?? undefined;
}
