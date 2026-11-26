BEGIN;

CREATE TABLE public.fintin_depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  titular text NOT NULL CHECK (btrim(titular) <> ''),
  nombre text NOT NULL CHECK (btrim(nombre) <> ''),
  notas text NOT NULL DEFAULT '',
  fecha_apertura date NOT NULL,
  duracion_meses integer NOT NULL CHECK (duracion_meses BETWEEN 1 AND 1200),
  interes numeric(5,2) NOT NULL CHECK (interes BETWEEN 0 AND 100),
  retencion numeric(5,2) NOT NULL CHECK (retencion BETWEEN 0 AND 100),
  aportacion numeric(18,2) NOT NULL CHECK (aportacion > 0)
);

CREATE TABLE public.fintin_financiaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  nombre text NOT NULL CHECK (btrim(nombre) <> ''),
  notas text NOT NULL DEFAULT '',
  importe_compra numeric(18,2) NOT NULL CHECK (importe_compra > 0),
  total_cuotas integer NOT NULL CHECK (total_cuotas > 0),
  UNIQUE (user_id, id)
);

CREATE TABLE public.fintin_financiacion_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  financiacion_id uuid NOT NULL,
  fecha date NOT NULL,
  importe numeric(18,2) NOT NULL CHECK (importe > 0),
  nota text NOT NULL DEFAULT '',
  FOREIGN KEY (user_id, financiacion_id)
    REFERENCES public.fintin_financiaciones(user_id, id)
);

CREATE INDEX ON public.fintin_depositos (user_id, id);
CREATE INDEX ON public.fintin_financiacion_pagos (user_id, financiacion_id);

ALTER TABLE public.fintin_depositos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fintin_depositos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintin_depositos TO authenticated;
CREATE POLICY acceso_propio ON public.fintin_depositos FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

ALTER TABLE public.fintin_financiaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fintin_financiaciones FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintin_financiaciones TO authenticated;
CREATE POLICY acceso_propio ON public.fintin_financiaciones FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

ALTER TABLE public.fintin_financiacion_pagos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fintin_financiacion_pagos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintin_financiacion_pagos TO authenticated;
CREATE POLICY acceso_propio ON public.fintin_financiacion_pagos FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.fintin_usuario_habilitado()));

NOTIFY pgrst, 'reload schema';
COMMIT;
