import Decimal from "decimal.js";
import { totals } from "./finance";
import type { Category, Movement } from "./types";
import { alphabetical } from "./alphabetical";

export function dateInMadrid(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}

export function lastTwelveMonths(today: string) {
  const year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7));
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 12 + i, 1));
    return date.toISOString().slice(0, 7);
  });
}
export function monthlyChartData(rows: Movement[], periods: string[]) {
  return periods.map((period) => {
    const t = totals(rows.filter((r) => r.fecha_valor.startsWith(period)));
    return {
      income: t.ingreso.toFixed(2),
      expense: t.gasto.negated().toFixed(2),
      other: t.no_computable.toFixed(2),
      net: t.balance.toFixed(2),
    };
  });
}
export const expenseCategoryKey = (r: Movement) =>
  r.categoria_id
    ? `id:${r.categoria_id}`
    : `csv:${r.categoria_csv || "Sin categoría"}`;
export function expenseCategories(rows: Movement[], categories: Category[]) {
  const options = new Map(
    categories
      .filter((c) => c.tipo_movimiento === "gasto")
      .map((c) => [`id:${c.id}`, c.nombre]),
  );
  for (const r of rows.filter((r) => r.tipo_movimiento === "gasto")) {
    const key = expenseCategoryKey(r);
    if (!options.has(key)) options.set(key, r.categoria_csv || "Sin categoría");
  }
  return alphabetical(
    [...options].map(([key, name]) => ({ key, name })),
    (c) => c.name,
  );
}
export function topExpenses(
  rows: Movement[],
  categories: Category[],
  month: string,
) {
  const names = new Map(
    expenseCategories(rows, categories).map((c) => [c.key, c.name]),
  );
  const sums = new Map<string, Decimal>();
  for (const r of rows.filter(
    (r) =>
      r.tipo_movimiento === "gasto" &&
      (!month || r.fecha_valor.slice(5, 7) === month),
  )) {
    const key = expenseCategoryKey(r);
    sums.set(key, (sums.get(key) || new Decimal(0)).minus(r.importe));
  }
  return [...sums]
    .filter(([, value]) => value.gt(0))
    .sort(
      (a, b) =>
        b[1].comparedTo(a[1]) ||
        (names.get(a[0]) || "").localeCompare(names.get(b[0]) || "", "es"),
    )
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      name: names.get(key) || "Sin categoría",
      value: value.toFixed(2),
    }));
}
export function categoryEvolution(
  rows: Movement[],
  year: number,
  month: string,
  category: string,
) {
  const periods = month
    ? Array.from(
        { length: new Date(Date.UTC(year, Number(month), 0)).getUTCDate() },
        (_, i) => `${year}-${month}-${String(i + 1).padStart(2, "0")}`,
      )
    : Array.from(
        { length: 12 },
        (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
      );
  return periods.map((period) => ({
    period,
    value: rows
      .filter(
        (r) =>
          r.tipo_movimiento === "gasto" &&
          expenseCategoryKey(r) === category &&
          r.fecha_valor.startsWith(period),
      )
      .reduce((s, r) => s.minus(r.importe), new Decimal(0))
      .toFixed(2),
  }));
}
