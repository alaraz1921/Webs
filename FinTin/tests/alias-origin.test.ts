import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const a = "10000000-0000-0000-0000-000000000001";
const b = "10000000-0000-0000-0000-000000000002";
const usd = "10000000-0000-0000-0000-000000000003";
const late = "10000000-0000-0000-0000-000000000004";
async function query(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows;
}
async function publish() {
  const batch = (
    await query(
      `INSERT INTO public.fintin_importaciones(ejercicio,nombre_archivo,filas_esperadas) VALUES (2026,'ejemplo-ficticio.csv',2) RETURNING id`,
    )
  )[0].id;
  await db.query(
    `INSERT INTO public.fintin_importacion_filas(importacion_id,numero_fila,fecha_valor,fecha_operacion,importe,moneda,entidad_csv,nombre_producto_csv,tipo_movimiento) VALUES ($1,1,'2026-01-10','2026-01-10',-10,'EUR','Banco ficticio','Origen A','gasto'),($1,2,'2026-01-10','2026-01-10',-20,'EUR','Banco ficticio','Origen B','gasto')`,
    [batch],
  );
  await db.query("SELECT public.fintin_publicar_importacion($1)", [batch]);
}
beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261027000001_fintin_inicial.sql",
      "utf8",
    ),
  );
  await db.exec(`INSERT INTO auth.users VALUES ('${owner}'),('${other}'); INSERT INTO public.fintin_usuarios_autorizados(user_id) VALUES ('${owner}'),('${other}'); SET request.jwt.claim.sub='${owner}'; SET ROLE authenticated;
    INSERT INTO public.fintin_cuentas(id,entidad,nombre_producto,moneda,saldo_inicial,fecha_saldo_inicial) VALUES ('${a}','Banco ficticio','Destino conjunto','EUR',100,'2025-12-31'),('${b}','Banco ficticio','Otro destino','EUR',50,'2025-12-31'),('${usd}','Banco ficticio','Dólares','USD',0,'2025-12-31'),('${late}','Banco ficticio','Corte posterior','EUR',0,'2026-02-01');
    INSERT INTO public.fintin_cuenta_aliases(cuenta_id,entidad_csv,nombre_producto_csv) VALUES ('${a}','Banco ficticio','Origen A'),('${a}','Banco ficticio','Origen B');
    INSERT INTO public.fintin_movimientos(origen,cuenta_id,fecha_valor,fecha_operacion,importe,moneda,tipo_movimiento) VALUES ('manual','${a}','2026-01-05','2026-01-05',5,'EUR','no_computable');`);
  await publish();
  await db.exec("RESET ROLE");
  const before = await query(
    "SELECT id,cuenta_id,importe::text FROM public.fintin_movimientos ORDER BY id",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261028000001_fintin_origen_alias.sql",
      "utf8",
    ),
  );
  expect(
    await query(
      "SELECT id,cuenta_id,importe::text FROM public.fintin_movimientos ORDER BY id",
    ),
  ).toEqual(before);
  await db.exec("SET ROLE authenticated");
}, 30000);
afterAll(() => db.close());

it("conserva los datos antiguos sin inventar un origen", async () => {
  expect(
    await query(
      "SELECT nombre_producto_csv FROM public.fintin_movimientos WHERE origen='csv'",
    ),
  ).toEqual([{ nombre_producto_csv: null }, { nombre_producto_csv: null }]);
});
it("conserva ambos orígenes tras limpiar staging y calcula un único saldo de destino", async () => {
  await db.exec("BEGIN");
  try {
    await publish();
    expect(
      await query(
        "SELECT nombre_producto_csv,cuenta_id FROM public.fintin_movimientos WHERE origen='csv' ORDER BY nombre_producto_csv",
      ),
    ).toEqual([
      { nombre_producto_csv: "Origen A", cuenta_id: a },
      { nombre_producto_csv: "Origen B", cuenta_id: a },
    ]);
    expect(
      await query(
        "SELECT count(*)::int n FROM public.fintin_importacion_filas",
      ),
    ).toEqual([{ n: 0 }]);
    expect(
      await query(
        `SELECT saldo_calculado::text FROM public.fintin_v_conciliacion_mensual WHERE cuenta_id='${a}' AND fecha_cierre='2026-01-31'`,
      ),
    ).toEqual([{ saldo_calculado: "75.00" }]);
  } finally {
    await db.exec("ROLLBACK");
  }
});
it("reasigna solo el origen exacto al editar el alias y recalcula ambos destinos", async () => {
  await db.exec("BEGIN");
  try {
    await publish();
    const before = await query(
      "SELECT id,importe::text,fecha_valor::text,nombre_producto_csv FROM public.fintin_movimientos ORDER BY id",
    );
    await db.exec(
      `UPDATE public.fintin_cuenta_aliases SET cuenta_id='${b}' WHERE nombre_producto_csv='Origen B'`,
    );
    expect(
      await query(
        "SELECT nombre_producto_csv,cuenta_id FROM public.fintin_movimientos WHERE origen='csv' ORDER BY nombre_producto_csv",
      ),
    ).toEqual([
      { nombre_producto_csv: "Origen A", cuenta_id: a },
      { nombre_producto_csv: "Origen B", cuenta_id: b },
    ]);
    expect(
      await query(
        "SELECT id,importe::text,fecha_valor::text,nombre_producto_csv FROM public.fintin_movimientos ORDER BY id",
      ),
    ).toEqual(before);
    expect(
      await query(
        `SELECT cuenta_id,saldo_calculado::text FROM public.fintin_v_conciliacion_mensual WHERE cuenta_id IN ('${a}','${b}') AND fecha_cierre='2026-01-31' ORDER BY cuenta_id`,
      ),
    ).toEqual([
      { cuenta_id: a, saldo_calculado: "95.00" },
      { cuenta_id: b, saldo_calculado: "30.00" },
    ]);
    expect(
      await query(
        `SELECT cuenta_id FROM public.fintin_movimientos WHERE origen='manual'`,
      ),
    ).toEqual([{ cuenta_id: a }]);
    await db.exec(`SET request.jwt.claim.sub='${other}'`);
    expect(
      await query(
        "UPDATE public.fintin_cuenta_aliases SET cuenta_id=cuenta_id RETURNING id",
      ),
    ).toEqual([]);
    expect(await query("SELECT * FROM public.fintin_movimientos")).toEqual([]);
  } finally {
    await db.exec(`ROLLBACK; SET request.jwt.claim.sub='${owner}'`);
  }
});
it.each([usd, late])(
  "revierte alias y movimientos si el destino %s es incompatible",
  async (target) => {
    await db.exec("BEGIN");
    try {
      await publish();
      await db.exec("SAVEPOINT bad_target");
      await expect(
        db.exec(
          `UPDATE public.fintin_cuenta_aliases SET cuenta_id='${target}' WHERE nombre_producto_csv='Origen A'`,
        ),
      ).rejects.toThrow();
      await db.exec("ROLLBACK TO SAVEPOINT bad_target");
      expect(
        await query(
          "SELECT cuenta_id FROM public.fintin_cuenta_aliases WHERE nombre_producto_csv='Origen A'",
        ),
      ).toEqual([{ cuenta_id: a }]);
      expect(
        await query(
          "SELECT DISTINCT cuenta_id FROM public.fintin_movimientos WHERE origen='csv'",
        ),
      ).toEqual([{ cuenta_id: a }]);
    } finally {
      await db.exec("ROLLBACK");
    }
  },
);
it("no permite invocar el trigger privado ni editar los CSV directamente", async () => {
  expect(
    await query(
      "SELECT has_function_privilege('authenticated','fintin_private.fintin_reasignar_alias()','EXECUTE') ok",
    ),
  ).toEqual([{ ok: false }]);
  expect(
    await query(
      `UPDATE public.fintin_movimientos SET cuenta_id='${b}' WHERE origen='csv' RETURNING id`,
    ),
  ).toEqual([]);
});
