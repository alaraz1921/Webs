// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, afterEach, it, expect, vi } from "vitest";
import type { Account, Balance, Reconciliation } from "../src/types";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  annual: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/api", () => api);
import { AccountsPage } from "../src/Dashboard";
const accounts: Account[] = ["a", "b", "c"].map((id) => ({
  id,
  user_id: "owner",
  nombre_producto: `Cuenta ficticia ${id}`,
  entidad: "Banco ficticio",
  tipo_producto: "Cuenta",
  moneda: "EUR",
  saldo_inicial: "0.00",
  fecha_saldo_inicial: "2025-12-31",
  activo: true,
}));
let closures: Reconciliation[];
let balances: Balance[];
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
  reconcile: true,
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  vi.resetAllMocks();
  closures = [
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
    {
      cuenta_id: "a",
      fecha_cierre: "2026-03-31",
      moneda: "EUR",
      saldo_calculado: "9999999999999999.98",
      saldo_real: "9999999999999999.99",
      diferencia: "0.01",
    },
  ];
  balances = [
    {
      id: "balance-a",
      cuenta_id: "a",
      fecha_corte: "2026-01-31",
      saldo_real: "9.00",
      nota: "Anotación ficticia",
    },
    {
      id: "balance-c",
      cuenta_id: "c",
      fecha_corte: "2026-02-28",
      saldo_real: "0.00",
      nota: "",
    },
  ];
  api.list.mockImplementation(async (t) =>
    t === "saldos" ? balances : closures,
  );
  api.annual.mockResolvedValue([]);
  api.save.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function table() {
  return screen.findByRole("table", { name: "Conciliación" });
}
it("alinea importes y combina mes y estado, distinguiendo pendiente, cero y un céntimo", async () => {
  render(<AccountsPage {...props} />);
  const u = userEvent.setup(),
    t = await table();
  for (const name of ["Calculado", "Real", "Diferencia (real − calculado)"])
    expect(
      within(t)
        .getByRole("columnheader", { name })
        .classList.contains("numeric"),
    ).toBe(true);
  const month = screen.getByLabelText("Mes de cierre"),
    status = screen.getByLabelText("Estado de conciliación");
  await u.selectOptions(status, "different");
  expect(within(t).getAllByRole("row")).toHaveLength(3);
  await u.selectOptions(month, "3");
  expect(within(t).getAllByRole("row")).toHaveLength(2);
  expect(
    within(t)
      .getByText("0,01 EUR")
      .closest("td")
      ?.classList.contains("numeric"),
  ).toBe(true);
  await u.selectOptions(month, "");
  await u.selectOptions(status, "matched");
  expect(within(t).getAllByRole("row")).toHaveLength(2);
  expect(within(t).getByText("Cuenta ficticia c")).toBeTruthy();
  await u.selectOptions(month, "1");
  expect(
    screen.getByText("No hay cierres para los filtros seleccionados."),
  ).toBeTruthy();
  await u.selectOptions(status, "pending");
  expect(within(t).getByText("Cuenta ficticia b")).toBeTruthy();
  expect(within(t).getAllByRole("row")).toHaveLength(2);
});
it("abre el alta desde Sin saldo real con cuenta y cierre fijos, guarda y refresca sin perder filtros", async () => {
  render(<AccountsPage {...props} />);
  const u = userEvent.setup(),
    t = await table();
  await u.selectOptions(screen.getByLabelText("Mes de cierre"), "1");
  await u.selectOptions(
    screen.getByLabelText("Estado de conciliación"),
    "pending",
  );
  const trigger = within(t).getByRole("button", { name: "Sin saldo real" });
  await u.click(trigger);
  let d = screen.getByRole("dialog", { name: "Anotar saldo real" });
  expect(
    (within(d).getByLabelText("Cuenta") as HTMLInputElement).value,
  ).toContain("Cuenta ficticia b");
  expect(
    (within(d).getByLabelText("Fecha de corte") as HTMLInputElement).value,
  ).toBe("2026-01-31");
  expect(
    (within(d).getByLabelText("Fecha de corte") as HTMLInputElement).readOnly,
  ).toBe(true);
  await u.click(within(d).getByRole("button", { name: "Cancelar" }));
  expect(api.save).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  await u.click(trigger);
  d = screen.getByRole("dialog", { name: "Anotar saldo real" });
  await u.type(within(d).getByLabelText("Saldo real"), "2,00");
  await u.type(within(d).getByLabelText("Nota"), "Comprobado ficticio");
  api.save.mockImplementation(async () => {
    balances = [
      ...balances,
      {
        id: "balance-b",
        cuenta_id: "b",
        fecha_corte: "2026-01-31",
        saldo_real: "2.00",
        nota: "Comprobado ficticio",
      },
    ];
    closures = closures.map((r) =>
      r.cuenta_id === "b"
        ? { ...r, saldo_real: "2.00", diferencia: "0.00" }
        : r,
    );
  });
  await u.click(within(d).getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.save).toHaveBeenCalledWith(
    "saldos",
    "owner",
    {
      cuenta_id: "b",
      fecha_corte: "2026-01-31",
      saldo_real: "2.00",
      nota: "Comprobado ficticio",
    },
    undefined,
  );
  await screen.findByText("No hay cierres para los filtros seleccionados.");
  expect(
    (screen.getByLabelText("Mes de cierre") as HTMLSelectElement).value,
  ).toBe("1");
  expect(
    (screen.getByLabelText("Estado de conciliación") as HTMLSelectElement)
      .value,
  ).toBe("pending");
});
it("edita el saldo existente mediante su id y conserva Revisar junto a Editar", async () => {
  render(<AccountsPage {...props} />);
  const u = userEvent.setup(),
    t = await table();
  const row = within(t).getAllByRole("row")[1];
  await u.click(within(row).getByRole("button", { name: "Revisar" }));
  expect(props.open).toHaveBeenCalledWith({
    account: "a",
    through: "2026-01-31",
  });
  await u.click(within(row).getByRole("button", { name: "Editar" }));
  const d = screen.getByRole("dialog", { name: "Editar saldo real" });
  expect(
    (within(d).getByLabelText("Saldo real") as HTMLInputElement).value,
  ).toBe("9,00");
  expect((within(d).getByLabelText("Nota") as HTMLInputElement).value).toBe(
    "Anotación ficticia",
  );
  await u.clear(within(d).getByLabelText("Saldo real"));
  await u.type(within(d).getByLabelText("Saldo real"), "-1.234,56");
  await u.click(within(d).getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(api.save).toHaveBeenCalledWith(
    "saldos",
    "owner",
    {
      cuenta_id: "a",
      fecha_corte: "2026-01-31",
      saldo_real: "-1234.56",
      nota: "Anotación ficticia",
    },
    "balance-a",
  );
});
it("mantiene el modal y el valor introducido si falla guardar", async () => {
  api.save.mockRejectedValue(new Error("Fallo ficticio al guardar"));
  render(<AccountsPage {...props} />);
  const u = userEvent.setup(),
    t = await table();
  await u.click(within(t).getByRole("button", { name: "Sin saldo real" }));
  const d = screen.getByRole("dialog", { name: "Anotar saldo real" });
  await u.type(within(d).getByLabelText("Saldo real"), "1,23");
  await u.click(within(d).getByRole("button", { name: "Guardar" }));
  expect(await within(d).findByRole("alert")).toHaveProperty(
    "textContent",
    "Fallo ficticio al guardar",
  );
  expect(
    (within(d).getByLabelText("Saldo real") as HTMLInputElement).value,
  ).toBe("1,23");
});
