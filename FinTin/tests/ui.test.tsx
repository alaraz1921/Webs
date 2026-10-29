// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  within,
  fireEvent,
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
import { decimalComma } from "../src/amount-input";
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
it("ordena los filtros y sus opciones y actualiza las sumas al filtrar", async () => {
  api.movements.mockResolvedValueOnce({
    rows: [],
    count: 70,
    totals: [
      {
        currency: "EUR",
        total: "20.10",
        positive: "30.20",
        negative: "-10.10",
      },
    ],
  });
  const props = {
    ...common,
    filters: filtersFor(2026),
    setFilters: vi.fn(),
    accounts: [
      { ...account, id: "z", nombre_producto: "Zeta", entidad: "Zeta" },
      { ...account, id: "a", nombre_producto: "Álamo", entidad: "Álamo" },
    ],
    categories: [
      { ...category, id: "z", nombre: "Zeta" },
      { ...category, id: "a", nombre: "Álamo" },
    ],
  };
  const view = render(<MovementPage {...props} />);
  expect(
    [...view.container.querySelectorAll(".filters .field > span")].map(
      (e) => e.textContent,
    ),
  ).toEqual([
    "Desde",
    "Hasta",
    "Concepto",
    "Origen",
    "Tipo",
    "Categoría",
    "Entidad",
    "Cuenta",
    "Moneda",
  ]);
  for (const label of ["Entidad", "Cuenta"])
    expect(
      within(screen.getByLabelText(label))
        .getAllByRole("option")
        .map((e) => e.textContent),
    ).toEqual(["Todas", "Álamo", "Zeta"]);
  expect(
    within(screen.getByLabelText("Categoría"))
      .getAllByRole("option")
      .map((e) => e.textContent),
  ).toEqual(["Todas", "Sin categoría", "Álamo", "Zeta"]);
  let totals = await screen.findByRole("region", {
    name: "Totales de movimientos filtrados",
  });
  expect(totals.textContent).toContain("20,10 EUR");
  expect(totals.textContent).toContain("30,20 EUR");
  expect(totals.textContent).toContain("-10,10 EUR");
  const u = userEvent.setup();
  await u.selectOptions(screen.getByLabelText("Origen"), "manual");
  expect(props.setFilters).toHaveBeenLastCalledWith({
    ...props.filters,
    origin: "manual",
  });
  api.movements.mockResolvedValueOnce({ rows: [], count: 0, totals: [] });
  view.rerender(
    <MovementPage
      {...props}
      filters={{ ...props.filters, origin: "manual" }}
    />,
  );
  await screen.findByText("No hay movimientos para estos filtros.");
  totals = screen.getByRole("region", {
    name: "Totales de movimientos filtrados",
  });
  expect(within(totals).getAllByText("0,00 EUR")).toHaveLength(3);
  expect(totals.textContent).not.toContain("20,10 EUR");
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

it("ordena Movimientos desde las cabeceras en ambos sentidos y vuelve a la primera página", async () => {
  api.movements.mockResolvedValue({ rows: [], count: 101, totals: [] });
  render(
    <MovementPage
      {...common}
      filters={filtersFor(2026)}
      setFilters={vi.fn()}
    />,
  );
  const u = userEvent.setup();
  await screen.findByText(/101 movimientos · página 1/);
  await u.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText(/101 movimientos · página 2/);
  await u.click(screen.getByRole("button", { name: "Importe" }));
  await screen.findByText(/101 movimientos · página 1/);
  expect(api.movements.mock.lastCall?.[4]).toEqual({
    key: "amount",
    direction: "asc",
  });
  expect(
    screen
      .getByRole("button", { name: "Importe" })
      .closest("th")
      ?.getAttribute("aria-sort"),
  ).toBe("ascending");
  await u.click(screen.getByRole("button", { name: "Importe" }));
  await screen.findByText(/101 movimientos · página 1/);
  expect(api.movements.mock.lastCall?.[4]).toEqual({
    key: "amount",
    direction: "desc",
  });
  for (const label of [
    "Fecha valor / operación",
    "Concepto",
    "Cuenta de origen (CSV)",
    "Cuenta de destino",
    "Categoría",
    "Origen",
  ])
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Importe" })
      .closest("th")
      ?.getAttribute("aria-sort"),
  ).toBe("descending");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Operaciones de interfaz", () => {
  it("usa coma decimal del teclado numérico respetando selección, cursor y punto de miles", async () => {
    render(
      <input
        aria-label="Importe ficticio"
        defaultValue="1234"
        onKeyDown={decimalComma}
      />,
    );
    const input = screen.getByLabelText("Importe ficticio") as HTMLInputElement;
    input.setSelectionRange(2, 2);
    expect(
      fireEvent.keyDown(input, {
        key: ".",
        code: "NumpadDecimal",
        location: 3,
      }),
    ).toBe(false);
    expect(input.value).toBe("12,34");
    expect(input.selectionStart).toBe(3);
    input.setSelectionRange(2, 5);
    fireEvent.keyDown(input, { key: "Decimal", location: 3 });
    expect(input.value).toBe("12,");
    expect(fireEvent.keyDown(input, { key: ".", code: "Period" })).toBe(true);
    expect(
      fireEvent.keyDown(input, {
        key: "Delete",
        code: "NumpadDecimal",
        location: 3,
      }),
    ).toBe(true);
    const u = userEvent.setup();
    await u.clear(input);
    await u.type(input, "1.234,56");
    expect(input.value).toBe("1.234,56");
  });
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
