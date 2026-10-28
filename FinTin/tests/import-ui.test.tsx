// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import type { Account, Alias } from "../src/types";
const api = vi.hoisted(() => ({
  list: vi.fn(),
  annual: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  rpc: vi.fn(),
  importManual: vi.fn(),
}));
vi.mock("../src/api", () => ({
  ...api,
  client: () => ({ rpc: api.rpc }),
  checked: (r: { data: unknown; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
}));
const csv = vi.hoisted(() => ({ readCsv: vi.fn(), fileHash: vi.fn() }));
vi.mock("../src/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/csv")>()),
  ...csv,
}));
import { ImportPage } from "../src/Import";
const a: Account = {
  id: "account",
  user_id: "owner",
  entidad: "Banco ficticio",
  nombre_producto: "Cuenta ficticia",
  tipo_producto: "Cuenta corriente",
  moneda: "EUR",
  saldo_inicial: "100.00",
  fecha_saldo_inicial: "2025-12-31",
  activo: true,
};
const alias: Alias = {
  id: "alias",
  user_id: "owner",
  cuenta_id: "account",
  entidad_csv: "Banco ficticio",
  nombre_producto_csv: "Cuenta ficticia",
  tipo_producto_csv: "Cuenta corriente",
};
const props = {
  uid: "owner",
  year: 2026,
  accounts: [a],
  categories: [],
  aliases: [alias],
  reload: vi.fn().mockResolvedValue(undefined),
};
async function upload() {
  api.list.mockResolvedValue([]);
  api.annual.mockResolvedValue([]);
  csv.fileHash.mockResolvedValue("a".repeat(64));
  const u = userEvent.setup();
  const input = screen.getByLabelText("CSV del ejercicio 2026");
  await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
  await u.upload(
    input,
    new File(["sintético"], "prueba.csv", { type: "text/csv" }),
  );
  await screen.findByText(/3 filas válidas/);
  return u;
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Flujo de publicación CSV", () => {
  it("exige confirmación y publica las tres filas incluidos duplicados", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/agregador-ficticio.csv", "utf8"),
    );
    api.prepare.mockResolvedValue("batch");
    api.rpc.mockResolvedValue({ data: { filas_importadas: 3 }, error: null });
    render(<ImportPage {...props} />);
    const u = await upload();
    const button = screen.getByRole("button", { name: "Publicar importación" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole("checkbox"));
    await u.click(button);
    await screen.findByText(
      "Importación confirmada: 3 movimientos CSV de 2026.",
    );
    expect(api.prepare.mock.calls[0][4]).toHaveLength(3);
    expect(api.rpc).toHaveBeenCalledWith("fintin_publicar_importacion", {
      p_importacion_id: "batch",
    });
  });
  it("previsualiza el aviso y publica fechas de operación vacías normalizadas", async () => {
    const fixture = readFileSync("fixtures/agregador-ficticio.csv", "utf8");
    csv.readCsv.mockResolvedValue(
      fixture.replace(/(\d{2}\/\d{2}\/2026),\d{2}\/\d{2}\/2026/g, "$1,"),
    );
    api.prepare.mockResolvedValue("batch");
    api.rpc.mockResolvedValue({ data: { filas_importadas: 3 }, error: null });
    render(<ImportPage {...props} />);
    const u = await upload();
    expect(
      await screen.findByText(
        "3 filas sin fecha de operación: se usará su fecha valor como fecha de operación.",
      ),
    ).toBeTruthy();
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Publicar importación" }));
    await screen.findByText(
      "Importación confirmada: 3 movimientos CSV de 2026.",
    );
    expect(
      api.prepare.mock.calls[0][4].every(
        (r: { fecha_valor: string; fecha_operacion: string }) =>
          r.fecha_operacion === r.fecha_valor,
      ),
    ).toBe(true);
  });

  it("incorpora nueve columnas como manuales tras confirmar, sin preparar ni publicar CSV", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/manuales-ficticios.csv", "utf8"),
    );
    api.importManual.mockResolvedValue(undefined);
    render(<ImportPage {...props} />);
    const u = userEvent.setup();
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            "Destino de los movimientos",
          ) as HTMLSelectElement
        ).disabled,
      ).toBe(false),
    );
    await u.selectOptions(
      screen.getByLabelText("Destino de los movimientos"),
      "manual",
    );
    await upload();
    expect(
      screen.queryByRole("heading", { name: "Confirmar sustitución" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Lote de preparación")).toBeNull();
    const button = screen.getByRole("button", { name: "Importar manuales" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole("checkbox"));
    await u.click(button);
    await screen.findByText(
      "Importación confirmada: 3 movimientos manuales añadidos.",
    );
    const [owner, rows] = api.importManual.mock.calls[0];
    expect(owner).toBe("owner");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      cuenta_id: "account",
      moneda: "EUR",
      importe: "-12.34",
      fecha_operacion: "2026-02-01",
      categoria_csv: "Hogar ficticio",
    });
    expect(api.prepare).not.toHaveBeenCalled();
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("bloquea una cuenta ambigua y permite asignarla antes de cargar manuales", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/manuales-ficticios.csv", "utf8"),
    );
    api.importManual.mockResolvedValue(undefined);
    render(
      <ImportPage
        {...props}
        accounts={[a, { ...a, id: "usd", moneda: "USD" }]}
        aliases={[]}
      />,
    );
    const u = userEvent.setup();
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            "Destino de los movimientos",
          ) as HTMLSelectElement
        ).disabled,
      ).toBe(false),
    );
    await u.selectOptions(
      screen.getByLabelText("Destino de los movimientos"),
      "manual",
    );
    await upload();
    await u.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Importar manuales",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await u.selectOptions(
      screen.getByLabelText(
        "Cuenta de destino: Banco ficticio / Cuenta ficticia",
      ),
      "usd",
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Importar manuales" }));
    await screen.findByText(
      "Importación confirmada: 3 movimientos manuales añadidos.",
    );
    expect(
      api.importManual.mock.calls[0][1].every(
        (r: { cuenta_id: string; moneda: string }) =>
          r.cuenta_id === "usd" && r.moneda === "USD",
      ),
    ).toBe(true);
  });
  it("conserva los UUID de la previsualización tras un error para reintentar sin duplicar", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/manuales-ficticios.csv", "utf8"),
    );
    api.importManual
      .mockRejectedValueOnce(new Error("Conexión interrumpida"))
      .mockResolvedValueOnce(undefined);
    render(<ImportPage {...props} />);
    const u = userEvent.setup();
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            "Destino de los movimientos",
          ) as HTMLSelectElement
        ).disabled,
      ).toBe(false),
    );
    await u.selectOptions(
      screen.getByLabelText("Destino de los movimientos"),
      "manual",
    );
    await upload();
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Importar manuales" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Conexión interrumpida",
    );
    const ids = api.importManual.mock.calls[0][1].map(
      (r: { id: string }) => r.id,
    );
    await u.click(screen.getByRole("button", { name: "Importar manuales" }));
    await screen.findByText(
      "Importación confirmada: 3 movimientos manuales añadidos.",
    );
    expect(
      api.importManual.mock.calls[1][1].map((r: { id: string }) => r.id),
    ).toEqual(ids);
  });
  it("bloquea una moneda incompatible sin invocar publicación", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/agregador-ficticio.csv", "utf8").replaceAll(
        ",EUR,",
        ",USD,",
      ),
    );
    render(<ImportPage {...props} />);
    const u = await upload();
    await u.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Publicar importación",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.prepare).not.toHaveBeenCalled();
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("muestra el fallo RPC y conserva el lote para reintento", async () => {
    api.list.mockResolvedValue([]);
    api.annual.mockResolvedValue([]);
    csv.readCsv.mockResolvedValue(
      readFileSync("fixtures/agregador-ficticio.csv", "utf8"),
    );
    api.prepare.mockResolvedValue("batch");
    api.rpc.mockResolvedValue({
      data: null,
      error: { message: "Lote incompleto" },
    });
    render(<ImportPage {...props} />);
    const u = await upload();
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "Publicar importación" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Lote incompleto",
    );
    expect(screen.queryByText(/Importación confirmada/)).toBeNull();
  });
});
