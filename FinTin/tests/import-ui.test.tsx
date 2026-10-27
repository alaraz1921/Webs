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
