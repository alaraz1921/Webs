// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Movement } from "../src/types";
import { useState, type ComponentProps } from "react";
const api = vi.hoisted(() => ({ annual: vi.fn() }));
vi.mock("../src/api", () => api);
import {
  SummaryCharts as Charts,
  type ChartPeriods,
} from "../src/SummaryCharts";
function SummaryCharts(
  props: Omit<ComponentProps<typeof Charts>, "chartPeriods" | "setChartPeriod">,
) {
  const [chartPeriods, setPeriods] = useState<ChartPeriods>({
    balance: "rolling",
    flow: "rolling",
  });
  return (
    <Charts
      {...props}
      chartPeriods={chartPeriods}
      setChartPeriod={(chart, value) =>
        setPeriods((p) => ({ ...p, [chart]: value }))
      }
    />
  );
}
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
  ).toContain("50,00 €");
  expect(
    within(table).getByRole("row", { name: /Ene 26/ }).textContent,
  ).toContain("1.234,56 €");
  expect(
    within(table).getByRole("row", { name: /Oct 26/ }).textContent,
  ).not.toContain("999,00");
});
it("aplica el mes general a ambos gráficos y Todos recupera la vista anual sin perder categoría ni periodos", async () => {
  const view = render(<SummaryCharts {...props} month="02" />);
  const u = userEvent.setup();
  await screen.findByRole("list", { name: "Categorías con más gasto" });
  expect(
    (screen.getByLabelText("Mes de categorías") as HTMLSelectElement).value,
  ).toBe("02");
  expect(
    (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
  ).toBe("02");
  expect(
    screen.getByRole("list", { name: "Categorías con más gasto" }).textContent,
  ).toBe("Categoría B20,59 €");
  await u.selectOptions(
    screen.getByLabelText("Categoría de evolución"),
    "id:b",
  );
  expect(
    screen.getByRole("img", { name: "10 · Categoría B: 20,59 €" }),
  ).toBeTruthy();
  view.rerender(<SummaryCharts {...props} month="01" />);
  expect(
    (screen.getByLabelText("Mes de categorías") as HTMLSelectElement).value,
  ).toBe("01");
  expect(
    (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
  ).toBe("01");
  expect(
    screen.getByRole("list", { name: "Categorías con más gasto" }).textContent,
  ).toBe("Categoría A1.234,56 €");
  view.rerender(<SummaryCharts {...props} month="" />);
  expect(
    (screen.getByLabelText("Mes de categorías") as HTMLSelectElement).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
  ).toBe("");
  expect(
    screen.getByRole("figure", { name: "Gasto mensual de la categoría" }),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText("Categoría de evolución") as HTMLSelectElement)
      .value,
  ).toBe("id:b");
  expect(
    (screen.getByLabelText("Periodo del balance mensual") as HTMLSelectElement)
      .value,
  ).toBe("rolling");
  expect(api.annual).toHaveBeenCalledTimes(1);
});
it("cambia mes y ejercicio del ranking y mes/categoría de evolución de forma independiente", async () => {
  render(<SummaryCharts {...props} />);
  const u = userEvent.setup();
  await screen.findByRole("list", { name: "Categorías con más gasto" });
  await u.selectOptions(screen.getByLabelText("Mes de categorías"), "02");
  expect(
    screen.getByRole("list", { name: "Categorías con más gasto" }).textContent,
  ).toBe("Categoría B20,59 €");
  await u.selectOptions(screen.getByLabelText("Mes de evolución"), "02");
  await u.selectOptions(
    screen.getByLabelText("Categoría de evolución"),
    "id:b",
  );
  expect(
    screen.getByRole("img", { name: "10 · Categoría B: 20,59 €" }),
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
  expect(ranking.textContent).toBe("Categoría A77,77 €");
  expect(api.annual).toHaveBeenLastCalledWith("owner", 2024);
  expect(
    screen.getByRole("combobox", { name: /^Ejercicio de evolución/ })
      .textContent,
  ).toBe("2026");
  expect(
    (screen.getByLabelText("Mes de evolución") as HTMLSelectElement).value,
  ).toBe("02");
});
it("alterna de forma independiente entre últimos doce meses y enero a diciembre del ejercicio", async () => {
  render(<SummaryCharts {...props} />);
  const u = userEvent.setup();
  await screen.findByRole("img", {
    name: /^Balance mensual de los últimos 12 meses\./,
  });
  await u.selectOptions(
    screen.getByLabelText("Periodo del balance mensual"),
    "year",
  );
  const balance = screen.getByRole("figure", {
    name: "Balance mensual del ejercicio 2026",
  });
  await u.click(within(balance).getByText("Ver datos"));
  const table = within(balance).getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(13);
  expect(
    within(table).getByRole("row", { name: /Ene 26/ }).textContent,
  ).toContain("1.234,56 €");
  expect(
    within(table).getByRole("row", { name: /Oct 26/ }).textContent,
  ).toContain("999,00 €");
  expect(within(table).getByRole("row", { name: /Dic 26/ })).toBeTruthy();
  expect(within(table).queryByRole("row", { name: /Nov 25/ })).toBeNull();
  expect(
    (screen.getByLabelText("Periodo de ingresos y gastos") as HTMLSelectElement)
      .value,
  ).toBe("rolling");
  await u.selectOptions(
    screen.getByLabelText("Periodo de ingresos y gastos"),
    "year",
  );
  const flow = screen.getByRole("figure", {
    name: "Evolución mensual de ingresos y gastos",
  });
  await u.click(within(flow).getByText("Ver datos"));
  expect(within(flow).getByRole("row", { name: /Dic 26/ })).toBeTruthy();
  await u.selectOptions(
    screen.getByLabelText("Periodo del balance mensual"),
    "rolling",
  );
  expect(
    screen.getByRole("figure", {
      name: "Balance mensual de los últimos 12 meses",
    }),
  ).toBeTruthy();
  expect(
    (screen.getByLabelText("Periodo de ingresos y gastos") as HTMLSelectElement)
      .value,
  ).toBe("year");
  expect(api.annual).toHaveBeenCalledTimes(1);
});
