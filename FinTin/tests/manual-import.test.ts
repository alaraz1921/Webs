import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { headers, manualHeaders, parseManualCsv } from "../src/csv";
import {
  manualImportRows,
  resolveManualAccounts,
  MAX_MANUAL_IMPORT_ROWS,
} from "../src/manual-import";
import type { Account } from "../src/types";
const a: Account = {
  id: "account",
  user_id: "owner",
  entidad: "Banco ficticio",
  nombre_producto: "Cuenta ficticia",
  tipo_producto: "Cuenta corriente",
  moneda: "EUR",
  saldo_inicial: "100.00",
  fecha_saldo_inicial: "2025-12-31",
  activo: true,
};
const parsed = () =>
  parseManualCsv(readFileSync("fixtures/manuales-ficticios.csv", "utf8"), 2026);
describe("CSV manual de nueve columnas", () => {
  it("lee fechas, importes, textos y operación vacía sin exigir moneda ni tipo de producto", () => {
    const result = parsed();
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      fecha_valor: "2026-02-01",
      fecha_operacion: "2026-02-01",
      importe: "-12.34",
      concepto: "Compra ficticia",
      categoria_csv: "Hogar ficticio",
      moneda: "",
    });
    expect(result.rows[1].fecha_operacion).toBe("2026-02-01");
    expect(result.warnings).toContain(
      "2 filas sin fecha de operación: se usará su fecha valor como fecha de operación.",
    );
  });
  it("exige las nueve columnas y el ejercicio correcto", () => {
    expect(parsed().errors).toEqual([]);
    expect(parseManualCsv(headers.join(",") + "\n", 2026).errors[0]).toContain(
      "9 columnas",
    );
    expect(
      parseManualCsv(
        readFileSync("fixtures/manuales-ficticios.csv", "utf8"),
        2025,
      ).errors[0],
    ).toContain("fuera del ejercicio");
    expect(
      parseManualCsv(
        manualHeaders.join(",") +
          '\n1/2/26,,"10,00",Prueba,Banco ficticio,Cuenta ficticia,Inventado,Prueba,',
        2026,
      ).errors[0],
    ).toContain("Tipo desconocido");
  });
  it("infiere la moneda de la cuenta aunque el alias tenga tipo de producto", () => {
    const result = resolveManualAccounts(
      parsed().rows,
      [a],
      [
        {
          id: "alias",
          user_id: "owner",
          cuenta_id: a.id,
          entidad_csv: a.entidad,
          nombre_producto_csv: a.nombre_producto,
          tipo_producto_csv: "Cuenta corriente",
        },
      ],
      {},
    );
    expect(result.rows.every((r) => r.moneda === "EUR")).toBe(true);
    const payload = manualImportRows(
      result.rows,
      [a],
      result.aliases,
      [
        {
          id: "category",
          user_id: "owner",
          nombre: "HOGAR FICTICIO",
          tipo_movimiento: "gasto",
        },
      ],
      ["one", "two", "three"],
    );
    expect(payload[0]).toMatchObject({
      id: "one",
      cuenta_id: a.id,
      categoria_id: "category",
      importe: "-12.34",
    });
    expect(payload[1]).toMatchObject({
      categoria_id: null,
      categoria_csv: "Ingreso ficticio",
    });
  });
  it("exige elegir cuenta si la pareja es ambigua y usa su moneda", () => {
    const usd = { ...a, id: "usd", moneda: "USD" };
    const result = resolveManualAccounts(parsed().rows, [a, usd], [], {});
    expect(result.products[0].accountId).toBe("");
    expect(() =>
      manualImportRows(
        result.rows,
        [a, usd],
        result.aliases,
        [],
        ["one", "two", "three"],
      ),
    ).toThrow("falta alias");
    const selected = resolveManualAccounts(parsed().rows, [a, usd], [], {
      [result.products[0].key]: "usd",
    });
    expect(selected.rows.every((r) => r.moneda === "USD")).toBe(true);
    expect(
      manualImportRows(
        selected.rows,
        [a, usd],
        selected.aliases,
        [],
        ["one", "two", "three"],
      )[0].cuenta_id,
    ).toBe("usd");
  });
  it("rechaza fechas al corte, identificadores repetidos y cargas demasiado grandes", () => {
    const result = resolveManualAccounts(parsed().rows, [a], [], {});
    expect(() =>
      manualImportRows(
        result.rows,
        [{ ...a, fecha_saldo_inicial: "2026-02-01" }],
        result.aliases,
        [],
        ["one", "two", "three"],
      ),
    ).toThrow("anterior o igual");
    expect(() =>
      manualImportRows(
        result.rows,
        [a],
        result.aliases,
        [],
        ["one", "one", "three"],
      ),
    ).toThrow("Identificadores");
    expect(() =>
      manualImportRows(
        Array(MAX_MANUAL_IMPORT_ROWS + 1).fill(result.rows[0]),
        [a],
        result.aliases,
        [],
        [],
      ),
    ).toThrow("entre 1");
  });
  it("mantiene duplicados legítimos como movimientos separados", () => {
    const row = parsed().rows[0];
    const result = resolveManualAccounts(
      [row, { ...row, numero_fila: 2 }],
      [a],
      [],
      {},
    );
    const payload = manualImportRows(
      result.rows,
      [a],
      result.aliases,
      [],
      ["one", "two"],
    );
    expect(payload).toHaveLength(2);
    expect(payload[0].id).not.toBe(payload[1].id);
    expect(payload[0].importe).toBe(payload[1].importe);
  });
});
