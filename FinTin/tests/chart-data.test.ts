import { expect, it } from "vitest";
import {
  categoryEvolution,
  dateInMadrid,
  lastTwelveMonths,
  monthlyChartData,
  topExpenses,
} from "../src/chart-data";
import { formatAmount, money } from "../src/finance";
import type { Movement } from "../src/types";
const row = (changes: Partial<Movement>): Movement => ({
  id: "ficticio",
  cuenta_id: "a",
  fecha_valor: "2026-01-10",
  fecha_operacion: "2026-01-10",
  importe: "0.00",
  moneda: "EUR",
  concepto: "Ficticio",
  tipo_movimiento: "gasto",
  categoria_id: null,
  categoria_csv: "Ficticia",
  nota: "",
  origen: "manual",
  ...changes,
});

it("formatea todos los millares con puntos y los céntimos con coma sin perder precisión", () => {
  expect(formatAmount("1234.56")).toBe("1.234,56");
  expect(money("-9999999999999999.99")).toBe("-9.999.999.999.999.999,99 EUR");
  expect(formatAmount("0.01")).toBe("0,01");
});
it("cubre exactamente doce meses, incluyendo el actual y el cambio de año", () => {
  expect(dateInMadrid(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
  const periods = lastTwelveMonths("2026-01-15");
  expect(periods).toHaveLength(12);
  expect(periods[0]).toBe("2025-02");
  expect(periods[11]).toBe("2026-01");
});
it("agrupa por fecha valor, descuenta devoluciones y excluye los no computables del neto", () => {
  expect(
    monthlyChartData(
      [
        row({ importe: "100.00", tipo_movimiento: "ingreso" }),
        row({ importe: "-30.01" }),
        row({ importe: "5.00" }),
        row({ importe: "999.00", tipo_movimiento: "no_computable" }),
      ],
      ["2026-01", "2026-02"],
    ),
  ).toEqual([
    { income: "100.00", expense: "25.01", other: "999.00", net: "74.99" },
    { income: "0.00", expense: "0.00", other: "0.00", net: "0.00" },
  ]);
});
it("selecciona las seis categorías con más gasto neto y respeta el mes", () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    row({ categoria_csv: `Categoría ${i}`, importe: String(-(i + 1)) }),
  );
  rows.push(
    row({ categoria_csv: "Categoría 7", importe: "7.50" }),
    row({
      categoria_csv: "Febrero",
      fecha_valor: "2026-02-01",
      importe: "-100.00",
    }),
  );
  const top = topExpenses(rows, [], "01");
  expect(top).toHaveLength(6);
  expect(top.map((c) => c.name)).toEqual([
    "Categoría 6",
    "Categoría 5",
    "Categoría 4",
    "Categoría 3",
    "Categoría 2",
    "Categoría 1",
  ]);
  expect(topExpenses(rows, [], "")[0].name).toBe("Febrero");
});
it("representa meses vacíos y días bisiestos sin mezclar categorías o ejercicios", () => {
  const rows = [
    row({ fecha_valor: "2024-02-29", importe: "-10.01" }),
    row({ fecha_valor: "2024-02-29", importe: "0.01" }),
    row({ fecha_valor: "2025-02-28", importe: "-999.00" }),
    row({
      fecha_valor: "2024-02-29",
      categoria_csv: "Otra",
      importe: "-200.00",
    }),
  ];
  const daily = categoryEvolution(rows, 2024, "02", "csv:Ficticia");
  expect(daily).toHaveLength(29);
  expect(daily[28]).toEqual({ period: "2024-02-29", value: "10.00" });
  expect(daily[0].value).toBe("0.00");
  expect(categoryEvolution(rows, 2024, "", "csv:Ficticia")[1].value).toBe(
    "10.00",
  );
});
