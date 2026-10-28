import { useState } from "react";
import Decimal from "decimal.js";
export type SortState<K extends string> = {
  key: K;
  direction: "asc" | "desc";
} | null;
type SortValue = string | number | boolean | null | undefined;
const collator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});
export function useTableSort<K extends string>() {
  const [sort, setSort] = useState<SortState<K>>(null);
  const onSort = (key: K) =>
    setSort((previous) => ({
      key,
      direction:
        previous?.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  return { sort, onSort };
}
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  value: (row: T, key: K) => SortValue,
  numeric: readonly K[] = [],
): T[] {
  if (!sort) return [...rows];
  return rows
    .map((row, index) => ({ row, index, value: value(row, sort.key) }))
    .sort((a, b) => {
      const missingA = a.value === null || a.value === undefined,
        missingB = b.value === null || b.value === undefined;
      if (missingA || missingB)
        return missingA === missingB ? a.index - b.index : missingA ? 1 : -1;
      const order = numeric.includes(sort.key)
        ? new Decimal(String(a.value)).comparedTo(String(b.value))
        : collator.compare(String(a.value), String(b.value));
      return (sort.direction === "asc" ? order : -order) || a.index - b.index;
    })
    .map((entry) => entry.row);
}
export function SortHeader<K extends string>({
  field,
  label,
  sort,
  onSort,
  numeric = false,
}: {
  field: K;
  label: string;
  sort: SortState<K>;
  onSort: (key: K) => void;
  numeric?: boolean;
}) {
  const active = sort?.key === field;
  return (
    <th
      scope="col"
      className={numeric ? "numeric" : undefined}
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="sort-heading"
        onClick={() => onSort(field)}
      >
        {label}
        <span aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
