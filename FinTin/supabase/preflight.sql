-- Solo lectura. Ejecutar antes de autorizar la migración en el proyecto compartido.
BEGIN READ ONLY;
SELECT current_database() AS base_actual, current_user AS ejecutor,
       to_regclass('auth.users') IS NOT NULL AS auth_users_existe,
       to_regprocedure('auth.uid()') IS NOT NULL AS auth_uid_existe,
       to_regclass('public.tracktin_media') IS NOT NULL AS tracktin_presente;
SELECT rolname FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname;
-- Debe devolver CERO filas para una instalación inicial. Si existen objetos,
-- detenerse y revisar la instalación previa; no borrarlos ni repetir la migración.
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND left(c.relname,7)='fintin_';
SELECT n.nspname,p.proname FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND left(p.proname,7)='fintin_')
   OR n.nspname='fintin_private';
SELECT nspname AS esquema_preexistente FROM pg_namespace WHERE nspname='fintin_private';
COMMIT;
