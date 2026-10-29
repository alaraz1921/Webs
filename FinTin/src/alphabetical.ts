const collator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});
export const compareText = (a: string, b: string) => collator.compare(a, b);
export function alphabetical<T>(
  rows: readonly T[],
  label: (row: T) => string,
): T[] {
  return [...rows].sort((a, b) => compareText(label(a), label(b)));
}
