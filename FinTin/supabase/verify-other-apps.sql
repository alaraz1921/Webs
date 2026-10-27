-- Ejecutar ANTES y DESPUÉS de la migración. Solo metadatos, sin filas de usuario.
-- Las firmas deben coincidir. Excluye exclusivamente los objetos nuevos de FinTin.
BEGIN READ ONLY;
SELECT
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY n.nspname,c.relname)::text,'[]'))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','auth','storage') AND NOT(n.nspname='public' AND left(c.relname,7)='fintin_')) AS firma_relaciones,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) ORDER BY schemaname,tablename,policyname)::text,'[]'))
  FROM pg_policies WHERE schemaname IN ('public','auth','storage') AND NOT(schemaname='public' AND left(tablename,7)='fintin_')) AS firma_politicas,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prosrc) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))::text,'[]'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','auth','storage') AND NOT(n.nspname='public' AND left(p.proname,7)='fintin_')) AS firma_funciones,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,a.attacl) ORDER BY n.nspname,c.relname,a.attnum)::text,'[]'))
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE a.attnum>0 AND NOT a.attisdropped AND n.nspname IN ('public','auth','storage')
    AND NOT(n.nspname='public' AND left(c.relname,7)='fintin_')) AS firma_permisos_columnas,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(nspname,nspowner,nspacl) ORDER BY nspname)::text,'[]'))
  FROM pg_namespace WHERE nspname IN ('public','auth','storage')) AS firma_esquemas,
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(defaclrole,defaclnamespace,defaclobjtype,defaclacl) ORDER BY defaclrole,defaclnamespace,defaclobjtype)::text,'[]'))
  FROM pg_default_acl) AS firma_permisos_por_defecto;
COMMIT;
