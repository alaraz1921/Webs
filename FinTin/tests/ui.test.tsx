// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Account, Category, Movement } from "../src/types";
const api = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  movements: vi.fn(),
}));
vi.mock("../src/api", () => api);
import { Settings } from "../src/Settings";
import { MovementPage, filtersFor } from "../src/Movements";
const account: Account = {
  id: "account",
  user_id: "owner",
  entidad: "Banco ficticio",
  nombre_producto: "Cuenta ficticia",
  tipo_producto: "Cuenta",
  moneda: "EUR",
  saldo_inicial: "100.00",
  fecha_saldo_inicial: "2025-12-31",
  activo: true,
};
const category: Category = {
  id: "category",
  user_id: "owner",
  nombre: "Prueba",
  tipo_movimiento: "gasto",
};
const common = {
  uid: "owner",
  accounts: [account],
  categories: [category],
  aliases: [],
  reload: vi.fn().mockResolvedValue(undefined),
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Operaciones de interfaz", () => {
  it("crea una cuenta con decimal exacto y propietario explícito", async () => {
    api.save.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<Settings {...common} accounts={[]} />);
    await u.type(screen.getByLabelText("Entidad"), "Banco sintético");
    await u.type(screen.getByLabelText("Nombre de producto"), "Nueva cuenta");
    await u.clear(screen.getByLabelText("Saldo inicial"));
    await u.type(screen.getByLabelText("Saldo inicial"), "1.234,56");
    await u.type(
      screen.getByLabelText("Fecha del saldo inicial"),
      "2025-12-31",
    );
    await u.click(screen.getAllByRole("button", { name: "Guardar" })[0]);
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "cuentas",
        "owner",
        expect.objectContaining({
          saldo_inicial: "1234.56",
          fecha_saldo_inicial: "2025-12-31",
        }),
        undefined,
      ),
    );
  });
  it("muestra CSV de solo lectura y ofrece edición solo al manual", async () => {
    const r: Movement = {
      id: "csv",
      cuenta_id: "account",
      fecha_valor: "2026-01-02",
      fecha_operacion: "2026-01-02",
      importe: "-10.00",
      moneda: "EUR",
      concepto: "Compra sintética",
      tipo_movimiento: "gasto",
      categoria_id: "category",
      categoria_csv: "",
      nota: "",
      origen: "csv",
    };
    api.movements.mockResolvedValue({
      rows: [r, { ...r, id: "manual", origen: "manual" }],
      count: 2,
    });
    render(
      <MovementPage
        {...common}
        filters={filtersFor(2026)}
        setFilters={vi.fn()}
      />,
    );
    await screen.findByText("CSV · solo lectura");
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Eliminar" })).toHaveLength(1);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Editar" }));
    await u.clear(screen.getByLabelText("Importe con signo"));
    await u.type(screen.getByLabelText("Importe con signo"), "-12,34");
    await u.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "movimientos",
        "owner",
        expect.objectContaining({
          origen: "manual",
          importe: "-12.34",
          moneda: "EUR",
        }),
        "manual",
      ),
    );
  });
  it("expone los fallos de Supabase sin afirmar que se guardó", async () => {
    api.save.mockRejectedValue(new Error("Cuenta inválida"));
    const u = userEvent.setup();
    render(<Settings {...common} />);
    await u.type(screen.getByLabelText("Nombre"), "Duplicada");
    await u.click(screen.getAllByRole("button", { name: "Guardar" })[1]);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Cuenta inválida",
    );
  });
});
