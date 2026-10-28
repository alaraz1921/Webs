// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, Reconciliation } from "../src/types";
import { sortRows } from "../src/sorting";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  annual: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/api", () => api);
import { Settings } from "../src/Settings";
import { AccountsPage } from "../src/Dashboard";
const account = (
  id: string,
  name: string,
  saldo: string,
  date: string,
): Account => ({
  id,
  user_id: "owner",
  entidad: "Banco ficticio",
  nombre_producto: name,
  tipo_producto: "Cuenta",
  moneda: "EUR",
  saldo_inicial: saldo,
  fecha_saldo_inicial: date,
  activo: true,
});
const accounts = [
  account("a", "Zeta ficticia", "10.00", "2025-12-31"),
  account("b", "Álamo ficticia", "2.00", "2025-01-31"),
  account("c", "Cuenta ficticia", "0.00", "2026-01-31"),
];
const rows: Reconciliation[] = [
  {
    cuenta_id: "a",
    fecha_cierre: "2026-01-31",
    moneda: "EUR",
    saldo_calculado: "10.00",
    saldo_real: "9.00",
    diferencia: "-1.00",
  },
  {
    cuenta_id: "b",
    fecha_cierre: "2026-01-31",
    moneda: "EUR",
    saldo_calculado: "2.00",
    saldo_real: null,
    diferencia: null,
  },
  {
    cuenta_id: "c",
    fecha_cierre: "2026-02-28",
    moneda: "EUR",
    saldo_calculado: "0.00",
    saldo_real: "0.00",
    diferencia: "0.00",
  },
];
const props = {
  uid: "owner",
  accounts,
  categories: [],
  aliases: [],
  reload: vi.fn(),
  year: 2026,
  currency: "EUR",
  account: "",
  open: vi.fn(),
};
const firstCells = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.children[0].textContent);
beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockImplementation(async (table) =>
    table === "v_conciliacion_mensual" ? rows : [],
  );
  api.annual.mockResolvedValue([]);
});
afterEach(cleanup);
describe("Ordenación de tablas", () => {
  it("resalta solo los cierres con saldo real, distinguiendo cero y diferencias de un céntimo", async () => {
    api.list.mockImplementation(async (table) =>
      table === "v_conciliacion_mensual"
        ? [
            ...rows,
            {
              ...rows[0],
              fecha_cierre: "2026-03-31",
              saldo_calculado: "9999999999999999.98",
              saldo_real: "9999999999999999.99",
              diferencia: "0.01",
            },
          ]
        : [],
    );
    render(<AccountsPage {...props} />);
    const table = await screen.findByRole("table", {
      name: "Saldos mensuales por cuenta",
    });
    const accountRows = within(table).getAllByRole("row").slice(1);
    expect(accountRows[0].children[1].className).toBe("balance-mismatch");
    expect(accountRows[1].children[1].className).toBe("");
    expect(accountRows[2].children[2].className).toBe("balance-match");
    expect(accountRows[0].children[3].className).toBe("balance-mismatch");
    expect(accountRows[0].children[4].className).toBe("");
    expect(
      within(accountRows[0].children[3] as HTMLElement).getByRole("button")
        .title,
    ).toBe("Diferencia: 0,01 EUR");
    const u = userEvent.setup();
    await u.click(
      within(accountRows[2].children[2] as HTMLElement).getByRole("button"),
    );
    expect(props.open).toHaveBeenCalledWith({
      account: "c",
      through: "2026-02-28",
    });
  });
  it("ordena importes de precisión completa y deja pendientes al final en ambos sentidos", () => {
    const input = [
      { v: "9999999999999999.99" },
      { v: null },
      { v: "9999999999999999.98" },
      { v: "-10.00" },
    ];
    expect(
      sortRows(input, { key: "v", direction: "asc" }, (r) => r.v, ["v"]).map(
        (r) => r.v,
      ),
    ).toEqual(["-10.00", "9999999999999999.98", "9999999999999999.99", null]);
    expect(
      sortRows(input, { key: "v", direction: "desc" }, (r) => r.v, ["v"]).map(
        (r) => r.v,
      ),
    ).toEqual(["9999999999999999.99", "9999999999999999.98", "-10.00", null]);
    expect(input[0].v).toBe("9999999999999999.99");
  });
  it("ordena Cuentas por nombre y por saldo mensual sin convertir meses ausentes en cero", async () => {
    render(<AccountsPage {...props} />);
    const u = userEvent.setup();
    const table = await screen.findByRole("table", {
      name: "Saldos mensuales por cuenta",
    });
    await u.click(within(table).getByRole("button", { name: "Cuenta / EUR" }));
    expect(firstCells(table)[0]).toContain("Álamo ficticia");
    await u.click(within(table).getByRole("button", { name: "Ene" }));
    expect(firstCells(table).map((s) => s?.split("Banco")[0])).toEqual([
      "Álamo ficticia",
      "Zeta ficticia",
      "Cuenta ficticia",
    ]);
    expect(
      within(table)
        .getByRole("columnheader", { name: "Ene" })
        .getAttribute("aria-sort"),
    ).toBe("ascending");
    await u.click(within(table).getByRole("button", { name: "Ene" }));
    expect(firstCells(table).map((s) => s?.split("Banco")[0])).toEqual([
      "Zeta ficticia",
      "Álamo ficticia",
      "Cuenta ficticia",
    ]);
  });
  it("ordena conciliación por importes, diferencias y cierres, conservando los pendientes", async () => {
    render(<AccountsPage {...props} reconcile />);
    const u = userEvent.setup();
    const table = await screen.findByRole("table", { name: "Conciliación" });
    await u.click(within(table).getByRole("button", { name: "Real" }));
    expect(firstCells(table)).toEqual([
      "Cuenta ficticia",
      "Zeta ficticia",
      "Álamo ficticia",
    ]);
    await u.click(within(table).getByRole("button", { name: "Real" }));
    expect(firstCells(table)).toEqual([
      "Zeta ficticia",
      "Cuenta ficticia",
      "Álamo ficticia",
    ]);
    await u.click(
      within(table).getByRole("button", {
        name: "Diferencia (real − calculado)",
      }),
    );
    expect(firstCells(table)).toEqual([
      "Zeta ficticia",
      "Cuenta ficticia",
      "Álamo ficticia",
    ]);
    await u.click(within(table).getByRole("button", { name: "Cierre" }));
    await u.click(within(table).getByRole("button", { name: "Cierre" }));
    expect(firstCells(table)[0]).toBe("Cuenta ficticia");
  });
  it("ordena las tres tablas de configuración de forma independiente por los valores mostrados", async () => {
    render(
      <Settings
        {...props}
        categories={[
          {
            id: "z",
            user_id: "owner",
            nombre: "Zeta",
            tipo_movimiento: "ingreso",
          },
          {
            id: "a",
            user_id: "owner",
            nombre: "Álamo",
            tipo_movimiento: "gasto",
          },
        ]}
        aliases={[
          {
            id: "x",
            user_id: "owner",
            cuenta_id: "a",
            entidad_csv: "Alias Z",
            nombre_producto_csv: "Producto Z",
            tipo_producto_csv: "Cuenta",
          },
          {
            id: "y",
            user_id: "owner",
            cuenta_id: "b",
            entidad_csv: "Alias A",
            nombre_producto_csv: "Producto A",
            tipo_producto_csv: "Cuenta",
          },
        ]}
      />,
    );
    const u = userEvent.setup(),
      table = screen.getByRole("table", { name: "Cuentas y saldos" }),
      categories = screen.getByRole("table", { name: "Categorías" }),
      aliases = screen.getByRole("table", { name: "Alias del agregador" });
    await u.click(within(table).getByRole("button", { name: "Saldo inicial" }));
    expect(firstCells(table)).toEqual([
      "Cuenta ficticia",
      "Álamo ficticia",
      "Zeta ficticia",
    ]);
    await u.click(
      within(table).getByRole("button", { name: "Fecha del saldo inicial" }),
    );
    expect(firstCells(table)).toEqual([
      "Álamo ficticia",
      "Zeta ficticia",
      "Cuenta ficticia",
    ]);
    await u.click(within(categories).getByRole("button", { name: "Nombre" }));
    expect(firstCells(categories)).toEqual(["Álamo", "Zeta"]);
    await u.click(
      within(aliases).getByRole("button", { name: "Cuenta de destino" }),
    );
    expect(firstCells(aliases)).toEqual(["Alias A", "Alias Z"]);
    expect(
      within(table)
        .getByRole("columnheader", { name: "Fecha del saldo inicial" })
        .getAttribute("aria-sort"),
    ).toBe("ascending");
    await u.click(
      within(aliases).getByRole("button", { name: "Cuenta de destino" }),
    );
    expect(firstCells(aliases)).toEqual(["Alias Z", "Alias A"]);
  });
});
