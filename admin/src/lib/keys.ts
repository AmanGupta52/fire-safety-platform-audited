/**
 * Stable React keys for lists that have no id of their own: each entry keeps the key built from its own content, and
 * only a repeated value gets a "#2", "#3" suffix. Unlike the array index, a key built this way doesn't move to a
 * different row when an earlier row is removed or the list is reordered.
 */
export function uniqueKeys(values: string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = seen.get(value) ?? 0;
    seen.set(value, count + 1);
    return count === 0 ? value : `${value}#${count + 1}`;
  });
}
