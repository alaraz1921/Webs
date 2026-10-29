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
  entidad_csv: "Entidad CSV ficticia",
  nombre_producto_csv: "Producto CSV ficticio",
  tipo_producto_csv: "Cuenta",
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
    expect(inserted[0]).toMatchObject({
      entidad_csv: manual.entidad_csv,
      nombre_producto_csv: manual.nombre_producto_csv,
      tipo_producto_csv: manual.tipo_producto_csv,
    });
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

describe("Totales de movimientos filtrados", () => {
  it("suma más de mil resultados con decimales exactos y separa las monedas aplicando todos los filtros", async () => {
    const queries: { columns: string; calls: unknown[][] }[] = [];
    mock.from
      .mockImplementationOnce(build)
      .mockImplementationOnce(build)
      .mockImplementationOnce(build);
    function build() {
      const record = { columns: "", calls: [] as unknown[][] };
      queries.push(record);
      const q: Record<string, unknown> = {};
      for (const method of ["eq", "gte", "lte", "is", "ilike", "in", "order"])
        q[method] = (...args: unknown[]) => {
          record.calls.push([method, ...args]);
          return q;
        };
      q.select = (columns: string) => {
        record.columns = columns;
        return q;
      };
      q.range = async (from: number, to: number) => {
        record.calls.push(["range", from, to]);
        return {
          error: null,
          count: 1004,
          data:
            record.columns === "importe::text,moneda"
              ? from === 0
                ? Array.from({ length: 1000 }, () => ({
                    importe: "0.10",
                    moneda: "EUR",
                  }))
                : [
                    { importe: "-0.20", moneda: "EUR" },
                    { importe: "0.00", moneda: "EUR" },
                    { importe: "1.00", moneda: "USD" },
                    { importe: "-2.01", moneda: "USD" },
                  ]
              : [{ id: "visible" }],
        };
      };
      return q;
    }
    const f = {
      from: "2026-01-01",
      to: "2026-12-31",
      account: "a",
      category: "__none",
      kind: "gasto",
      origin: "manual",
      search: "10%_",
      entity: "Banco",
      currency: "EUR",
    };
    const result = await api.movements("owner", f, 2, ["a"]);
    expect(result.totals).toEqual([
      {
        currency: "EUR",
        total: "99.80",
        positive: "100.00",
        negative: "-0.20",
      },
      { currency: "USD", total: "-1.01", positive: "1.00", negative: "-2.01" },
    ]);
    expect(result.rows).toEqual([{ id: "visible" }]);
    expect(result.count).toBe(1004);
    for (const q of queries) {
      expect(q.calls).toEqual(
        expect.arrayContaining([
          ["eq", "user_id", "owner"],
          ["gte", "fecha_valor", f.from],
          ["lte", "fecha_valor", f.to],
          ["eq", "cuenta_id", "a"],
          ["eq", "moneda", "EUR"],
          ["is", "categoria_id", null],
          ["eq", "tipo_movimiento", "gasto"],
          ["eq", "origen", "manual"],
          ["ilike", "concepto", "%10\\%\\_%"],
          ["in", "cuenta_id", ["a"]],
        ]),
      );
    }
    expect(queries[1].calls).toContainEqual(["range", 1000, 1999]);
    expect(queries[2].calls).toContainEqual(["range", 100, 149]);
  });
});
