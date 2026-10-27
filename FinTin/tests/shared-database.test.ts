import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, it, expect } from "vitest";
const db = new PGlite();
afterAll(() => db.close());
it("instala FinTin junto al esquema real local de TrackTin sin cambiar datos, políticas ni grants existentes", async () => {
  await db.exec(readFileSync("supabase/tests/bootstrap.sql", "utf8"));
  // gen_random_uuid es nativo en PostgreSQL; PGlite no necesita instalar pgcrypto.
  const tracktin = readFileSync(
    "../TrackTin/supabase/tracktin_schema.sql",
    "utf8",
  ).replace(/create extension if not exists pgcrypto;/i, "");
  await db.exec(tracktin);
  const uid = "00000000-0000-0000-0000-000000000099";
  await db.exec(`INSERT INTO auth.users VALUES ('${uid}');
 INSERT INTO public.tracktin_media(user_id,tmdb_id,media_type) VALUES ('${uid}',1,'movie');
 INSERT INTO public.tracktin_user_preferences(user_id) VALUES ('${uid}');
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.tracktin_media,public.tracktin_episode_progress,public.tracktin_user_preferences TO authenticated;
 CREATE TABLE public.app_projects(id integer PRIMARY KEY,slug text);
 CREATE TABLE public.project_members(user_id uuid,project_id integer);
 INSERT INTO public.app_projects VALUES (1,'tracktin');
 INSERT INTO public.project_members VALUES ('${uid}',1);`);
  const snapshot = async () => ({
    tables: (
      await db.query(
        `SELECT relname,relacl,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND left(c.relname,7)<>'fintin_' ORDER BY relname`,
      )
    ).rows,
    policies: (
      await db.query(
        `SELECT * FROM pg_policies WHERE tablename LIKE 'tracktin_%' ORDER BY tablename,policyname`,
      )
    ).rows,
    media: (await db.query("SELECT * FROM public.tracktin_media ORDER BY id"))
      .rows,
    prefs: (
      await db.query(
        "SELECT * FROM public.tracktin_user_preferences ORDER BY id",
      )
    ).rows,
    users: (await db.query("SELECT * FROM auth.users ORDER BY id")).rows,
    projects: (await db.query("SELECT * FROM public.app_projects ORDER BY id"))
      .rows,
    members: (
      await db.query("SELECT * FROM public.project_members ORDER BY user_id")
    ).rows,
  });
  const before = await snapshot();
  const metadataSql = readFileSync("supabase/verify-other-apps.sql", "utf8");
  const signaturesBefore = (await db.exec(metadataSql))[1].rows;
  await db.exec(
    readFileSync(
      "supabase/migrations/20261027000001_fintin_inicial.sql",
      "utf8",
    ),
  );
  expect(await snapshot()).toEqual(before);
  expect((await db.exec(metadataSql))[1].rows).toEqual(signaturesBefore);
  await db.exec(`SET request.jwt.claim.sub='${uid}'; SET ROLE authenticated;`);
  expect(
    (await db.query("SELECT * FROM public.tracktin_media")).rows,
  ).toHaveLength(1);
  await db.exec(`UPDATE public.tracktin_user_preferences SET theme='light'`);
  expect(
    (await db.query("SELECT theme FROM public.tracktin_user_preferences")).rows,
  ).toEqual([{ theme: "light" }]);
  // Reutilizar Auth no concede acceso a FinTin.
  expect(
    (await db.query("SELECT public.fintin_usuario_habilitado() ok")).rows,
  ).toEqual([{ ok: false }]);
  expect((await db.query("SELECT * FROM public.fintin_cuentas")).rows).toEqual(
    [],
  );
}, 30000);
