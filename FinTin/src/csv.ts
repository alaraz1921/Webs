import Papa from "papaparse";
import { amount, isoDate } from "./finance";
import type { Alias, Account, CsvRow, Kind } from "./types";
export const headers = [
  "Fecha valor",
  "Fecha de operación",
  "Importe",
  "Moneda",
  "Concepto",
  "Entidad",
  "Nombre de producto",
  "Tipo de producto",
  "Tipo de movimiento",
  "Categoría",
  "Nota",
];
const mapping: Record<string, Kind> = {
  ingreso: "ingreso",
  ingresos: "ingreso",
  gasto: "gasto",
  gastos: "gasto",
  "no computable": "no_computable",
  "no computables": "no_computable",
  no_computable: "no_computable",
};
const currencies = new Set(Intl.supportedValuesOf("currency"));
export const validCurrency = (v: string) => currencies.has(v);
export const aliasKey = (r: {
  entidad_csv: string;
  nombre_producto_csv: string;
  tipo_producto_csv: string;
}) =>
  JSON.stringify(
    [r.entidad_csv, r.nombre_producto_csv, r.tipo_producto_csv].map((v) =>
      v.trim().toLowerCase(),
    ),
  );
export const manualHeaders = [
  "Fecha valor",
  "Fecha de operación",
  "Importe",
  "Concepto",
  "Entidad",
  "Nombre de producto",
  "Tipo de movimiento",
  "Categoría",
  "Nota",
];
export const parseManualCsv = (text: string, year: number) =>
  parseCsv(text, year, true);
export function parseCsv(text: string, year: number, manual = false) {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimiter: ",",
    dynamicTyping: false,
  });
  const errors = parsed.errors.map(
    (e) => `Registro ${(e.row ?? 0) + 1}: ${e.message}`,
  );
  const rows: CsvRow[] = [];
  let operationDateFallbacks = 0;
  const expectedHeaders = manual ? manualHeaders : headers;
  if (JSON.stringify(parsed.data[0]) !== JSON.stringify(expectedHeaders))
    return {
      rows,
      errors: [
        `La cabecera debe tener las ${expectedHeaders.length} columnas exactas, en el orden indicado.`,
      ],
      warnings: [],
    };
  parsed.data.slice(1).forEach((input, i) => {
    try {
      if (input.length !== expectedHeaders.length)
        throw new Error(`Se esperaban ${expectedHeaders.length} columnas`);
      const r = manual
        ? [
            input[0],
            input[1],
            input[2],
            "",
            input[3],
            input[4],
            input[5],
            "",
            input[6],
            input[7],
            input[8],
          ]
        : input;
      let fecha_valor: string, fecha_operacion: string;
      try {
        fecha_valor = isoDate(r[0]);
      } catch (e) {
        throw new Error("Fecha valor: " + (e as Error).message);
      }
      const missingOperationDate = !r[1].trim();
      try {
        fecha_operacion = missingOperationDate ? fecha_valor : isoDate(r[1]);
      } catch (e) {
        throw new Error("Fecha de operación: " + (e as Error).message);
      }
      if (Number(fecha_valor.slice(0, 4)) !== year)
        throw new Error("Fecha valor fuera del ejercicio seleccionado");
      const tipo_movimiento = mapping[r[8].trim().toLowerCase()];
      if (!tipo_movimiento) throw new Error(`Tipo desconocido: ${r[8]}`);
      if (!manual && !validCurrency(r[3]))
        throw new Error("Moneda ISO 4217 desconocida");
      if (!r[5].trim() || !r[6].trim())
        throw new Error("Entidad y nombre de producto son obligatorios");
      rows.push({
        numero_fila: i + 1,
        fecha_valor,
        fecha_operacion,
        importe: amount(r[2]),
        moneda: r[3],
        concepto: r[4],
        entidad_csv: r[5].trim(),
        nombre_producto_csv: r[6].trim(),
        tipo_producto_csv: r[7].trim(),
        tipo_movimiento,
        categoria_csv: r[9].trim(),
        nota: r[10],
      });
      if (missingOperationDate) operationDateFallbacks++;
    } catch (e) {
      errors.push(`Fila ${i + 1}: ${(e as Error).message}`);
    }
  });
  if (!rows.length) errors.push("El archivo no contiene movimientos válidos");
  if (parsed.data.length - 1 > 200000)
    errors.push("Máximo 200.000 filas por importación");
  const warnings = rows.some(
    (r) =>
      (r.tipo_movimiento === "ingreso" && r.importe.startsWith("-")) ||
      (r.tipo_movimiento === "gasto" && !r.importe.startsWith("-")),
  )
    ? [
        "Hay ingresos negativos o gastos positivos. Se conservarán sus signos originales.",
      ]
    : [];
  if (operationDateFallbacks)
    warnings.push(
      `${operationDateFallbacks} filas sin fecha de operación: se usará su fecha valor como fecha de operación.`,
    );
  return { rows, errors, warnings };
}
export function validateAccounts(
  rows: CsvRow[],
  aliases: Alias[],
  accounts: Account[],
) {
  return rows.flatMap((r) => {
    const a = aliases.find((a) => aliasKey(a) === aliasKey(r));
    const c = accounts.find((c) => c.id === a?.cuenta_id);
    return !c
      ? [`Fila ${r.numero_fila}: falta alias de cuenta`]
      : c.moneda !== r.moneda
        ? [`Fila ${r.numero_fila}: moneda incompatible`]
        : r.fecha_valor <= c.fecha_saldo_inicial
          ? [`Fila ${r.numero_fila}: anterior o igual al saldo inicial`]
          : [];
  });
}
export async function readCsv(file: File, encoding: "utf-8" | "windows-1252") {
  return new TextDecoder(encoding, { fatal: true }).decode(
    await file.arrayBuffer(),
  );
}
export async function fileHash(file: File) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
