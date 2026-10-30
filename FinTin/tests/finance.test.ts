import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCsv, headers, validateAccounts, aliasKey } from "../src/csv";
import {
  amount,
  isoDate,
  totals,
  calculated,
  displayDate,
  moneyWithSymbol,
} from "../src/finance";
const row =
  '10/01/2026,10/01/2026,"-1.234,56 €",EUR,"Concepto, ficticio",Banco ficticio,Cuenta ficticia,Cuenta corriente,Gasto,Prueba,Nota';
const csv = (r = row, h = headers.join(",")) => h + "\r\n" + r;
describe("CSV y cálculos exactos", () => {
  it("usa el símbolo euro solo al formatear importes de tarjetas", () => {
    expect(moneyWithSymbol("1234.50", "EUR")).toBe("1.234,50 €");
    expect(moneyWithSymbol("1234.50", "USD")).toBe("1.234,50 USD");
  });
  it("interpreta negativo, millares y céntimos sin floats", () => {
    expect(amount("-1.234,56 €")).toBe("-1234.56");
    expect(amount("9.999.999.999.999.999,99")).toBe("9999999999999999.99");
    expect(amount("0,01")).toBe("0.01");
    expect(() => amount("1,001")).toThrow();
    expect(() => amount("12.34,50")).toThrow();
    expect(() => amount("10000000000000000")).toThrow();
  });
  it("valida fechas incluidas bisiestos", () => {
    expect(isoDate("29/02/2024")).toBe("2024-02-29");
    expect(displayDate("2026-01-31")).toBe("31-01-2026");
    expect(displayDate("2024-02-29")).toBe("29-02-2024");
    expect(() => isoDate("29/02/2026")).toThrow();
    expect(() => isoDate("31/04/2026")).toThrow();
  });
  it("normaliza años abreviados sin pivote dependiente del navegador", () => {
    expect(isoDate("27/10/26")).toBe("2026-10-27");
    expect(isoDate(" 29/02/24 ")).toBe("2024-02-29");
    expect(isoDate("01/01/00")).toBe("2000-01-01");
    expect(isoDate("31/12/99")).toBe("2099-12-31");
    expect(isoDate("31/12/1999")).toBe("1999-12-31");
  });
  it.each([
    "29/02/26",
    "31/04/26",
    "00/10/26",
    "27/00/26",
    "27/13/26",
    "27/10/026",
    "27/10/6",
  ])("rechaza fecha inválida %s", (date) => {
    expect(() => isoDate(date)).toThrow();
  });
  it("importa las dos fechas abreviadas del agregador y conserva el control del ejercicio", () => {
    const fictitious =
      '27/10/26,26/10/26,"12,34",EUR,Transferencia ficticia,Banco ficticio,Cuenta ficticia,Cuenta,No computable,Prueba,Nota ficticia';
    const parsed = parseCsv(csv(fictitious), 2026);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      fecha_valor: "2026-10-27",
      fecha_operacion: "2026-10-26",
      importe: "12.34",
      tipo_movimiento: "no_computable",
    });
    expect(parseCsv(csv(fictitious), 2025).errors).toContain(
      "Fila 1: Fecha valor fuera del ejercicio seleccionado",
    );
    const previousOperation = parseCsv(
      csv(fictitious.replace("26/10/26", "31/12/25")),
      2026,
    );
    expect(previousOperation.errors).toEqual([]);
    expect(previousOperation.rows[0].fecha_operacion).toBe("2025-12-31");
    expect(
      parseCsv(csv(fictitious + "\r\n" + row.replaceAll("2026", "2025")), 2026)
        .errors,
    ).toContain("Fila 2: Fecha valor fuera del ejercicio seleccionado");
  });
  it.each(["1/2/26", "01/2/26", "1/02/26", "01/02/26", "1/2/2026"])(
    "normaliza día y mes de una o dos cifras: %s",
    (date) => {
      expect(isoDate(date)).toBe("2026-02-01");
    },
  );
  it.each(["", "   "])(
    "sustituye operación vacía por fecha valor y avisa: %s",
    (operation) => {
      const parsed = parseCsv(
        csv(row.replace("10/01/2026,10/01/2026", "1/2/26," + operation)),
        2026,
      );
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows[0]).toMatchObject({
        fecha_valor: "2026-02-01",
        fecha_operacion: "2026-02-01",
      });
      expect(parsed.warnings).toContain(
        "1 filas sin fecha de operación: se usará su fecha valor como fecha de operación.",
      );
    },
  );
  it("valida las dos fechas por separado sin sustituir fechas presentes inválidas", () => {
    const good = parseCsv(
      csv(row.replace("10/01/2026,10/01/2026", "1/2/26,31/1/26")),
      2026,
    );
    expect(good.errors).toEqual([]);
    expect(good.rows[0].fecha_operacion).toBe("2026-01-31");
    expect(good.warnings).toEqual([]);
    const bad = parseCsv(
      csv(row.replace("10/01/2026,10/01/2026", "1/2/26,31/2/26")),
      2026,
    );
    expect(bad.rows).toEqual([]);
    expect(bad.errors).toContain(
      "Fila 1: Fecha de operación: Fecha inexistente",
    );
    expect(bad.warnings).toEqual([]);
    const missingValue = parseCsv(
      csv(row.replace("10/01/2026,10/01/2026", ",1/2/26")),
      2026,
    );
    expect(missingValue.errors[0]).toContain("Fecha valor:");
  });
  it("acepta BOM CRLF comillas y multilinea", () => {
    const r = parseCsv(
      "\uFEFF" +
        csv(row.replace("Concepto, ficticio", "Concepto,\r\nficticio")),
      2026,
    );
    expect(r.errors).toEqual([]);
    expect(r.rows[0].concepto).toContain("\r\n");
    expect(r.rows[0].importe).toBe("-1234.56");
  });
  it("conserva duplicados e índices 1..N", () => {
    const r = parseCsv(csv(row + "\r\n" + row), 2026);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1].numero_fila).toBe(2);
  });
  it.each([
    row.replace("EUR", "ZZZ"),
    row.replace("Gasto", "Inventado"),
    row.replace("10/01/2026", "10/01/2025"),
    row + ",extra",
    row.replace("Banco ficticio", ""),
  ])("bloquea fila errónea %s", (r) => {
    expect(parseCsv(csv(r), 2026).errors.length).toBeGreaterThan(0);
  });
  it("exige cabecera exacta, archivo no vacío y comillas cerradas", () => {
    expect(
      parseCsv(
        csv(row, headers.join(",").replace("Categoría", "Categoria")),
        2026,
      ).errors.length,
    ).toBeGreaterThan(0);
    expect(parseCsv(headers.join(","), 2026).errors.length).toBeGreaterThan(0);
    expect(
      parseCsv(csv(row.replace("Nota", '"Nota')), 2026).errors.length,
    ).toBeGreaterThan(0);
  });
  it("valida asignación explícita sin coincidencias parciales", () => {
    const rows = parseCsv(csv(), 2026).rows;
    expect(validateAccounts(rows, [], [])).toHaveLength(1);
    expect(aliasKey(rows[0])).not.toBe(
      aliasKey({ ...rows[0], nombre_producto_csv: "Cuenta" }),
    );
    expect(aliasKey(rows[0])).toBe(
      aliasKey({ ...rows[0], nombre_producto_csv: " CUENTA FICTICIA " }),
    );
  });
  it("fixture ficticia contiene dos filas idénticas", () => {
    const r = parseCsv(
      readFileSync("fixtures/agregador-ficticio.csv", "utf8"),
      2026,
    );
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect({ ...r.rows[0], numero_fila: 0 }).toEqual({
      ...r.rows[1],
      numero_fila: 0,
    });
  });
  it("los no computables cambian saldo pero no balance", () => {
    const r = [
      {
        tipo_movimiento: "no_computable" as const,
        importe: "20.00",
        fecha_valor: "2026-01-02",
      },
      {
        tipo_movimiento: "gasto" as const,
        importe: "-10.00",
        fecha_valor: "2026-01-03",
      },
    ];
    expect(calculated("100", "2025-12-31", "2026-01-31", r)).toBe("110.00");
    expect(totals(r).balance.toFixed(2)).toBe("-10.00");
    expect(
      totals([
        { tipo_movimiento: "ingreso", importe: "0.1" },
        { tipo_movimiento: "ingreso", importe: "0.2" },
      ]).ingreso.toFixed(2),
    ).toBe("0.30");
  });
  it("ignora movimientos a la fecha de corte o posteriores al cierre", () => {
    expect(
      calculated("100", "2025-12-31", "2026-01-31", [
        { fecha_valor: "2025-12-31", importe: "999" },
        { fecha_valor: "2026-02-01", importe: "99" },
      ]),
    ).toBe("100.00");
  });
});
