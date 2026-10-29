import Decimal from "decimal.js";
import type { Movement, Kind } from "./types";
Decimal.set({ precision: 40 });
export function amount(input: string): string {
  const clean = input.trim().replace(/\s|\u00a0|€/g, "");
  if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean))
    throw new Error("Importe español inválido (ej.: -1.234,56)");
  const value = new Decimal(clean.replace(/\./g, "").replace(",", "."));
  if (value.abs().gte("10000000000000000"))
    throw new Error("Importe fuera de numeric(18,2)");
  return value.toFixed(2);
}
export const formatAmount = (value: string | Decimal) => {
  const [integer, decimals] = new Decimal(value).toFixed(2).split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + decimals;
};
export const money = (value: string | Decimal, currency = "EUR") =>
  formatAmount(value) + " " + currency;
export const sum = (values: string[]) =>
  values.reduce((a, b) => a.plus(b), new Decimal(0));
export function totals(rows: Pick<Movement, "tipo_movimiento" | "importe">[]) {
  const by = Object.fromEntries(
    ["ingreso", "gasto", "no_computable"].map((k) => [
      k,
      sum(rows.filter((r) => r.tipo_movimiento === k).map((r) => r.importe)),
    ]),
  ) as Record<Kind, Decimal>;
  return { ...by, balance: by.ingreso.plus(by.gasto) };
}
export function calculated(
  initial: string,
  cutoff: string,
  closing: string,
  rows: Pick<Movement, "fecha_valor" | "importe">[],
) {
  return sum([
    initial,
    ...rows
      .filter((r) => r.fecha_valor > cutoff && r.fecha_valor <= closing)
      .map((r) => r.importe),
  ]).toFixed(2);
}
export function isoDate(value: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(value.trim());
  if (!m) throw new Error("Fecha inválida: usa D/M/YYYY o D/M/YY");
  // El agregador abrevia los años 2000–2099; no usamos el pivote implícito de Date.
  const year = m[3].length === 2 ? "20" + m[3] : m[3];
  const iso = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const date = new Date(iso + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso
  )
    throw new Error("Fecha inexistente");
  return iso;
}

export function displayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : iso;
}
