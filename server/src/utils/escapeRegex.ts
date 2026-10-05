/** Escapes a string so it can be placed inside a RegExp and match literally (no injection, no ReDoS surprises). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
