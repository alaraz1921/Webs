BEGIN;

ALTER TABLE public.fintin_financiaciones
  ADD COLUMN fecha_inicio date,
  ADD COLUMN fecha_fin date,
  ADD CONSTRAINT fintin_financiacion_fechas_en_orden
    CHECK (fecha_fin >= fecha_inicio);

ALTER TABLE public.fintin_depositos
  ADD COLUMN importe_liquidacion numeric(18,2),
  ADD CONSTRAINT fintin_deposito_liquidacion_valida
    CHECK (importe_liquidacion >= 0 AND importe_liquidacion < 10000000000000000);

NOTIFY pgrst, 'reload schema';
COMMIT;
