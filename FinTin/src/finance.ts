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
export const money = (value: string | Decimal, currency = "EUR") =>
  new Decimal(value)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    .replace(".", ",") +
  " " +
  currency;
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
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) throw new Error("Fecha inválida: usa DD/MM/YYYY");
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (new Date(iso + "T00:00:00Z").toISOString().slice(0, 10) !== iso)
    throw new Error("Fecha inexistente");
  return iso;
}
