// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { Movement } from "../src/types";
const api = vi.hoisted(() => ({ annual: vi.fn() }));
vi.mock("../src/api", () => api);
import { comparisonData } from "../src/comparison-data";
import { ComparisonsPage } from "../src/Comparisons";
const row = (
  id: string,
  date: string,
  amount: string,
  kind: Movement["tipo_movimiento"] = "gasto",
  currency = "EUR",
): Movement => ({
  id,
  cuenta_id: "account",
  fecha_valor: date,
  fecha_operacion: date,
  importe: amount,
  moneda: currency,
  concepto: "Ficticio",
  tipo_movimiento: kind,
  categoria_id: null,
  categoria_csv: kind === "gasto" ? "Casa" : "Sueldo",
  nota: "",
  origen: "manual",
});
const rows = [
  row("a", "2025-10-01", "-100.01"),
  row("b", "2025-10-02", "0.02"),
  row("c", "2025-10-01", "200.00", "ingreso"),
  row("d", "2026-10-01", "-150.00"),
  row("e", "2026-10-01", "300.00", "ingreso"),
  row("f", "2026-01-01", "-50.00"),
  row("g", "2026-10-01", "9000.00", "no_computable"),
  row("h", "2026-10-01", "-8000.00", "gasto", "USD"),
];
afterEach(cleanup);
it("compara con precisión mes y año completos, descuenta devoluciones y separa monedas", () => {
  const result = comparisonData(rows, [2025, 2026], "10", "EUR", []);
  expect(result.summary).toEqual([
    ["200.00", "99.99", "100.01"],
    ["300.00", "150.00", "150.00"],
  ]);
  expect(result.expenses[0]).toMatchObject({
    name: "Casa",
    values: ["99.99", "150.00"],
  });
  expect(comparisonData(rows, [2025, 2026], "", "EUR", []).summary[1]).toEqual([
    "300.00",
    "200.00",
    "100.00",
  ]);
  expect(comparisonData(rows, [2025, 2026], "02", "EUR", []).expenses).toEqual(
    [],
  );
});
it("carga los ejercicios y cambia entre todo el año y un mes en los tres gráficos", async () => {
  api.annual.mockImplementation(async (_uid, year) =>
    rows.filter((r) => r.fecha_valor.startsWith(String(year))),
  );
  render(
    <ComparisonsPage
      uid="owner"
      accounts={[]}
      categories={[]}
      aliases={[]}
      reload={vi.fn()}
      year={2026}
    />,
  );
  const u = userEvent.setup();
  const region = await screen.findByRole("region", {
    name: "Comparativas en EUR",
  });
  await within(region).findByRole("figure", { name: "Gastos por categoría" });
  expect(api.annual).toHaveBeenCalledWith("owner", 2025);
  expect(api.annual).toHaveBeenCalledWith("owner", 2026);
  await u.click(within(region).getByText("Ver datos"));
  const annualTable = within(region).getByRole("table", {
    name: "Datos: Comparación de ingresos, gastos y neto",
  });
  expect(within(annualTable).getAllByRole("row")).toHaveLength(13);
  expect(
    within(annualTable).getByRole("row", { name: /^Ene/ }).textContent,
  ).toContain("50,00 €");
  expect(
    within(annualTable).getByRole("row", { name: /^Oct/ }).textContent,
  ).toContain("200,00 €300,00 €99,99 €150,00 €100,01 €150,00 €");
  await u.click(within(region).getByText("Ver datos"));
  await u.selectOptions(screen.getByLabelText("Mes"), "10");
  const expenses = within(region).getByRole("figure", {
    name: "Gastos por categoría",
  });
  expect(expenses.textContent).toContain("Oct 2025Oct 2026");
  expect(expenses.textContent).toContain("99,99 €150,00 €");
  await u.click(within(region).getByText("Ver datos"));
  const table = within(region).getByRole("table", {
    name: "Datos: Comparación de ingresos, gastos y neto",
  });
  expect(
    within(table).getByRole("row", { name: /Neto/ }).textContent,
  ).toContain("100,01 €150,00 €");
});
