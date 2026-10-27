BEGIN READ ONLY;
SELECT 'tablas_fintin' AS comprobacion, count(*)::text AS resultado, '8' AS esperado
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND left(c.relname,7)='fintin_' AND c.relkind='r'
UNION ALL
SELECT 'tablas_con_rls',count(*)::text,'8' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND left(c.relname,7)='fintin_' AND c.relkind='r' AND c.relrowsecurity
UNION ALL
SELECT 'tablas_accesibles_anon',count(*)::text,'0' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND left(c.relname,7)='fintin_' AND c.relkind IN ('r','v')
AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE'))
UNION ALL
SELECT 'vistas_security_invoker',count(*)::text,'3' FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND left(c.relname,9)='fintin_v_' AND c.relkind='v' AND 'security_invoker=true'=ANY(c.reloptions)
UNION ALL
SELECT 'definers_en_public',count(*)::text,'0' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND left(p.proname,7)='fintin_' AND p.prosecdef
UNION ALL
SELECT 'funciones_fintin_ejecutables_anon',count(*)::text,'0' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE ((n.nspname='public' AND left(p.proname,7)='fintin_') OR n.nspname='fintin_private') AND has_function_privilege('anon',p.oid,'EXECUTE')
UNION ALL
SELECT 'autorizaciones_editables_authenticated',has_table_privilege('authenticated','public.fintin_usuarios_autorizados','INSERT,UPDATE,DELETE')::int::text,'0'
UNION ALL
SELECT 'lotes_editables_authenticated',has_table_privilege('authenticated','public.fintin_importaciones','UPDATE,DELETE')::int::text,'0'
UNION ALL
SELECT 'staging_editable_authenticated',(has_table_privilege('authenticated','public.fintin_importacion_filas','UPDATE,DELETE') OR has_any_column_privilege('authenticated','public.fintin_importacion_filas','UPDATE'))::int::text,'0'
UNION ALL
SELECT 'usuarios_autorizados',count(*)::text,'0' FROM public.fintin_usuarios_autorizados
UNION ALL
SELECT 'movimientos_iniciales',count(*)::text,'0' FROM public.fintin_movimientos
ORDER BY comprobacion;
COMMIT;
