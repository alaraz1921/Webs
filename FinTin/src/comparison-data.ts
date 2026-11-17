import Decimal from "decimal.js";
import { totals } from "./finance";
import type { Category, Movement } from "./types";
import { compareText } from "./alphabetical";

export function comparisonData(
  rows: Movement[],
  years: [number, number],
  month: string,
  currency: string,
  categories: Category[],
  accountIds?: Set<string>,
) {
  const periods = years.map((year) =>
    rows.filter(
      (r) =>
        r.fecha_valor.startsWith(`${year}-`) &&
        (!month || r.fecha_valor.slice(5, 7) === month) &&
        r.moneda === currency &&
        (!accountIds || accountIds.has(r.cuenta_id)),
    ),
  );
  const summary = periods.map((period) => {
    const t = totals(period);
    return [
      t.ingreso.toFixed(2),
      t.gasto.negated().toFixed(2),
      t.balance.toFixed(2),
    ];
  });
  const byCategory = (kind: "ingreso" | "gasto") => {
    const groups = new Map<
      string,
      { key: string; name: string; values: Decimal[] }
    >();
    periods.forEach((period, index) => {
      for (const r of period.filter((r) => r.tipo_movimiento === kind)) {
        const key = r.categoria_id
          ? `id:${r.categoria_id}`
          : `csv:${r.categoria_csv || "Sin categoría"}`;
        const group = groups.get(key) || {
          key,
          name:
            categories.find((c) => c.id === r.categoria_id)?.nombre ||
            r.categoria_csv ||
            "Sin categoría",
          values: [new Decimal(0), new Decimal(0)],
        };
        group.values[index] = group.values[index].plus(
          kind === "gasto" ? new Decimal(r.importe).negated() : r.importe,
        );
        groups.set(key, group);
      }
    });
    return [...groups.values()]
      .sort(
        (a, b) =>
          Decimal.max(...b.values.map((v) => v.abs())).comparedTo(
            Decimal.max(...a.values.map((v) => v.abs())),
          ) || compareText(a.name, b.name),
      )
      .map((g) => ({ ...g, values: g.values.map((v) => v.toFixed(2)) }));
  };
  return {
    summary,
    expenses: byCategory("gasto"),
    income: byCategory("ingreso"),
    count: periods.map((period) => period.length),
  };
}
