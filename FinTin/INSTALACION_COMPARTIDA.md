# Instalación en la base compartida con TrackTin

**Instalación realizada el 27/10/2026.** Consultar [MIGRACION_APLICADA.md](./MIGRACION_APLICADA.md). Este procedimiento queda como referencia; no volver a ejecutar la migración inicial.

Solo existe un proyecto Supabase: el definitivo que ya usa TrackTin. Se reutilizan su URL, clave pública y cuentas de Auth. Las pruebas de sustitución, rollback, usuarios ajenos y datos ficticios se ejecutan en PostgreSQL embebido local con `npm test`.

## Preparación, sin cambios remotos

1. Confirmar en el panel que se trata del proyecto que utiliza TrackTin. No compartir claves secretas ni contraseñas de PostgreSQL en el chat o frontend.
2. Disponer de una copia de seguridad recuperable del proyecto y su esquema, conservada fuera del repositorio.
3. Ejecutar `supabase/preflight.sql` en SQL Editor: es de solo lectura. Deben existir Auth, los tres roles y TrackTin. No debe haber objetos `fintin_*` ni el esquema `fintin_private` de una instalación previa. Si aparecen, revisar antes de continuar, sin borrar ni repetir la migración.
4. Comprobar que `fintin_private` no figura en Data API → Exposed schemas. Mantener las configuraciones de Auth y las demás aplicaciones.
5. Revisar `supabase/migrations/20261027000001_fintin_inicial.sql` y autorizar expresamente su ejecución. La aclaración de que esta es la base definitiva no constituye por sí sola autorización para modificarla.

## Instalación, una vez autorizada

1. Ejecutar únicamente la migración inicial de FinTin desde una cuenta administradora. Su bloque BEGIN/COMMIT es transaccional. No ejecutar el bootstrap local, `db reset`, scripts de TrackTin ni migraciones globales del repositorio.
2. Si falla, revisar el error y el estado de la transacción. No continuar con fragmentos sueltos, `DROP ... CASCADE` o cambios de privilegios globales. La migración inicial no es idempotente.
3. Ejecutar `supabase/tests/verify-security.sql` (solo lectura). Comprobar ocho tablas con RLS, sin SELECT para anon; tres vistas invocadoras y funciones privilegiadas únicamente en el esquema privado.
4. Autorizar exclusivamente el UUID de la cuenta existente que deba gestionar FinTin:

```sql
INSERT INTO public.fintin_usuarios_autorizados (user_id, activo)
VALUES ('REEMPLAZAR_POR_UUID_EXISTENTE_EN_AUTH'::uuid, true)
ON CONFLICT (user_id) DO UPDATE SET activo = EXCLUDED.activo;
```

No se crean usuarios ni se modifican `app_projects`, `project_members`, los administradores o los permisos de TrackTin. La autorización de FinTin es independiente.

## Comprobaciones posteriores

- Iniciar sesión en FinTin con la cuenta autorizada; el espacio estará vacío hasta introducir sus cuentas y movimientos.
- Comprobar el rechazo de una cuenta existente sin autorización, si está disponible; no crear cuentas ficticias en el Auth compartido.
- Comprobar que TrackTin sigue iniciando sesión y consultando sus listas habituales. No alterar sus registros para probar FinTin.
- Crear las cuentas de FinTin con fecha/saldo inicial correctos, definir sus alias y revisar los CSV antes de confirmar la importación. Los fixtures se reservan para pruebas locales.
- Las verificaciones de PostgREST, Auth y concurrencia real permanecen pendientes hasta esta instalación. Los tests locales no certifican por sí solos la configuración del servicio definitivo.

La configuración local puede reutilizar la URL y la clave pública de `TrackTin/js/config.js`. `.env.local` permanece ignorado por Git. No se ha hecho ninguna petición a Supabase ni se han ejecutado cambios remotos al preparar estos archivos.
