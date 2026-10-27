# FinTin — Diseño definitivo y arranque

## Qué contiene este paquete

- `20261027_000001_fintin_inicial.sql`: migración SQL completa (tablas, claves, políticas RLS, permisos explícitos, importador transaccional y 3 vistas).
- `PROMPT_CODEX_FINTIN.md`: instrucciones para Codex, configuradas con la ruta `V:\Proyectos\Git\Webs\FinTin`.

## Decisiones confirmadas

- Proyecto web **FinTin**: React + TypeScript + Vite, GitHub Pages y Supabase compartido.
- Prefijo SQL obligatorio: `fintin_`, más un esquema de funciones privado `fintin_private` que **no se expondrá en Data API**.
- Otros usuarios de otros proyectos no pueden consultar FinTin. Acceso por `fintin_usuarios_autorizados` y propiedad `user_id` protegida con RLS.
- `anon`: sin privilegios sobre tablas de FinTin; `authenticated`: grants mínimos y políticas RLS; funciones de publicación privilegiadas aisladas del API.
- Las importaciones CSV reemplazan *solo* movimientos CSV del año de `fecha_valor`; los manuales se conservan y los CSV no se editan en la web.
- Alias de cuenta explícitos basados en Entidad, Nombre de producto y Tipo de producto, sin fusionar productos de nombres ambiguos.
- El año importado debe coincidir exactamente con las fechas valor de todas sus filas. Si el CSV mezcla años, separar por ejercicio antes de importar.
- Saldo calculado = saldo inicial a la fecha de corte + movimientos de esa cuenta posteriores al corte; moneda sin conversiones implícitas; no computables afectan al saldo pero no al resultado de ingresos/gastos.

## Relación de tablas

```text
auth.users
  └─ fintin_usuarios_autorizados (alta manual administrador)
  └─ fintin_cuentas (user_id)
       ├─ fintin_cuenta_aliases (CSV → cuenta)
       ├─ fintin_movimientos (csv + manual)
       └─ fintin_saldos (cierres reales)
  └─ fintin_categorias ← fintin_movimientos
  └─ fintin_importaciones (ejercicio, estado, metadatos)
       ├─ fintin_importacion_filas (solo staging mientras carga)
       └─ fintin_movimientos (solo origen csv)
```

Las referencias a cuentas/categorías/importaciones incluyen el propietario `user_id`, lo que impide referenciar recursos de otro usuario. Cada tabla con información financiera tiene RLS habilitado.

## Proceso previo a producción

1. Guardar copia de seguridad de Supabase y comprobar que `fintin_private` NO está en Settings → Data API → Exposed schemas.
2. Revisar y probar la migración SQL en un Supabase de prueba (Codex debe hacerlo cuando disponga de entorno). No se ha ejecutado en tu Supabase real desde este chat.
3. Autorizar tu `user_id` real (buscarlo en Authentication → Users) desde SQL Editor **después** de migrar:

```sql
INSERT INTO public.fintin_usuarios_autorizados (user_id, activo)
VALUES ('TU-UUID-REAL-DE-SUPABASE-AUTH'::uuid, true)
ON CONFLICT (user_id) DO UPDATE SET activo = EXCLUDED.activo;
```

4. Crear cuentas y definir `saldo_inicial` y `fecha_saldo_inicial` (por ejemplo, cierre a 31/12/2025 si se importará 2026).
5. Crear los alias de Entidad + Nombre de producto + Tipo de producto hacia la cuenta concreta.
6. Verificar permisos RLS con dos usuarios de prueba (propietario y usuario de visualización de otro proyecto).
7. Configurar las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (o clave `anon` pública legacy) en el frontend. Prohibido usar `service_role` desde navegador.
8. Importar CSV anual de prueba y contrastar totales y saldos contra las hojas de Google Sheets.
9. Publicar en GitHub Pages tras revisar que no hay datos privados o `.env` en Git.

## Supabase y los GRANTs del 30 de octubre de 2026

En 2026 Supabase anunció que, desde el **30/10/2026**, las nuevas tablas de `public` no tendrán acceso automático a Data API en proyectos existentes. La migración **retira cualquier permiso automático en los objetos nuevos** y concede permisos explícitos a `authenticated` para las operaciones indispensables. No concede SELECT a `anon` ni modifica privilegios por defecto de otros proyectos. Referencia: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Ruta local

Estos archivos adjuntos están en un entorno de archivos de esta conversación, no en tu unidad de Windows. Descárgalos o extrae el ZIP dentro de `V:\Proyectos\Git\Webs\FinTin`; Codex ejecutado en tu equipo deberá trabajar directamente allí. No es posible escribir directamente en `V:` desde este chat.
