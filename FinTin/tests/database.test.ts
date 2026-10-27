import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
const db = new PGlite();
const u = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002",
  outsider = "00000000-0000-0000-0000-000000000003";
const account = "10000000-0000-0000-0000-000000000001";
async function rows(sql: string) {
  return (await db.query(sql)).rows as Record<string, unknown>[];
}
async function as(uid: string, role = "authenticated") {
  await db.exec(
    `RESET ROLE; SET request.jwt.claim.sub='${uid}'; SET ROLE ${role}`,
  );
}
async function count(
  sql = "SELECT count(*)::int n FROM public.fintin_movimientos",
) {
  return (await rows(sql))[0].n;
}
async function batch(year = 2026, expected = 2) {
  return (
    await rows(
      `INSERT INTO public.fintin_importaciones(user_id,ejercicio,nombre_archivo,filas_esperadas) VALUES ('${u}',${year},'ficticio.csv',${expected}) RETURNING id`,
    )
  )[0].id as string;
}
async function stage(
  id: string,
  n = 1,
  date = "2026-01-10",
  currency = "EUR",
  entity = "Banco ficticio",
) {
  await db.exec(
    `INSERT INTO public.fintin_importacion_filas(importacion_id,user_id,numero_fila,fecha_valor,fecha_operacion,importe,moneda,entidad_csv,nombre_producto_csv,tipo_movimiento,categoria_csv) VALUES ('${id}','${u}',${n},'${date}','${date}',-10,'${currency}','${entity}','Cuenta ficticia','gasto','Prueba')`,
  );
}
async function publish(id: string) {
  await db.query("SELECT public.fintin_publicar_importacion($1)", [id]);
}
beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261027000001_fintin_inicial.sql",
      "utf8",
    ),
  );
  await db.exec(
    `INSERT INTO auth.users VALUES ('${u}'),('${other}'),('${outsider}'); INSERT INTO public.fintin_usuarios_autorizados(user_id) VALUES ('${u}'),('${other}');`,
  );
  await as(u);
  await db.exec(
    `INSERT INTO public.fintin_cuentas(id,user_id,entidad,nombre_producto,moneda,saldo_inicial,fecha_saldo_inicial) VALUES ('${account}','${u}','Banco ficticio','Cuenta ficticia','EUR',100,'2025-12-31'); INSERT INTO public.fintin_cuenta_aliases(user_id,cuenta_id,entidad_csv,nombre_producto_csv) VALUES ('${u}','${account}','Banco ficticio','Cuenta ficticia'); INSERT INTO public.fintin_movimientos(user_id,origen,fecha_valor,fecha_operacion,importe,moneda,cuenta_id,tipo_movimiento) VALUES ('${u}','manual','2026-01-05','2026-01-05',20,'EUR','${account}','no_computable');`,
  );
}, 30000);
afterAll(() => db.close());
describe("Migración real en PostgreSQL embebido", () => {
  it("grants mínimos, RLS en 8 tablas y vistas invocadoras", async () => {
    await as(u);
    expect(
      (
        await rows(
          `SELECT has_table_privilege('anon','public.fintin_movimientos','SELECT') ok`,
        )
      )[0].ok,
    ).toBe(false);
    expect(
      (
        await rows(
          `SELECT has_table_privilege('authenticated','public.fintin_usuarios_autorizados','INSERT') ok`,
        )
      )[0].ok,
    ).toBe(false);
    expect(
      await count(
        `SELECT count(*)::int n FROM pg_class WHERE relname LIKE 'fintin_%' AND relkind='r' AND relrowsecurity`,
      ),
    ).toBe(8);
    expect(
      await count(
        `SELECT count(*)::int n FROM pg_class WHERE relname LIKE 'fintin_v_%' AND 'security_invoker=true'=ANY(reloptions)`,
      ),
    ).toBe(3);
  });
  it("anon, ajeno, otro autorizado y usuario revocado no acceden", async () => {
    await as("", "anon");
    await expect(rows("SELECT * FROM public.fintin_cuentas")).rejects.toThrow();
    await as(outsider);
    expect(
      await count("SELECT count(*)::int n FROM public.fintin_cuentas"),
    ).toBe(0);
    await as(other);
    expect(
      await count("SELECT count(*)::int n FROM public.fintin_cuentas"),
    ).toBe(0);
    expect(
      await count(
        "SELECT count(*)::int n FROM public.fintin_v_conciliacion_mensual",
      ),
    ).toBe(0);
    await db.exec("RESET ROLE");
    await db.exec(
      `UPDATE public.fintin_usuarios_autorizados SET activo=false WHERE user_id='${u}'`,
    );
    await as(u);
    expect(await count()).toBe(0);
    await db.exec("RESET ROLE");
    await db.exec(
      `UPDATE public.fintin_usuarios_autorizados SET activo=true WHERE user_id='${u}'`,
    );
    await as(u);
    expect(await count()).toBe(1);
  });
  it("bloquea autorizaciones, cuenta ajena y CSV directo", async () => {
    await expect(
      db.exec(
        `INSERT INTO public.fintin_usuarios_autorizados(user_id) VALUES ('${outsider}')`,
      ),
    ).rejects.toThrow();
    await as(other);
    await expect(
      db.exec(
        `INSERT INTO public.fintin_movimientos(origen,fecha_valor,fecha_operacion,importe,moneda,cuenta_id,tipo_movimiento) VALUES ('manual','2026-01-10','2026-01-10',1,'EUR','${account}','ingreso')`,
      ),
    ).rejects.toThrow();
    await as(u);
    await expect(
      db.exec(`UPDATE public.fintin_movimientos SET origen='csv'`),
    ).rejects.toThrow();
  });
  it("publica duplicados y vuelve a sustituir sin alterar manuales", async () => {
    const id = await batch();
    await stage(id);
    await stage(id, 2);
    await publish(id);
    expect(await count()).toBe(3);
    const id2 = await batch();
    await stage(id2);
    await stage(id2, 2);
    await publish(id2);
    expect(await count()).toBe(3);
    expect(
      await count(
        `SELECT count(*)::int n FROM public.fintin_importaciones WHERE estado='sustituida'`,
      ),
    ).toBe(1);
    expect(
      await count(
        "SELECT count(*)::int n FROM public.fintin_importacion_filas",
      ),
    ).toBe(0);
    expect(
      await rows(
        `UPDATE public.fintin_movimientos SET nota='no' WHERE origen='csv' RETURNING 1 n`,
      ),
    ).toHaveLength(0);
    await db.exec(`DELETE FROM public.fintin_movimientos WHERE origen='csv'`);
    expect(await count()).toBe(3);
  });
  it("rechaza incompletos, año, alias, moneda y fecha inicial sin tocar publicados", async () => {
    for (const args of [
      [2026, 2, "2026-01-10", "EUR", "Banco ficticio"],
      [2026, 1, "2025-12-30", "EUR", "Banco ficticio"],
      [2026, 1, "2026-01-10", "USD", "Banco ficticio"],
      [2026, 1, "2026-01-10", "EUR", "Desconocido"],
    ] as const) {
      const id = await batch(args[0], args[1]);
      await stage(id, 1, args[2], args[3], args[4]);
      await expect(publish(id)).rejects.toThrow();
      expect(await count()).toBe(3);
    }
    const id = await batch(2026, 1);
    await stage(id);
    await as(other);
    await expect(publish(id)).rejects.toThrow();
    await as("", "anon");
    await expect(publish(id)).rejects.toThrow();
    await as(u);
  });
  it("conserva otro ejercicio y calcula incluyendo no computables", async () => {
    // Un lote de una fila deja 100 +20 -10 =110.
    const id = await batch(2026, 1);
    await stage(id);
    await publish(id);
    expect(
      (
        await rows(
          `SELECT saldo_calculado::text s FROM public.fintin_v_conciliacion_mensual WHERE fecha_cierre='2026-01-31'`,
        )
      )[0].s,
    ).toBe("110.00");
    expect(
      (
        await rows(
          `SELECT sum(total)::text s FROM public.fintin_v_resumen_categorias_mensual WHERE tipo_movimiento<>'no_computable'`,
        )
      )[0].s,
    ).toBe("-10.00");
    const future = await batch(2027, 1);
    await stage(future, 1, "2027-01-10");
    await publish(future);
    const again = await batch(2026, 1);
    await stage(again);
    await publish(again);
    expect(await count()).toBe(3);
    await db.exec(
      `UPDATE public.fintin_movimientos SET nota='Editable' WHERE origen='manual'`,
    );
    expect(
      await count(
        `SELECT count(*)::int n FROM public.fintin_movimientos WHERE nota='Editable'`,
      ),
    ).toBe(1);
  });
  it("FKs compuestas rechazan categoría y alias de otro propietario", async () => {
    await as(other);
    const category = (
      await rows(
        "INSERT INTO public.fintin_categorias(nombre,tipo_movimiento) VALUES ('Categoría ajena','gasto') RETURNING id",
      )
    )[0].id;
    await expect(
      db.exec(
        `INSERT INTO public.fintin_cuenta_aliases(cuenta_id,entidad_csv,nombre_producto_csv) VALUES ('${account}','Ajena','Ajena')`,
      ),
    ).rejects.toThrow();
    await as(u);
    await expect(
      db.exec(
        `INSERT INTO public.fintin_movimientos(origen,fecha_valor,fecha_operacion,importe,moneda,cuenta_id,tipo_movimiento,categoria_id) VALUES ('manual','2026-01-10','2026-01-10',-1,'EUR','${account}','gasto','${category}')`,
      ),
    ).rejects.toThrow();
  });
  it("bloquea CSV directo, RPC sin sesión, índice fuera de rango y saldo de partida", async () => {
    await as(u);
    const id = await batch(2026, 1);
    await expect(
      db.exec(
        `INSERT INTO public.fintin_movimientos(origen,importacion_id,numero_fila_csv,fecha_valor,fecha_operacion,importe,moneda,cuenta_id,tipo_movimiento) VALUES ('csv','${id}',1,'2026-01-10','2026-01-10',-1,'EUR','${account}','gasto')`,
      ),
    ).rejects.toThrow();
    await stage(id, 2);
    await expect(publish(id)).rejects.toThrow();
    const cutoff = await batch(2025, 1);
    await stage(cutoff, 1, "2025-12-31");
    await expect(publish(cutoff)).rejects.toThrow();
    await as("");
    await expect(publish(id)).rejects.toThrow("Es necesario iniciar sesión");
    await as(u);
    expect(await count()).toBe(3);
    expect(
      await count(
        "SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'fintin_%' AND p.prosecdef",
      ),
    ).toBe(0);
  });
  it("usuario autorizado puede borrar solo sus manuales", async () => {
    await as(u);
    await db.exec(
      "DELETE FROM public.fintin_movimientos WHERE origen='manual'",
    );
    expect(
      await count(
        "SELECT count(*)::int n FROM public.fintin_movimientos WHERE origen='manual'",
      ),
    ).toBe(0);
    expect(await count()).toBe(2);
  });
});
