-- FinTin: migración inicial para Supabase existente (PostgreSQL 15+).
-- Ejecutar desde un usuario administrador / Supabase SQL Editor, tras hacer copia de seguridad.
-- IMPORTANTE: solamente crea objetos fintin_* y el esquema NO EXPUESTO fintin_private.
-- No modifica privilegios generales de public, otros proyectos ni auth.users.
-- PostgreSQL ejecuta todo lo comprendido entre BEGIN y COMMIT de forma atómica.
BEGIN;

CREATE SCHEMA IF NOT EXISTS fintin_private;
REVOKE ALL ON SCHEMA fintin_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA fintin_private TO authenticated;

-- 1. LISTA CERRADA: solamente el administrador SQL puede autorizar usuarios.
CREATE TABLE public.fintin_usuarios_autorizados (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fintin_usuarios_autorizados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fintin_usuarios_autorizados FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.fintin_usuarios_autorizados TO authenticated;
CREATE POLICY fintin_autorizacion_lectura_propia
    ON public.fintin_usuarios_autorizados FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Invoker: no salta RLS; la propia fila de autorización se puede consultar.
CREATE FUNCTION public.fintin_usuario_habilitado()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT a.activo FROM public.fintin_usuarios_autorizados a
     WHERE a.user_id = (SELECT auth.uid())),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.fintin_usuario_habilitado() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fintin_usuario_habilitado() TO authenticated;

-- 2. CUENTAS Y ALIAS DE IMPORTACIÓN.
CREATE TABLE public.fintin_cuentas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    entidad text NOT NULL CHECK (length(btrim(entidad)) > 0),
    nombre_producto text NOT NULL CHECK (length(btrim(nombre_producto)) > 0),
    tipo_producto text NOT NULL DEFAULT '',
    moneda text NOT NULL DEFAULT 'EUR' CHECK (moneda ~ '^[A-Z]{3}$'),
    saldo_inicial numeric(18,2) NOT NULL,
    fecha_saldo_inicial date NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id)
);

-- Evita mezclar cuentas ante cambios cosméticos de nombre en el CSV.
CREATE TABLE public.fintin_cuenta_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    cuenta_id uuid NOT NULL,
    entidad_csv text NOT NULL CHECK (length(btrim(entidad_csv)) > 0),
    nombre_producto_csv text NOT NULL CHECK (length(btrim(nombre_producto_csv)) > 0),
    tipo_producto_csv text NOT NULL DEFAULT '',
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (cuenta_id, user_id) REFERENCES public.fintin_cuentas(id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX fintin_alias_unico
    ON public.fintin_cuenta_aliases (user_id, lower(btrim(entidad_csv)),
      lower(btrim(nombre_producto_csv)), lower(btrim(tipo_producto_csv)));

-- 3. CATEGORÍAS Y TIPOS DE MOVIMIENTOS.
CREATE TABLE public.fintin_categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'gasto', 'no_computable')),
    nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    UNIQUE (id, user_id, tipo_movimiento)
);
CREATE UNIQUE INDEX fintin_categoria_unica
    ON public.fintin_categorias (user_id, tipo_movimiento, lower(btrim(nombre)));

-- 4. HISTORIAL DE IMPORTACIONES (lotes, no movimientos definitivos).
CREATE TABLE public.fintin_importaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    ejercicio integer NOT NULL CHECK (ejercicio BETWEEN 2000 AND 2100),
    nombre_archivo text NOT NULL CHECK (length(btrim(nombre_archivo)) > 0),
    sha256_archivo text CHECK (sha256_archivo IS NULL OR sha256_archivo ~ '^[0-9a-f]{64}$'),
    filas_esperadas integer NOT NULL CHECK (filas_esperadas BETWEEN 1 AND 200000),
    filas_importadas integer NOT NULL DEFAULT 0 CHECK (filas_importadas >= 0),
    estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aplicada','sustituida')),
    creado_en timestamptz NOT NULL DEFAULT now(),
    aplicado_en timestamptz,
    UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX fintin_importacion_activa_unica
    ON public.fintin_importaciones(user_id, ejercicio) WHERE estado = 'aplicada';
CREATE INDEX fintin_importaciones_usuario_ejercicio
    ON public.fintin_importaciones(user_id, ejercicio, creado_en DESC);

-- 5. FILAS DE CSV EN ZONA DE PREPARACIÓN.
-- numero_fila = 1,2,...,N (índice de la fila de datos, sin cabecera).
CREATE TABLE public.fintin_importacion_filas (
    importacion_id uuid NOT NULL,
    user_id uuid NOT NULL DEFAULT auth.uid(),
    numero_fila integer NOT NULL CHECK (numero_fila > 0),
    fecha_valor date NOT NULL,
    fecha_operacion date NOT NULL,
    importe numeric(18,2) NOT NULL,
    moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
    concepto text NOT NULL DEFAULT '',
    entidad_csv text NOT NULL CHECK (length(btrim(entidad_csv)) > 0),
    nombre_producto_csv text NOT NULL CHECK (length(btrim(nombre_producto_csv)) > 0),
    tipo_producto_csv text NOT NULL DEFAULT '',
    tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('ingreso','gasto','no_computable')),
    categoria_csv text NOT NULL DEFAULT '',
    nota text NOT NULL DEFAULT '',
    PRIMARY KEY (importacion_id, numero_fila),
    FOREIGN KEY (importacion_id, user_id)
        REFERENCES public.fintin_importaciones(id, user_id) ON DELETE CASCADE
);
CREATE INDEX fintin_filas_user_id ON public.fintin_importacion_filas(user_id);

-- 6. TODOS LOS MOVIMIENTOS (CSV + MANUALES).
CREATE TABLE public.fintin_movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    origen text NOT NULL CHECK (origen IN ('csv','manual')),
    importacion_id uuid,
    numero_fila_csv integer,
    fecha_valor date NOT NULL,
    fecha_operacion date NOT NULL,
    importe numeric(18,2) NOT NULL,
    moneda text NOT NULL CHECK (moneda ~ '^[A-Z]{3}$'),
    concepto text NOT NULL DEFAULT '',
    cuenta_id uuid NOT NULL,
    tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('ingreso','gasto','no_computable')),
    categoria_id uuid,
    categoria_csv text NOT NULL DEFAULT '',
    nota text NOT NULL DEFAULT '',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (cuenta_id, user_id) REFERENCES public.fintin_cuentas(id, user_id),
    FOREIGN KEY (categoria_id, user_id, tipo_movimiento)
      REFERENCES public.fintin_categorias(id, user_id, tipo_movimiento),
    FOREIGN KEY (importacion_id, user_id)
      REFERENCES public.fintin_importaciones(id, user_id),
    CONSTRAINT fintin_origen_consistente CHECK (
      (origen = 'manual' AND importacion_id IS NULL AND numero_fila_csv IS NULL)
      OR
      (origen = 'csv' AND importacion_id IS NOT NULL AND numero_fila_csv IS NOT NULL)
    )
);
CREATE UNIQUE INDEX fintin_csv_fila_unica
    ON public.fintin_movimientos(importacion_id, numero_fila_csv) WHERE origen='csv';
CREATE INDEX fintin_movimientos_user_fecha
    ON public.fintin_movimientos(user_id, fecha_valor);
CREATE INDEX fintin_movimientos_user_cuenta_fecha
    ON public.fintin_movimientos(user_id, cuenta_id, fecha_valor);
CREATE INDEX fintin_movimientos_user_tipo_categoria_fecha
    ON public.fintin_movimientos(user_id, tipo_movimiento, categoria_id, fecha_valor);

-- 7. SALDOS DE ENTIDAD ANOTADOS A MANO.
CREATE TABLE public.fintin_saldos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    cuenta_id uuid NOT NULL,
    fecha_corte date NOT NULL,
    saldo_real numeric(18,2) NOT NULL,
    nota text NOT NULL DEFAULT '',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    UNIQUE (user_id, cuenta_id, fecha_corte),
    FOREIGN KEY (cuenta_id, user_id) REFERENCES public.fintin_cuentas(id, user_id)
);
CREATE INDEX fintin_saldos_user_fecha ON public.fintin_saldos(user_id, fecha_corte);

-- 8. RLS: habilitar en TODAS las tablas de datos.
ALTER TABLE public.fintin_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_cuenta_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_importaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_importacion_filas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fintin_saldos ENABLE ROW LEVEL SECURITY;

-- 9. GRANTS EXPLÍCITOS (necesarios también desde el 30-10-2026).
-- Revocar cualquier acceso por defecto anterior, sin tocar otras aplicaciones.
REVOKE ALL ON TABLE
  public.fintin_cuentas, public.fintin_cuenta_aliases,
  public.fintin_categorias, public.fintin_importaciones,
  public.fintin_importacion_filas, public.fintin_movimientos,
  public.fintin_saldos
FROM PUBLIC, anon, authenticated, service_role;

-- Sólo usuarios autenticados y sujetos a RLS. anon y service_role no se usan desde FinTin.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.fintin_cuentas, public.fintin_cuenta_aliases,
  public.fintin_categorias, public.fintin_movimientos,
  public.fintin_saldos
TO authenticated;
GRANT SELECT ON TABLE public.fintin_importaciones TO authenticated;
GRANT INSERT (user_id, ejercicio, nombre_archivo, sha256_archivo, filas_esperadas)
  ON TABLE public.fintin_importaciones TO authenticated;
GRANT SELECT ON TABLE public.fintin_importacion_filas TO authenticated;
GRANT INSERT (
  importacion_id, user_id, numero_fila, fecha_valor, fecha_operacion,
  importe, moneda, concepto, entidad_csv, nombre_producto_csv,
  tipo_producto_csv, tipo_movimiento, categoria_csv, nota
) ON TABLE public.fintin_importacion_filas TO authenticated;

-- 10. POLÍTICAS. Cada tabla exige pertenencia ACTIVA y coincidencia de user_id.
CREATE POLICY fintin_cuentas_select ON public.fintin_cuentas FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_cuentas_insert ON public.fintin_cuentas FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_cuentas_update ON public.fintin_cuentas FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_cuentas_delete ON public.fintin_cuentas FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

CREATE POLICY fintin_alias_select ON public.fintin_cuenta_aliases FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_alias_insert ON public.fintin_cuenta_aliases FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_alias_update ON public.fintin_cuenta_aliases FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_alias_delete ON public.fintin_cuenta_aliases FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

CREATE POLICY fintin_categorias_select ON public.fintin_categorias FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_categorias_insert ON public.fintin_categorias FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_categorias_update ON public.fintin_categorias FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_categorias_delete ON public.fintin_categorias FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

CREATE POLICY fintin_importaciones_select ON public.fintin_importaciones FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_importaciones_insert ON public.fintin_importaciones FOR INSERT TO authenticated
    WITH CHECK (
      user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado())
      AND estado = 'pendiente' AND filas_importadas = 0 AND aplicado_en IS NULL
    );
CREATE POLICY fintin_filas_select ON public.fintin_importacion_filas FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_filas_insert ON public.fintin_importacion_filas FOR INSERT TO authenticated
    WITH CHECK (
      user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado())
      AND EXISTS (
        SELECT 1 FROM public.fintin_importaciones i
        WHERE i.id = importacion_id AND i.user_id = public.fintin_importacion_filas.user_id AND i.estado = 'pendiente'
      )
    );

CREATE POLICY fintin_movimientos_select ON public.fintin_movimientos FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
-- El navegador NUNCA puede crear, editar o borrar movimientos CSV.
CREATE POLICY fintin_movimientos_insert_manual ON public.fintin_movimientos FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()) AND origen = 'manual');
CREATE POLICY fintin_movimientos_update_manual ON public.fintin_movimientos FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()) AND origen = 'manual')
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()) AND origen = 'manual');
CREATE POLICY fintin_movimientos_delete_manual ON public.fintin_movimientos FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()) AND origen = 'manual');

CREATE POLICY fintin_saldos_select ON public.fintin_saldos FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_saldos_insert ON public.fintin_saldos FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_saldos_update ON public.fintin_saldos FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));
CREATE POLICY fintin_saldos_delete ON public.fintin_saldos FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

-- 10b. INTEGRIDAD DE SALDOS: impide importes en moneda equivocada y
-- movimientos anteriores a la fecha usada como saldo de partida.
CREATE FUNCTION fintin_private.fintin_validar_movimiento()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_moneda text; v_fecha_inicial date;
BEGIN
    SELECT c.moneda, c.fecha_saldo_inicial INTO v_moneda, v_fecha_inicial
    FROM public.fintin_cuentas c
    WHERE c.id=NEW.cuenta_id AND c.user_id=NEW.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no existe o no pertenece al usuario';
    END IF;
    IF NEW.moneda <> v_moneda THEN
        RAISE EXCEPTION 'La moneda del movimiento no coincide con la de la cuenta';
    END IF;
    IF NEW.fecha_valor <= v_fecha_inicial THEN
        RAISE EXCEPTION 'La fecha valor debe ser posterior al saldo inicial de la cuenta';
    END IF;
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_validar_movimiento() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER fintin_movimientos_integridad
  BEFORE INSERT OR UPDATE ON public.fintin_movimientos
  FOR EACH ROW EXECUTE FUNCTION fintin_private.fintin_validar_movimiento();

CREATE FUNCTION fintin_private.fintin_validar_cuenta_inicio()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fintin_movimientos m
    WHERE m.user_id=NEW.user_id AND m.cuenta_id=NEW.id
      AND (m.fecha_valor <= NEW.fecha_saldo_inicial OR m.moneda <> NEW.moneda)
  ) THEN
    RAISE EXCEPTION 'El cambio de moneda o fecha inicial invalidaría movimientos existentes';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_validar_cuenta_inicio() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER fintin_cuentas_integridad
  BEFORE UPDATE OF moneda, fecha_saldo_inicial ON public.fintin_cuentas
  FOR EACH ROW EXECUTE FUNCTION fintin_private.fintin_validar_cuenta_inicio();

-- 11. SEGURIDAD DE STAGING: serializa INSERT con publicación del mismo lote.
CREATE FUNCTION fintin_private.fintin_validar_fila_staging()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_estado text;
BEGIN
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (
        SELECT 1 FROM public.fintin_usuarios_autorizados a
        WHERE a.user_id = auth.uid() AND a.activo
    ) THEN
        RAISE EXCEPTION 'No autorizado para preparar importaciones';
    END IF;
    SELECT i.estado INTO v_estado
    FROM public.fintin_importaciones i
    WHERE i.id=NEW.importacion_id AND i.user_id=NEW.user_id
    FOR UPDATE;
    IF NOT FOUND OR v_estado <> 'pendiente' THEN
        RAISE EXCEPTION 'La importación no está pendiente';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_validar_fila_staging() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER fintin_staging_solo_pendiente
  BEFORE INSERT ON public.fintin_importacion_filas
  FOR EACH ROW EXECUTE FUNCTION fintin_private.fintin_validar_fila_staging();

-- 12. PUBLICACIÓN ATÓMICA DE UN EJERCICIO. La implementación con privilegios
-- elevados queda FUERA de los esquemas expuestos en Data API.
CREATE FUNCTION fintin_private.fintin_publicar_importacion_impl(p_importacion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_ejercicio integer;
  v_estado text;
  v_esperadas integer;
  v_contadas integer;
  v_erroneas integer;
  v_anteriores integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Es necesario iniciar sesión';
  END IF;
  -- Serializa también dos lotes distintos publicados para el mismo usuario.
  PERFORM 1 FROM public.fintin_usuarios_autorizados a
    WHERE a.user_id = v_uid AND a.activo FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no autorizado en FinTin';
  END IF;

  SELECT i.ejercicio, i.estado, i.filas_esperadas
    INTO v_ejercicio, v_estado, v_esperadas
    FROM public.fintin_importaciones i
    WHERE i.id = p_importacion_id AND i.user_id = v_uid
    FOR UPDATE;
  IF NOT FOUND OR v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Lote inexistente, ajeno o ya publicado';
  END IF;

  SELECT count(*)::integer INTO v_contadas
    FROM public.fintin_importacion_filas f
    WHERE f.importacion_id = p_importacion_id AND f.user_id = v_uid;
  IF v_contadas <> v_esperadas THEN
    RAISE EXCEPTION 'CSV incompleto: esperadas %, recibidas %', v_esperadas, v_contadas;
  END IF;
  -- El ordinal es 1..N: no se publica accidentalmente un archivo parcial.
  SELECT count(*)::integer INTO v_erroneas
    FROM public.fintin_importacion_filas f
    WHERE f.importacion_id = p_importacion_id
      AND (f.numero_fila > v_esperadas OR EXTRACT(year FROM f.fecha_valor)::integer <> v_ejercicio);
  IF v_erroneas > 0 THEN
    RAISE EXCEPTION 'El CSV contiene filas fuera del ejercicio o de la numeración declarada';
  END IF;

  -- Exigir correspondencia UNÍVOCA con cuenta y misma moneda, además de
  -- movimientos posteriores al punto de partida del saldo inicial.
  SELECT count(*)::integer INTO v_erroneas
    FROM public.fintin_importacion_filas f
    LEFT JOIN public.fintin_cuenta_aliases a
      ON a.user_id = f.user_id
     AND lower(btrim(a.entidad_csv)) = lower(btrim(f.entidad_csv))
     AND lower(btrim(a.nombre_producto_csv)) = lower(btrim(f.nombre_producto_csv))
     AND lower(btrim(a.tipo_producto_csv)) = lower(btrim(f.tipo_producto_csv))
    LEFT JOIN public.fintin_cuentas c
      ON c.id = a.cuenta_id AND c.user_id = f.user_id
    WHERE f.importacion_id = p_importacion_id AND f.user_id=v_uid
      AND (a.id IS NULL OR c.id IS NULL OR c.moneda <> f.moneda
           OR f.fecha_valor <= c.fecha_saldo_inicial);
  IF v_erroneas > 0 THEN
    RAISE EXCEPTION '% filas sin cuenta asociada, moneda compatible o saldo inicial válido', v_erroneas;
  END IF;

  SELECT count(*)::integer INTO v_anteriores
    FROM public.fintin_movimientos m
    WHERE m.user_id=v_uid AND m.origen='csv'
      AND m.fecha_valor >= pg_catalog.make_date(v_ejercicio,1,1)
      AND m.fecha_valor < pg_catalog.make_date(v_ejercicio+1,1,1);

  -- Desde aquí todo se confirma o revierte en LA MISMA transacción del RPC.
  UPDATE public.fintin_importaciones i SET estado='sustituida'
    WHERE i.user_id=v_uid AND i.ejercicio=v_ejercicio AND i.estado='aplicada';
  DELETE FROM public.fintin_movimientos m
    WHERE m.user_id=v_uid AND m.origen='csv'
      AND m.fecha_valor >= pg_catalog.make_date(v_ejercicio,1,1)
      AND m.fecha_valor < pg_catalog.make_date(v_ejercicio+1,1,1);

  INSERT INTO public.fintin_categorias (user_id, tipo_movimiento, nombre)
    SELECT DISTINCT v_uid, f.tipo_movimiento, btrim(f.categoria_csv)
    FROM public.fintin_importacion_filas f
    WHERE f.importacion_id=p_importacion_id AND f.user_id=v_uid
      AND btrim(f.categoria_csv) <> ''
    ON CONFLICT DO NOTHING;

  INSERT INTO public.fintin_movimientos (
    user_id, origen, importacion_id, numero_fila_csv, fecha_valor,
    fecha_operacion, importe, moneda, concepto, cuenta_id,
    tipo_movimiento, categoria_id, categoria_csv, nota
  )
    SELECT
      v_uid, 'csv', p_importacion_id, f.numero_fila,
      f.fecha_valor, f.fecha_operacion, f.importe, f.moneda,
      f.concepto, a.cuenta_id, f.tipo_movimiento,
      cat.id, f.categoria_csv, f.nota
    FROM public.fintin_importacion_filas f
    JOIN public.fintin_cuenta_aliases a
      ON a.user_id = f.user_id
     AND lower(btrim(a.entidad_csv)) = lower(btrim(f.entidad_csv))
     AND lower(btrim(a.nombre_producto_csv)) = lower(btrim(f.nombre_producto_csv))
     AND lower(btrim(a.tipo_producto_csv)) = lower(btrim(f.tipo_producto_csv))
    LEFT JOIN public.fintin_categorias cat
      ON cat.user_id=v_uid AND cat.tipo_movimiento=f.tipo_movimiento
     AND lower(btrim(cat.nombre)) = lower(btrim(f.categoria_csv))
     AND btrim(f.categoria_csv) <> ''
    WHERE f.importacion_id=p_importacion_id AND f.user_id=v_uid;

  UPDATE public.fintin_importaciones
    SET estado='aplicada', filas_importadas=v_contadas, aplicado_en=now()
    WHERE id=p_importacion_id AND user_id=v_uid;

  -- Mantiene registro de importaciones sin duplicar indefinidamente los CSV.
  DELETE FROM public.fintin_importacion_filas
    WHERE importacion_id=p_importacion_id AND user_id=v_uid;

  RETURN pg_catalog.jsonb_build_object(
    'ejercicio',v_ejercicio,
    'anteriores_sustituidos',v_anteriores,
    'filas_importadas',v_contadas,
    'importacion_id',p_importacion_id
  );
END;
$$;
REVOKE ALL ON FUNCTION fintin_private.fintin_publicar_importacion_impl(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION fintin_private.fintin_publicar_importacion_impl(uuid) TO authenticated;

-- Wrapper RPC expuesto: SECURITY INVOKER; el definer permanece en esquema privado.
CREATE FUNCTION public.fintin_publicar_importacion(p_importacion_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT fintin_private.fintin_publicar_importacion_impl(p_importacion_id);
$$;
REVOKE ALL ON FUNCTION public.fintin_publicar_importacion(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fintin_publicar_importacion(uuid) TO authenticated;

-- 13. VISTAS DE RESUMEN RESPETANDO EL RLS DE LAS TABLAS SUBYACENTES.
CREATE VIEW public.fintin_v_resumen_categorias_mensual
WITH (security_invoker = true) AS
SELECT m.user_id,
       date_trunc('month',m.fecha_valor)::date AS mes,
       m.tipo_movimiento,
       m.categoria_id,
       COALESCE(c.nombre, NULLIF(btrim(m.categoria_csv),''),'Sin categoría') AS categoria,
       m.moneda,
       count(*)::bigint AS cantidad,
       sum(m.importe) AS total
FROM public.fintin_movimientos m
LEFT JOIN public.fintin_categorias c
  ON c.id=m.categoria_id AND c.user_id=m.user_id
GROUP BY m.user_id, date_trunc('month',m.fecha_valor)::date,
         m.tipo_movimiento, m.categoria_id,
         COALESCE(c.nombre, NULLIF(btrim(m.categoria_csv),''),'Sin categoría'), m.moneda;

CREATE VIEW public.fintin_v_resumen_cuentas_mensual
WITH (security_invoker = true) AS
SELECT m.user_id, m.cuenta_id,
       date_trunc('month',m.fecha_valor)::date AS mes,
       m.moneda, count(*)::bigint AS cantidad,
       sum(m.importe) AS total_movimientos
FROM public.fintin_movimientos m
GROUP BY m.user_id, m.cuenta_id, date_trunc('month',m.fecha_valor)::date, m.moneda;

-- La tabla de conciliación incluye meses sin movimientos. Se calcula desde
-- fecha_saldo_inicial (saldo al CIERRE de ese día), hasta el mes en curso.
CREATE VIEW public.fintin_v_conciliacion_mensual
WITH (security_invoker = true) AS
SELECT c.user_id, c.id AS cuenta_id, c.entidad, c.nombre_producto, c.moneda,
       (g.mes + interval '1 month' - interval '1 day')::date AS fecha_cierre,
       c.saldo_inicial + COALESCE((
         SELECT sum(m.importe)
         FROM public.fintin_movimientos m
         WHERE m.user_id=c.user_id AND m.cuenta_id=c.id
           AND m.moneda=c.moneda
           AND m.fecha_valor > c.fecha_saldo_inicial
           AND m.fecha_valor <= (g.mes + interval '1 month' - interval '1 day')::date
       ),0) AS saldo_calculado,
       s.saldo_real,
       CASE WHEN s.id IS NULL THEN NULL
            ELSE s.saldo_real - (
              c.saldo_inicial + COALESCE((
                SELECT sum(m.importe)
                FROM public.fintin_movimientos m
                WHERE m.user_id=c.user_id AND m.cuenta_id=c.id
                  AND m.moneda=c.moneda
                  AND m.fecha_valor > c.fecha_saldo_inicial
                  AND m.fecha_valor <= (g.mes + interval '1 month' - interval '1 day')::date
              ),0)
            )
       END AS diferencia
FROM public.fintin_cuentas c
CROSS JOIN LATERAL generate_series(
    date_trunc('month', (c.fecha_saldo_inicial + 1)::timestamp),
    date_trunc('month', (now() AT TIME ZONE 'Atlantic/Canary')),
    interval '1 month'
) AS g(mes)
LEFT JOIN public.fintin_saldos s
  ON s.user_id=c.user_id AND s.cuenta_id=c.id
 AND s.fecha_corte=(g.mes + interval '1 month' - interval '1 day')::date;

REVOKE ALL ON TABLE
  public.fintin_v_resumen_categorias_mensual,
  public.fintin_v_resumen_cuentas_mensual,
  public.fintin_v_conciliacion_mensual
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.fintin_v_resumen_categorias_mensual,
  public.fintin_v_resumen_cuentas_mensual,
  public.fintin_v_conciliacion_mensual
TO authenticated;

COMMIT;

-- POST-MIGRACIÓN: añadir manualmente el usuario AUTORIZADO existente de Supabase Auth.
-- Ejecutar SOLO cuando sustituyas el UUID de ejemplo:
-- INSERT INTO public.fintin_usuarios_autorizados (user_id, activo)
-- VALUES ('REEMPLAZAR_POR_UUID_DE_AUTH_USERS'::uuid, true)
-- ON CONFLICT (user_id) DO UPDATE SET activo=EXCLUDED.activo;
--
-- NO publicar este fichero con credenciales de Supabase. No introducir claves secretas.
