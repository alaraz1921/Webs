// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Account } from "../src/types";
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../src/api", () => api);
import { AccountBalanceCards } from "../src/AccountBalanceCards";
afterEach(cleanup);
it("suma los cierres por tipo, respeta mes, entidad y moneda y no sustituye un mes sin cierre", async () => {
  const accounts: Account[] = [
    "a",
    "b",
    "credit",
    "investment",
    "cash",
    "other",
    "usd",
  ].map((id) => ({
    id,
    user_id: "owner",
    entidad: id === "other" ? "Otro banco" : "Banco A",
    nombre_producto: id,
    tipo_producto:
      id === "credit"
        ? "Tarjeta de crédito"
        : id === "investment"
          ? "Inversiones"
          : id === "cash"
            ? "Caja"
            : "Cuenta corriente",
    moneda: id === "usd" ? "USD" : "EUR",
    saldo_inicial: "0.00",
    fecha_saldo_inicial: "2025-12-31",
    activo: true,
  }));
  api.list.mockResolvedValue([
    ...accounts.map((a) => ({
      cuenta_id: a.id,
      moneda: a.moneda,
      fecha_cierre: "2026-01-31",
      saldo_calculado: a.id === "b" ? "0.02" : "10.01",
    })),
    ...accounts.map((a) => ({
      cuenta_id: a.id,
      moneda: a.moneda,
      fecha_cierre: "2026-02-28",
      saldo_calculado: a.id === "credit" ? "-30.00" : "20.00",
    })),
  ]);
  const props = {
    uid: "owner",
    year: 2026,
    month: "",
    currency: "EUR",
    entity: "Banco A",
    account: "",
    accounts,
  };
  const view = render(<AccountBalanceCards {...props} />);
  const cards = await screen.findByRole("group", {
    name: "Saldos de cuentas por tipo",
  });
  const card = (name: string) =>
    within(cards).getByRole("article", { name: `Saldo ${name}` });
  expect(card("Cuentas").textContent).toContain("40,00 €");
  expect(card("Tarjetas de crédito").textContent).toContain("-30,00 €");
  expect(card("Inversiones").textContent).toContain("20,00 €");
  expect(card("Caja").textContent).toContain("20,00 €");
  expect(card("Cuentas").textContent).toContain("28-02-2026");
  view.rerender(<AccountBalanceCards {...props} month="01" />);
  expect(card("Cuentas").textContent).toContain("10,03 €");
  expect(card("Cuentas").textContent).toContain("31-01-2026");
  view.rerender(<AccountBalanceCards {...props} month="01" account="a" />);
  expect(card("Cuentas").textContent).toContain("10,01 €");
  view.rerender(<AccountBalanceCards {...props} month="03" />);
  expect(card("Cuentas").querySelector("strong")?.textContent).toBe("—");
  expect(card("Cuentas").textContent).toContain("Sin cierre disponible");
});
