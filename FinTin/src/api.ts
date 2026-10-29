import { MAX_MANUAL_IMPORT_ROWS, type ManualImportRow } from "./manual-import";
import { publicKey, validUrl } from "./config";
import { createClient } from "@supabase/supabase-js";
import type { CsvRow, Movement } from "./types";
import Decimal from "decimal.js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export { publicKey } from "./config";
export const configured = Boolean(
  url && key && validUrl(url) && publicKey(key),
);
export const db = configured
  ? createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export function client() {
  if (!db) throw new Error("Configura la URL y la clave pública de Supabase");
  return db;
}
export function checked<T>(r: {
  data: T;
  error: { message: string } | null;
}): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
const selects: Record<string, string> = {
  cuentas:
    "id,user_id,entidad,nombre_producto,tipo_producto,moneda,saldo_inicial::text,fecha_saldo_inicial,activo",
  movimientos:
    "id,user_id,cuenta_id,fecha_valor,fecha_operacion,importe::text,moneda,concepto,tipo_movimiento,categoria_id,categoria_csv,nota,origen,entidad_csv,nombre_producto_csv,tipo_producto_csv",
  saldos: "id,user_id,cuenta_id,fecha_corte,saldo_real::text,nota",
  v_conciliacion_mensual:
    "user_id,cuenta_id,fecha_cierre,moneda,saldo_calculado::text,saldo_real::text,diferencia::text",
};
export async function list<T>(table: string, uid: string) {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const data = checked(
      await client()
        .from("fintin_" + table)
        .select(selects[table] || "*")
        .eq("user_id", uid)
        .order(table === "v_conciliacion_mensual" ? "fecha_cierre" : "id")
        .order(table === "v_conciliacion_mensual" ? "cuenta_id" : "id")
        .range(from, from + 999),
    ) as unknown as T[];
    result.push(...data);
    if (data.length < 1000) return result;
  }
}
export async function save(
  table: string,
  uid: string,
  values: Record<string, unknown>,
  id?: string,
) {
  const q = client().from("fintin_" + table);
  checked(
    await (id
      ? q
          .update(
            table === "movimientos" ? { ...values, origen: "manual" } : values,
          )
          .eq("user_id", uid)
          .eq("id", id)
          .select("id")
          .single()
      : q
          .insert({ ...values, user_id: uid })
          .select("id")
          .single()),
  );
}
export async function remove(table: string, uid: string, id: string) {
  let q = client()
    .from("fintin_" + table)
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
  if (table === "movimientos") q = q.eq("origen", "manual");
  checked(await q.select("id").single());
}
export interface Filters {
  from: string;
  to: string;
  account: string;
  category: string;
  kind: string;
  origin: string;
  search: string;
  entity: string;
  currency: string;
}
export async function movements(
  uid: string,
  f: Filters,
  page: number,
  accountIds?: string[],
) {
  const query = (columns: string, count = false) => {
    let q = client()
      .from("fintin_movimientos")
      .select(columns, count ? { count: "exact" } : {})
      .eq("user_id", uid)
      .gte("fecha_valor", f.from)
      .lte("fecha_valor", f.to);
    if (f.account) q = q.eq("cuenta_id", f.account);
    if (f.currency) q = q.eq("moneda", f.currency);
    if (f.category)
      q =
        f.category === "__none"
          ? q.is("categoria_id", null)
          : q.eq("categoria_id", f.category);
    if (f.kind) q = q.eq("tipo_movimiento", f.kind);
    if (f.origin) q = q.eq("origen", f.origin);
    if (f.search)
      q = q.ilike("concepto", "%" + f.search.replace(/[%_\\]/g, "\\$&") + "%");
    if (accountIds) q = q.in("cuenta_id", accountIds);
    return q;
  };
  const totals = new Map<
    string,
    { total: Decimal; positive: Decimal; negative: Decimal }
  >();
  // Recorre todos los resultados filtrados, no solo la página visible.
  for (let from = 0; ; from += 1000) {
    const rows = checked(
      await query("importe::text,moneda")
        .order("id")
        .range(from, from + 999),
    ) as unknown as Pick<Movement, "importe" | "moneda">[];
    for (const row of rows) {
      const t = totals.get(row.moneda) ?? {
        total: new Decimal(0),
        positive: new Decimal(0),
        negative: new Decimal(0),
      };
      const value = new Decimal(row.importe);
      t.total = t.total.plus(value);
      if (value.gt(0)) t.positive = t.positive.plus(value);
      if (value.lt(0)) t.negative = t.negative.plus(value);
      totals.set(row.moneda, t);
    }
    if (rows.length < 1000) break;
  }
  const r = await query(selects.movimientos, true)
    .order("fecha_valor", { ascending: false })
    .order("id")
    .range(page * 50, page * 50 + 49);
  return {
    rows: checked(r) as unknown as Movement[],
    count: r.count || 0,
    totals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([currency, t]) => ({
        currency,
        total: t.total.toFixed(2),
        positive: t.positive.toFixed(2),
        negative: t.negative.toFixed(2),
      })),
  };
}
export async function annual(uid: string, year: number) {
  const result: Movement[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = checked(
      await client()
        .from("fintin_movimientos")
        .select(selects.movimientos)
        .eq("user_id", uid)
        .gte("fecha_valor", `${year}-01-01`)
        .lt("fecha_valor", `${year + 1}-01-01`)
        .order("id")
        .range(from, from + 999),
    ) as unknown as Movement[];
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}
export async function prepare(
  uid: string,
  year: number,
  file: File,
  hash: string,
  rows: CsvRow[],
  progress: (n: number) => void,
  resumeId?: string,
) {
  let id = resumeId;
  if (!id) {
    const batch = checked(
      await client()
        .from("fintin_importaciones")
        .insert({
          user_id: uid,
          ejercicio: year,
          nombre_archivo: file.name,
          sha256_archivo: hash,
          filas_esperadas: rows.length,
        })
        .select("id")
        .single(),
    );
    id = batch!.id as string;
  }
  progress(0);
  // SELECT is permitted on staging; resume only missing ordinals, no UPDATE grant required.
  const present = new Set<number>();
  for (let from = 0; ; from += 1000) {
    const data = checked(
      await client()
        .from("fintin_importacion_filas")
        .select("numero_fila")
        .eq("user_id", uid)
        .eq("importacion_id", id)
        .order("numero_fila")
        .range(from, from + 999),
    );
    (data || []).forEach((r) => present.add(r.numero_fila));
    if ((data || []).length < 1000) break;
  }
  const missing = rows.filter((r) => !present.has(r.numero_fila));
  for (let i = 0; i < missing.length; i += 500) {
    checked(
      await client()
        .from("fintin_importacion_filas")
        .insert(
          missing
            .slice(i, i + 500)
            .map((r) => ({ ...r, importacion_id: id, user_id: uid })),
        ),
    );
    progress(
      Math.min(
        100,
        Math.round(
          ((present.size + i + Math.min(500, missing.length - i)) /
            rows.length) *
            100,
        ),
      ),
    );
  }
  progress(100);
  return id;
}

// Un único INSERT de PostgREST: todas las filas se confirman o se revierten juntas.
// Los UUID se mantienen en la previsualización para reconocer un reintento incierto.
export async function importManual(uid: string, rows: ManualImportRow[]) {
  if (
    !rows.length ||
    rows.length > MAX_MANUAL_IMPORT_ROWS ||
    new Set(rows.map((r) => r.id)).size !== rows.length
  )
    throw new Error(
      "Carga manual vacía, demasiado grande o con identificadores repetidos.",
    );
  const values = rows.map((r) => ({
    id: r.id,
    user_id: uid,
    origen: "manual",
    cuenta_id: r.cuenta_id,
    fecha_valor: r.fecha_valor,
    fecha_operacion: r.fecha_operacion,
    importe: r.importe,
    moneda: r.moneda,
    concepto: r.concepto,
    tipo_movimiento: r.tipo_movimiento,
    categoria_id: r.categoria_id,
    categoria_csv: r.categoria_csv,
    nota: r.nota,
    entidad_csv: r.entidad_csv ?? null,
    nombre_producto_csv: r.nombre_producto_csv ?? null,
    tipo_producto_csv: r.tipo_producto_csv ?? null,
  }));
  const result = await client().from("fintin_movimientos").insert(values);
  if (result.error?.code === "23505") {
    const present = new Map<string, ManualImportRow>();
    for (let from = 0; from < rows.length; from += 100) {
      const data = checked(
        await client()
          .from("fintin_movimientos")
          .select(
            "id,cuenta_id,fecha_valor,fecha_operacion,importe::text,moneda,concepto,tipo_movimiento,categoria_id,categoria_csv,nota,entidad_csv,nombre_producto_csv,tipo_producto_csv",
          )
          .eq("user_id", uid)
          .eq("origen", "manual")
          .in(
            "id",
            rows.slice(from, from + 100).map((r) => r.id),
          ),
      );
      (data || []).forEach((r) => present.set(r.id, r as ManualImportRow));
    }
    if (
      rows.every((r) => {
        const saved = present.get(r.id);
        return (
          saved &&
          (Object.keys(r) as (keyof ManualImportRow)[]).every(
            (key) => r[key] === saved[key],
          )
        );
      })
    )
      return;
  }
  checked(result);
}
