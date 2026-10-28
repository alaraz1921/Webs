// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
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
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Operaciones de interfaz", () => {
  it("crea una cuenta con decimal exacto y propietario explícito", async () => {
    api.save.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<Settings {...common} accounts={[]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await u.click(screen.getAllByRole("button", { name: "Nueva" })[0]);
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
  it("muestra saldos en la tabla y permite cancelar sin guardar y volver a un alta vacía", async () => {
    const u = userEvent.setup();
    render(<Settings {...common} />);
    expect(
      screen.getByRole("table", { name: "Cuentas y saldos" }).textContent,
    ).toContain("100,00 EUR");
    expect(screen.getByText("31/12/2025")).toBeTruthy();
    expect(screen.queryByLabelText("Saldo inicial")).toBeNull();
    const editButton = screen.getByRole("button", {
      name: "Editar cuenta Cuenta ficticia",
    });
    await u.click(editButton);
    const dialog = screen.getByRole("dialog", { name: "Editar cuenta" });
    expect(
      (within(dialog).getByLabelText("Saldo inicial") as HTMLInputElement)
        .value,
    ).toBe("100,00");
    await u.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(editButton);
    expect(api.save).not.toHaveBeenCalled();
    await u.click(screen.getAllByRole("button", { name: "Nueva" })[0]);
    expect((screen.getByLabelText("Entidad") as HTMLInputElement).value).toBe(
      "",
    );
  });
  it("edita categoría en modal conservando id y propietario y cierra al guardar", async () => {
    api.save.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(<Settings {...common} />);
    await u.click(
      screen.getByRole("button", { name: "Editar categoría Prueba" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Editar categoría" }),
    ).toBeTruthy();
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe(
      "gasto",
    );
    await u.clear(screen.getByLabelText("Nombre"));
    await u.type(screen.getByLabelText("Nombre"), "Hogar ficticio");
    await u.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "categorias",
        "owner",
        { nombre: "Hogar ficticio", tipo_movimiento: "gasto" },
        "category",
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("abre altas y edición de alias con la cuenta de destino correcta", async () => {
    api.save.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(
      <Settings
        {...common}
        aliases={[
          {
            id: "alias",
            user_id: "owner",
            cuenta_id: "account",
            entidad_csv: "Banco CSV",
            nombre_producto_csv: "Producto CSV",
            tipo_producto_csv: "Cuenta",
          },
        ]}
      />,
    );
    await u.click(screen.getAllByRole("button", { name: "Nueva" })[2]);
    expect(screen.getByRole("dialog", { name: "Nuevo alias" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Entidad CSV") as HTMLInputElement).value,
    ).toBe("");
    await u.click(screen.getByRole("button", { name: "Cerrar ventana" }));
    await u.click(
      screen.getByRole("button", {
        name: "Editar alias Banco CSV Producto CSV",
      }),
    );
    expect(
      (screen.getByLabelText("Entidad CSV") as HTMLInputElement).value,
    ).toBe("Banco CSV");
    expect(
      (screen.getByLabelText("Cuenta de destino") as HTMLSelectElement).value,
    ).toBe("account");
    await u.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        "cuenta_aliases",
        "owner",
        {
          entidad_csv: "Banco CSV",
          nombre_producto_csv: "Producto CSV",
          tipo_producto_csv: "Cuenta",
          cuenta_id: "account",
        },
        "alias",
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
    expect(screen.getAllByText("02-01-2026")).toHaveLength(4);
    expect(screen.queryByText("2026-01-02")).toBeNull();
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
    await u.click(screen.getAllByRole("button", { name: "Nueva" })[1]);
    await u.type(screen.getByLabelText("Nombre"), "Duplicada");
    await u.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Cuenta inválida",
    );
  });
});
