// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Movement } from "../src/types";
const api = vi.hoisted(() => ({ annual: vi.fn() }));
vi.mock("../src/api", () => api);
import { SummaryCharts } from "../src/SummaryCharts";
const row = (changes: Partial<Movement>): Movement => ({
  id: "ficticio",
  cuenta_id: "a",
  fecha_valor: "2026-01-10",
  fecha_operacion: "2026-01-10",
  importe: "-1234.56",
  moneda: "EUR",
  concepto: "Ficticio",
  tipo_movimiento: "gasto",
  categoria_id: "a",
  categoria_csv: "",
  nota: "",
  origen: "manual",
  ...changes,
});
const props = {
  uid: "owner",
  year: 2026,
  account: "a",
  currency: "EUR",
  rows: [
    row({}),
    row({ fecha_valor: "2026-02-10", categoria_id: "b", importe: "-20.59" }),
    row({ cuenta_id: "other", importe: "-999.00" }),
    row({ moneda: "USD", importe: "-999.00" }),
    row({
      fecha_valor: "2026-10-31",
      importe: "999.00",
      tipo_movimiento: "ingreso",
    }),
  ],
  categories: [
    {
      id: "a",
      user_id: "owner",
      nombre: "Categoría A",
      tipo_movimiento: "gasto" as const,
    },
    {
      id: "b",
      user_id: "owner",
      nombre: "Categoría B",
      tipo_movimiento: "gasto" as const,
    },
  ],
};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  api.annual.mockReset();
  api.annual.mockImplementation(async (_uid, year) =>
    year === 2025
      ? [row({ fecha_valor: "2025-11-15", importe: "-50.00" })]
      : year === 2024
        ? [row({ fecha_valor: "2024-01-01", importe: "-77.77" })]
        : [],
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("carga los doce meses hasta hoy y filtra por moneda y cuenta sin incluir fechas futuras", async () => {
  render(<SummaryCharts {...props} />);
  const u = userEvent.setup();
  await screen.findByRole("img", {
    name: /^Balance mensual de los últimos 12 meses\./,
  });
  expect(api.annual).toHaveBeenCalledExactlyOnceWith("owner", 2025);
  await u.click(screen.getAllByText("Ver datos")[0]);
  const table = screen.getByRole("table", {
    name: "Datos: Balance mensual de los últimos 12 meses",
  });
  expect(within(table).getAllByRole("row")).toHaveLength(13);
  expect(
    within(table).getByRole("row", { name: /Nov 25/ }).textContent,
  ).toContain("50,00 EUR");
  expect(
    within(table).getByRole("row", { name: /Ene 26/ }).textContent,
  ).toContain("1.234,56 EUR");
  expect(
    within(table).getByRole("row", { name: /Oct 26/ }).textContent,
  ).not.toContain("999,00");
});
it("cambia mes y ejercicio del ranking y mes/categoría de evolución de forma independiente", async () => {
  render(<SummaryCharts {...props} />);
  const u = userEvent.setup();
  await screen.findByRole("list", { name: "Categorías con más gasto" });
  await u.selectOptions(screen.getByLabelText("Mes de categorías"), "02");
  expect(
    screen.getByRole("list", { name: "Categorías con más gasto" }).textContent,
  ).toBe("Categoría B20,59 EUR");
  await u.selectOptions(screen.getByLabelText("Mes de evolución"), "02");
  await u.selectOptions(
    screen.getByLabelText("Categoría de evolución"),
    "id:b",
  );
  expect(
    screen.getByRole("img", { name: "10 · Categoría B: 20,59 EUR" }),
  ).toBeTruthy();
  expect(api.annual).toHaveBeenCalledTimes(1);
  await u.selectOptions(screen.getByLabelText("Mes de categorías"), "");
  await u.click(
    screen.getByRole("combobox", { name: /^Ejercicio de categorías/ }),
  );
  await u.click(screen.getByRole("option", { name: "2024" }));
  const ranking = await screen.findByRole("list", {
    name: "Categorías con más gasto",
  });
  expect(ranking.textContent).toBe("Categoría A77,77 EUR");
  expect(api.annual).toHaveBeenLastCalledWith("owner", 2024);
  expect(
    screen.getByRole("combobox", { name: /^Ejercicio de evolución/ })
      .textContent,
  ).toBe("2026");
  expect(
    (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
  ).toBe("02");
});
