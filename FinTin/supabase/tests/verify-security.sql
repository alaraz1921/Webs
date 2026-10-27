-- Diagnóstico de solo lectura para un administrador en Supabase de pruebas.
-- No consulta movimientos ni credenciales. Debe devolver ocho tablas con rls=true,
-- anon_select=false y las tres vistas security_invoker=true.
SELECT c.relname, c.relrowsecurity AS rls,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname LIKE 'fintin_%' AND c.relkind='r'
ORDER BY c.relname;
SELECT c.relname, c.reloptions FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname LIKE 'fintin_v_%';
SELECT p.proname, p.prosecdef AS security_definer, n.nspname
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname LIKE 'fintin_%' ORDER BY n.nspname,p.proname;
SELECT has_table_privilege('authenticated','public.fintin_usuarios_autorizados','INSERT') AS debe_ser_false;
-- Comprobar también manualmente que fintin_private no aparece en Data API / Exposed schemas.
