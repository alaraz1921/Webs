-- Solo lectura. Deben resultar true las cuatro comprobaciones.
SELECT
  (SELECT count(*) = 3 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fintin_movimientos'
      AND column_name IN ('entidad_csv', 'nombre_producto_csv', 'tipo_producto_csv')) AS columnas_ok,
  (SELECT count(*) = 2 FROM pg_trigger
    WHERE tgname IN ('fintin_movimientos_capturar_origen', 'fintin_alias_reasignar_movimientos')
      AND NOT tgisinternal AND tgenabled = 'O') AS triggers_ok,
  NOT has_function_privilege('authenticated', 'fintin_private.fintin_reasignar_alias()', 'EXECUTE') AS funcion_privada,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.fintin_movimientos'::regclass) AS rls_activo;
