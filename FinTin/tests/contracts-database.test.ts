import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("aísla depósitos, financiaciones y pagos y rechaza un pago enlazado a otro propietario", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const revoked = "00000000-0000-0000-0000-000000000003";
  const financing = "10000000-0000-0000-0000-000000000001";
  const tables = ["depositos", "financiaciones", "financiacion_pagos"];
  const migration = (name: string) =>
    readFileSync("supabase/migrations/" + name, "utf8");
  try {
    await db.exec(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
    await db.exec(migration("20261027000001_fintin_inicial.sql"));
    await db.exec(migration("20261126000001_fintin_depositos_financiera.sql"));
    await db.exec(`
      INSERT INTO auth.users VALUES ('${owner}'),('${other}'),('${revoked}');
      INSERT INTO public.fintin_usuarios_autorizados(user_id) VALUES ('${owner}'),('${other}');
      SET request.jwt.claim.sub='${owner}';
      SET ROLE authenticated;
      INSERT INTO public.fintin_depositos(titular,nombre,fecha_apertura,duracion_meses,interes,retencion,aportacion)
        VALUES ('Ficticio','Depósito','2026-01-31',12,3,0,100);
      INSERT INTO public.fintin_financiaciones(id,nombre,importe_compra,total_cuotas)
        VALUES ('${financing}','Compra',100,2);
      INSERT INTO public.fintin_financiacion_pagos(financiacion_id,fecha,importe)
        VALUES ('${financing}','2026-11-26',50);
    `);
    await db.exec("RESET ROLE");
    await db.exec(migration("20261126000002_fintin_detalles_contratos.sql"));
    await db.exec("SET ROLE authenticated");
    expect(
      (
        await db.query(
          "SELECT fecha_inicio, fecha_fin FROM public.fintin_financiaciones",
        )
      ).rows,
    ).toEqual([{ fecha_inicio: null, fecha_fin: null }]);
    expect(
      (
        await db.query(
          "SELECT importe_liquidacion FROM public.fintin_depositos",
        )
      ).rows,
    ).toEqual([{ importe_liquidacion: null }]);
    await expect(
      db.exec(
        "UPDATE public.fintin_financiaciones SET fecha_inicio='2027-01-01', fecha_fin='2026-01-01'",
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await db.exec(
      "UPDATE public.fintin_financiaciones SET fecha_inicio='2026-01-01', fecha_fin='2027-01-01'",
    );
    await db.exec("UPDATE public.fintin_depositos SET importe_liquidacion=0");
    for (const table of tables) {
      expect(
        (await db.query(`SELECT id FROM public.fintin_${table}`)).rows,
      ).toHaveLength(1);
      const privileges = await db.query(
        `SELECT has_table_privilege('anon','public.fintin_${table}','SELECT') AS allowed`,
      );
      expect(privileges.rows).toEqual([{ allowed: false }]);
    }
    await expect(
      db.exec(
        `DELETE FROM public.fintin_financiaciones WHERE id = '${financing}'`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await db.exec(`SET request.jwt.claim.sub='${other}'`);
    for (const table of tables) {
      expect(
        (await db.query(`SELECT id FROM public.fintin_${table}`)).rows,
      ).toEqual([]);
      expect(
        (await db.query(`DELETE FROM public.fintin_${table} RETURNING id`))
          .rows,
      ).toEqual([]);
    }
    await expect(
      db.exec(
        `INSERT INTO public.fintin_financiacion_pagos(financiacion_id,fecha,importe) VALUES ('${financing}','2026-11-26',10)`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await db.exec(`SET request.jwt.claim.sub='${revoked}'`);
    await expect(
      db.exec(
        "INSERT INTO public.fintin_financiaciones(nombre,importe_compra,total_cuotas) VALUES ('Ficticia',100,2)",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await db.close();
  }
}, 30000);
