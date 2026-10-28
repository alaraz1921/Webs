-- Solo FinTin. No deduce ni modifica el origen de movimientos antiguos.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.fintin_movimientos
  ADD COLUMN entidad_csv text,
  ADD COLUMN nombre_producto_csv text,
  ADD COLUMN tipo_producto_csv text,
  ADD CONSTRAINT fintin_movimiento_origen_csv_completo CHECK (
    (entidad_csv IS NULL AND nombre_producto_csv IS NULL AND tipo_producto_csv IS NULL)
    OR (entidad_csv IS NOT NULL AND length(btrim(entidad_csv)) > 0
      AND nombre_producto_csv IS NOT NULL AND length(btrim(nombre_producto_csv)) > 0
      AND tipo_producto_csv IS NOT NULL)
  );

CREATE FUNCTION fintin_private.fintin_capturar_origen_csv()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.origen = 'csv' THEN
    SELECT f.entidad_csv, f.nombre_producto_csv, f.tipo_producto_csv
      INTO NEW.entidad_csv, NEW.nombre_producto_csv, NEW.tipo_producto_csv
    FROM public.fintin_importacion_filas f
    WHERE f.user_id = NEW.user_id AND f.importacion_id = NEW.importacion_id
      AND f.numero_fila = NEW.numero_fila_csv;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se puede conservar el origen del CSV: falta la fila de preparación';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_capturar_origen_csv()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER fintin_movimientos_capturar_origen
  BEFORE INSERT ON public.fintin_movimientos
  FOR EACH ROW EXECUTE FUNCTION fintin_private.fintin_capturar_origen_csv();

-- RLS sigue impidiendo UPDATE de CSV desde el navegador. Solo este trigger
-- privado cambia cuenta_id, con propietario y autorización explícitos.
CREATE FUNCTION fintin_private.fintin_reasignar_alias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado para reasignar el alias';
  END IF;
  -- Mismo bloqueo que publicar_importacion: serializa ambos procesos.
  PERFORM 1 FROM public.fintin_usuarios_autorizados a
    WHERE a.user_id = NEW.user_id AND a.activo FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no autorizado en FinTin';
  END IF;
  UPDATE public.fintin_movimientos m SET cuenta_id = NEW.cuenta_id
    WHERE m.user_id = NEW.user_id AND m.cuenta_id IS DISTINCT FROM NEW.cuenta_id
      AND lower(btrim(m.entidad_csv)) = lower(btrim(NEW.entidad_csv))
      AND lower(btrim(m.nombre_producto_csv)) = lower(btrim(NEW.nombre_producto_csv))
      AND lower(btrim(m.tipo_producto_csv)) = lower(btrim(NEW.tipo_producto_csv));
  -- El trigger de integridad existente valida moneda, propietario y corte.
  -- Una incompatibilidad revierte también el alias; no hay cambios parciales.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_reasignar_alias()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER fintin_alias_reasignar_movimientos
  AFTER INSERT OR UPDATE ON public.fintin_cuenta_aliases
  FOR EACH ROW EXECUTE FUNCTION fintin_private.fintin_reasignar_alias();
CREATE INDEX fintin_movimientos_origen_csv
  ON public.fintin_movimientos(user_id, lower(btrim(entidad_csv)),
    lower(btrim(nombre_producto_csv)), lower(btrim(tipo_producto_csv)))
  WHERE entidad_csv IS NOT NULL;
-- Sin nuevos GRANT: los permisos de tabla existentes cubren estas columnas.
-- Sin cambios en RLS, Auth, funciones expuestas u otras aplicaciones.
NOTIFY pgrst, 'reload schema';
COMMIT;
