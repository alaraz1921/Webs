import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import type { CsvRow } from "../src/types";
const mock = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  inserted: [] as { table: string; values: unknown }[],
  fail: false,
  errorCode: null as string | null,
  present: [] as Record<string, unknown>[],
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.createClient }));
let api: typeof import("../src/api");
const r: CsvRow = {
  numero_fila: 1,
  fecha_valor: "2026-01-10",
  fecha_operacion: "2026-01-10",
  importe: "-10.00",
  moneda: "EUR",
  concepto: "Ficticio",
  entidad_csv: "Banco ficticio",
  nombre_producto_csv: "Cuenta ficticia",
  tipo_producto_csv: "Cuenta",
  tipo_movimiento: "gasto",
  categoria_csv: "Prueba",
  nota: "",
};
beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://ficticio.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_ficticio");
  mock.from.mockImplementation((table: string) => {
    let reading = false;
    const q = {
      insert: (values: unknown) => {
        mock.inserted.push({ table, values });
        return q;
      },
      select: () => {
        reading = true;
        return q;
      },
      in: () => q,
      eq: () => q,
      order: () => q,
      range: async () => ({ data: [{ numero_fila: 1 }], error: null }),
      single: async () => ({ data: { id: "batch" }, error: null }),
      then: (ok: (r: unknown) => unknown, fail: (e: unknown) => unknown) =>
        Promise.resolve(
          reading
            ? { data: mock.present, error: null }
            : mock.fail
              ? {
                  data: null,
                  error: { message: "Fallo simulado", code: mock.errorCode },
                }
              : { data: null, error: null },
        ).then(ok, fail),
    };
    return q;
  });
  mock.createClient.mockReturnValue({ from: mock.from });
  api = await import("../src/api");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  mock.inserted = [];
  mock.fail = false;
  mock.errorCode = null;
  mock.present = [];
  mock.from.mockClear();
});
describe("API de preparación sin acceso externo", () => {
  it("reanuda solo ordinales ausentes sin UPDATE, UPSERT ni DELETE", async () => {
    const progress = vi.fn();
    expect(
      await api.prepare(
        "owner",
        2026,
        { name: "ficticio.csv" } as File,
        "a".repeat(64),
        [r, { ...r, numero_fila: 2 }, { ...r, numero_fila: 3 }],
        progress,
        "batch",
      ),
    ).toBe("batch");
    expect(mock.inserted).toEqual([
      {
        table: "fintin_importacion_filas",
        values: [
          { ...r, numero_fila: 2, importacion_id: "batch", user_id: "owner" },
          { ...r, numero_fila: 3, importacion_id: "batch", user_id: "owner" },
        ],
      },
    ]);
    expect(progress).toHaveBeenLastCalledWith(100);
  });
  it("crea metadatos solo con las columnas que tienen GRANT", async () => {
    await api.prepare(
      "owner",
      2026,
      { name: "ficticio.csv" } as File,
      "b".repeat(64),
      [r],
      vi.fn(),
    );
    expect(mock.inserted[0]).toEqual({
      table: "fintin_importaciones",
      values: {
        user_id: "owner",
        ejercicio: 2026,
        nombre_archivo: "ficticio.csv",
        sha256_archivo: "b".repeat(64),
        filas_esperadas: 1,
      },
    });
  });
  it("propaga errores de carga y no confirma nada por sí misma", async () => {
    mock.fail = true;
    await expect(
      api.prepare(
        "owner",
        2026,
        { name: "ficticio.csv" } as File,
        "b".repeat(64),
        [r, { ...r, numero_fila: 2 }],
        vi.fn(),
        "batch",
      ),
    ).rejects.toThrow("Fallo simulado");
  });
  it("rechaza claves secretas o JWT con service_role", () => {
    expect(api.publicKey("sb_secret_ficticio")).toBe(false);
    expect(
      api.publicKey(
        "a." + btoa(JSON.stringify({ role: "service_role" })) + ".b",
      ),
    ).toBe(false);
    expect(
      api.publicKey("a." + btoa(JSON.stringify({ role: "anon" })) + ".b"),
    ).toBe(true);
    expect(api.publicKey("sb_publishable_ficticio")).toBe(true);
  });
});

const manual = {
  id: "20000000-0000-0000-0000-000000000001",
  cuenta_id: "account",
  fecha_valor: "2026-01-10",
  fecha_operacion: "2026-01-10",
  importe: "-10.00",
  moneda: "EUR",
  concepto: "Ficticio",
  tipo_movimiento: "gasto" as const,
  categoria_id: null,
  categoria_csv: "Prueba",
  nota: "",
};
describe("Carga manual atómica y reintentos", () => {
  it("envía un único INSERT y fuerza origen, propietario y columnas permitidas", async () => {
    await api.importManual("owner", [
      {
        ...manual,
        user_id: "other",
        origen: "csv",
        importacion_id: "forbidden",
      } as typeof manual,
      { ...manual, id: "20000000-0000-0000-0000-000000000002" },
    ]);
    expect(mock.inserted).toHaveLength(1);
    expect(mock.inserted[0].table).toBe("fintin_movimientos");
    const inserted = mock.inserted[0].values as Record<string, unknown>[];
    expect(
      inserted.every((r) => r.user_id === "owner" && r.origen === "manual"),
    ).toBe(true);
    expect(inserted[0]).not.toHaveProperty("importacion_id");
  });
  it("reconoce una carga ya confirmada sin insertar duplicados ni actualizar", async () => {
    mock.fail = true;
    mock.errorCode = "23505";
    mock.present = [manual];
    await expect(api.importManual("owner", [manual])).resolves.toBeUndefined();
    expect(mock.inserted).toHaveLength(1);
  });
  it("no afirma éxito si faltan UUID o los datos difieren tras un conflicto", async () => {
    mock.fail = true;
    mock.errorCode = "23505";
    await expect(api.importManual("owner", [manual])).rejects.toThrow(
      "Fallo simulado",
    );
    mock.present = [{ ...manual, cuenta_id: "other" }];
    await expect(api.importManual("owner", [manual])).rejects.toThrow(
      "Fallo simulado",
    );
  });
  it("no reintenta automáticamente un fallo de red ni acepta cargas vacías", async () => {
    mock.fail = true;
    await expect(api.importManual("owner", [manual])).rejects.toThrow(
      "Fallo simulado",
    );
    expect(mock.inserted).toHaveLength(1);
    await expect(api.importManual("owner", [])).rejects.toThrow("Carga manual");
  });
});
