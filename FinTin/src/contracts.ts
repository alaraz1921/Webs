import Decimal from "decimal.js";
import { amount, sum } from "./finance";

export interface Deposit {
  id: string;
  titular: string;
  nombre: string;
  notas: string;
  fecha_apertura: string;
  duracion_meses: number;
  interes: string;
  retencion: string;
  aportacion: string;
  importe_liquidacion: string | null;
}
export interface Financing {
  id: string;
  nombre: string;
  notas: string;
  importe_compra: string;
  total_cuotas: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}
export interface Payment {
  id: string;
  financiacion_id: string;
  fecha: string;
  importe: string;
  nota: string;
}

export function depositTerms(deposit: Deposit) {
  const maturity = new Date(deposit.fecha_apertura + "T00:00:00Z");
  const day = maturity.getUTCDate();
  maturity.setUTCDate(1);
  maturity.setUTCMonth(maturity.getUTCMonth() + deposit.duracion_meses + 1, 0);
  maturity.setUTCDate(Math.min(day, maturity.getUTCDate()));
  const net = new Decimal(deposit.aportacion)
    .times(deposit.interes)
    .div(100)
    .times(deposit.duracion_meses)
    .div(12)
    .times(new Decimal(1).minus(new Decimal(deposit.retencion).div(100)))
    .toDecimalPlaces(2);
  return {
    maturity: maturity.toISOString().split("T")[0],
    net,
  };
}

export function depositProgress(
  deposit: Deposit,
  maturity: string,
  today: string,
) {
  const dayMs = 86_400_000;
  const time = (date: string) => Date.parse(date + "T00:00:00Z");
  const total = (time(maturity) - time(deposit.fecha_apertura)) / dayMs;
  const settled = deposit.importe_liquidacion != null;
  const elapsed = Math.min(
    total,
    Math.max(0, (time(today) - time(deposit.fecha_apertura)) / dayMs),
  );
  const remaining = settled
    ? 0
    : Math.max(0, (time(maturity) - time(today)) / dayMs);
  return {
    elapsed,
    remaining,
    percent: Math.round((100 * elapsed) / total),
    expired: settled || today >= maturity,
    settled,
  };
}

export function settlementAmount(value: string) {
  if (!value) return null;
  const parsed = amount(value);
  if (new Decimal(parsed).lt(0))
    throw new Error("La liquidación no puede ser negativa.");
  return parsed;
}

export function financingTotals(financing: Financing, payments: Payment[]) {
  const paid = sum(payments.map((p) => p.importe));
  return {
    paid,
    pending: new Decimal(financing.importe_compra).minus(paid),
    installments: Math.max(0, financing.total_cuotas - payments.length),
  };
}

export function positiveAmount(value: string) {
  const parsed = amount(value);
  if (!new Decimal(parsed).gt(0))
    throw new Error("El importe debe ser mayor que cero.");
  return parsed;
}

export function percentage(value: string) {
  const parsed = amount(value);
  if (new Decimal(parsed).lt(0) || new Decimal(parsed).gt(100))
    throw new Error("El porcentaje debe estar entre 0 y 100.");
  return parsed;
}
