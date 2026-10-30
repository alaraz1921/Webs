// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement } from "../src/types";
const api = vi.hoisted(() => ({
  annual: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/api", () => api);
import { Summary } from "../src/Dashboard";
function movement(id: string, changes: Partial<Movement>): Movement {
  return {
    id,
    cuenta_id: "account",
    fecha_valor: "2026-01-10",
    fecha_operacion: "2026-01-10",
    importe: "0.00",
    moneda: "EUR",
    concepto: "Movimiento ficticio",
    tipo_movimiento: "ingreso",
    categoria_id: null,
    categoria_csv: "",
    nota: "",
    origen: "csv",
    ...changes,
  };
}
const rows = [
  movement("income-jan", { importe: "100.00", categoria_id: "income" }),
  movement("income-feb", {
    importe: "20.00",
    categoria_id: "income",
    fecha_valor: "2026-02-10",
  }),
  movement("expense-jan", {
    importe: "-30.00",
    tipo_movimiento: "gasto",
    categoria_id: "expense",
  }),
  movement("refund", {
    importe: "5.00",
    tipo_movimiento: "gasto",
    categoria_id: "expense",
  }),
  movement("expense-feb", {
    importe: "-50.00",
    tipo_movimiento: "gasto",
    categoria_id: "expense",
    fecha_valor: "2026-02-10",
  }),
  movement("transfer", {
    importe: "999.00",
    tipo_movimiento: "no_computable",
    categoria_csv: "Traspaso ficticio",
  }),
  movement("other-account", {
    importe: "500.00",
    cuenta_id: "other",
    categoria_id: "income",
  }),
  movement("other-currency", {
    importe: "1000.00",
    moneda: "USD",
    categoria_id: "income",
  }),
];
const props = {
  uid: "owner",
  year: 2026,
  currency: "EUR",
  account: "account",
  accounts: [],
  aliases: [],
  categories: [
    {
      id: "income",
      user_id: "owner",
      nombre: "Nómina ficticia",
      tipo_movimiento: "ingreso" as const,
    },
    {
      id: "expense",
      user_id: "owner",
      nombre: "Casa ficticia",
      tipo_movimiento: "gasto" as const,
    },
  ],
  reload: vi.fn(),
  open: vi.fn(),
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.annual.mockResolvedValue(rows);
});
const numbers = (table: HTMLElement, name: string | RegExp) =>
  within(within(table).getByRole("row", { name }))
    .getAllByRole("cell")
    .map((c) => c.textContent);
describe("Resumen separado por tipos", () => {
  it("mantiene el código de las otras monedas en las tarjetas", async () => {
    render(<Summary {...props} currency="USD" />);
    const card = await screen.findByRole("article", { name: "Total Ingresos" });
    expect(card.textContent).toContain("1.000,00 USD");
  });
  it("mantiene el modo de ejercicio en los gráficos al cambiar el ejercicio general", async () => {
    const view = render(<Summary {...props} />);
    const u = userEvent.setup();
    await u.selectOptions(
      await screen.findByLabelText("Periodo del balance mensual"),
      "year",
    );
    await u.selectOptions(
      screen.getByLabelText("Periodo de ingresos y gastos"),
      "year",
    );
    view.rerender(<Summary {...props} year={2025} />);
    await screen.findByRole("heading", {
      name: "Balance mensual · ejercicio 2025",
    });
    expect(
      (
        screen.getByLabelText(
          "Periodo del balance mensual",
        ) as HTMLSelectElement
      ).value,
    ).toBe("year");
    expect(
      screen.getByRole("heading", {
        name: "Evolución de ingresos y gastos · ejercicio 2025",
      }),
    ).toBeTruthy();
  });
  it("ordena los cuatro grupos y calcula totales por mes, año y neto excluyendo no computables", async () => {
    render(<Summary {...props} />);
    await screen.findByRole("heading", { name: "Totales y neto" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Balance mensual · últimos 12 meses",
      "Evolución de ingresos y gastos · últimos 12 meses",
      "Gastos por categorías · las 6 principales",
      "Evolución del gasto de una categoría",
      "Ingresos",
      "Gastos",
      "No computables",
      "Totales y neto",
    ]);
    const cards = screen.getByRole("group", { name: "Totales del ejercicio" });
    expect(
      within(cards)
        .getAllByRole("article")
        .map((card) => within(card).getByText(/€$/).textContent),
    ).toEqual(["120,00 €", "-75,00 €", "999,00 €", "45,00 €"]);
    expect(
      within(cards)
        .getByRole("article", { name: "Total Ingresos" })
        .querySelector("strong")?.className,
    ).toBe("income-amount");
    expect(
      within(cards)
        .getByRole("article", { name: "Total Gastos" })
        .querySelector("strong")?.className,
    ).toBe("negative");
    expect(
      within(cards)
        .getByRole("article", { name: "Total Neto" })
        .querySelector("strong")?.className,
    ).toBe("positive");
    expect(
      cards.compareDocumentPosition(
        screen.getByRole("heading", { name: "Ingresos" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const income = screen.getByRole("table", {
      name: "Ingresos por categorías y meses",
    });
    const expense = screen.getByRole("table", {
      name: "Gastos por categorías y meses",
    });
    const other = screen.getByRole("table", {
      name: "No computables por categorías y meses",
    });
    expect(within(income).getByText("Nómina ficticia")).toBeTruthy();
    expect(within(income).queryByText("Casa ficticia")).toBeNull();
    expect(within(expense).getByText("Casa ficticia")).toBeTruthy();
    expect(within(other).getByText("Traspaso ficticio")).toBeTruthy();
    const incomeTotals = numbers(income, /^Total ingresos/);
    expect(incomeTotals.slice(0, 2)).toEqual(["100,00 EUR", "20,00 EUR"]);
    expect(incomeTotals.at(-1)).toBe("120,00 EUR");
    const expenseTotals = numbers(expense, /^Total gastos/);
    expect(expenseTotals.slice(0, 2)).toEqual(["-25,00 EUR", "-50,00 EUR"]);
    expect(expenseTotals.at(-1)).toBe("-75,00 EUR");
    const total = screen.getByRole("table", {
      name: "Totales mensuales y neto",
    });
    const net = numbers(total, /^Neto/);
    expect(net.slice(0, 2)).toEqual(["75,00 EUR", "-30,00 EUR"]);
    expect(net.at(-1)).toBe("45,00 EUR");
    expect(
      within(total)
        .getAllByRole("rowheader")
        .map((h) => h.textContent),
    ).toEqual(["Ingresos", "Gastos", "No computables", "Neto"]);
  });
  it("abre el mes y la categoría del grupo correcto", async () => {
    render(<Summary {...props} />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "-25,00 EUR" }));
    expect(props.open).toHaveBeenCalledWith({
      month: 1,
      category: "expense",
      kind: "gasto",
      currency: "EUR",
    });
    await u.click(screen.getByRole("button", { name: "999,00 EUR" }));
    expect(props.open).toHaveBeenLastCalledWith({
      month: 1,
      category: "__none",
      kind: "no_computable",
      currency: "EUR",
    });
  });
  it("mantiene los grupos vacíos y sus totales a cero", async () => {
    api.annual.mockResolvedValue([]);
    render(<Summary {...props} />);
    const table = await screen.findByRole("table", {
      name: "Totales mensuales y neto",
    });
    expect(
      screen.getAllByRole("table", {
        name: /por categorías y meses|Totales mensuales y neto/,
      }),
    ).toHaveLength(4);
    expect(
      within(table)
        .getAllByRole("cell")
        .every((c) => c.textContent === "0,00 EUR"),
    ).toBe(true);
  });
  it("filtra tarjetas y columnas por mes, conserva los periodos de los gráficos y abre el mes correcto", async () => {
    render(<Summary {...props} month="02" />);
    const u = userEvent.setup();
    const cards = await screen.findByRole("group", {
      name: "Totales del ejercicio",
    });
    expect(
      within(cards).getByRole("article", { name: "Total Ingresos" })
        .textContent,
    ).toContain("20,00 €");
    expect(
      within(cards).getByRole("article", { name: "Total Gastos" }).textContent,
    ).toContain("-50,00 €");
    expect(
      within(cards).getByRole("article", { name: "Total Neto" }).textContent,
    ).toContain("-30,00 €");
    const table = screen.getByRole("table", {
      name: "Gastos por categorías y meses",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Categoría / EUR", "Feb", "Total"]);
    expect(
      (
        screen.getByLabelText(
          "Periodo del balance mensual",
        ) as HTMLSelectElement
      ).value,
    ).toBe("rolling");
    await u.click(within(table).getByRole("button", { name: "-50,00 EUR" }));
    expect(props.open).toHaveBeenCalledWith({
      month: 2,
      category: "expense",
      kind: "gasto",
      currency: "EUR",
    });
  });
  it("muestra en rojo el importe del neto negativo", async () => {
    api.annual.mockResolvedValue([
      movement("expense", { tipo_movimiento: "gasto", importe: "-1234.56" }),
    ]);
    render(<Summary {...props} />);
    const card = await screen.findByRole("article", { name: "Total Neto" });
    expect(card.querySelector("strong")?.className).toBe("negative");
    expect(card.textContent).toContain("-1.234,56 €");
  });
});
