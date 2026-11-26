// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/api", () => api);
import { FinancingPage } from "../src/Financing";
import type { Payment } from "../src/contracts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("registra un pago en la compra elegida y actualiza sus importes y cuotas", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const payments: Payment[] = [];
  api.list.mockImplementation(async (table) =>
    table === "financiaciones"
      ? [
          {
            id: "a",
            nombre: "Compra A",
            notas: "",
            importe_compra: "300.00",
            total_cuotas: 3,
          },
          {
            id: "b",
            nombre: "Compra B",
            notas: "",
            importe_compra: "100.00",
            total_cuotas: 2,
          },
        ]
      : [...payments],
  );
  api.save.mockImplementation(async (_, __, payment) => {
    payments.push({ id: "p", ...payment });
  });
  const user = userEvent.setup();
  render(<FinancingPage uid="owner" />);
  await user.click(await screen.findByRole("button", { name: "Compra B" }));
  await user.click(screen.getByRole("button", { name: "Registrar pago" }));
  const dialog = screen.getByRole("dialog", { name: "Registrar pago" });
  await user.type(within(dialog).getByLabelText("Fecha"), "2026-11-26");
  await user.type(within(dialog).getByLabelText("Importe (€)"), "40,50");
  await user.type(within(dialog).getByLabelText("Nota"), "Primera cuota");
  await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
  expect(
    await screen.findByRole("cell", { name: "Primera cuota" }),
  ).toBeTruthy();
  expect(payments[0].financiacion_id).toBe("b");
  const purchase = screen
    .getByRole("button", { name: "Compra B" })
    .closest("tr")!;
  expect(
    within(purchase)
      .getAllByRole("cell")
      .slice(2, 6)
      .map((c) => c.textContent),
  ).toEqual(["40,50 €", "59,50 €", "2", "1"]);
  await user.click(screen.getByRole("button", { name: "Compra A" }));
  expect(screen.queryByRole("cell", { name: "Primera cuota" })).toBeNull();
});
