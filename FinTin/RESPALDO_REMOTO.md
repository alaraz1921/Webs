# Respaldo remoto previo a FinTin

**Completado:** ejecución 40545055421 recuperada y verificada; migración aplicada después; secreto temporal eliminado. Informe: [MIGRACION_APLICADA.md](./MIGRACION_APLICADA.md).

Se prepara GitHub Actions en `alaraz1921/Webs`, manteniendo Supabase Free. El workflow es manual y exclusivamente de respaldo: no incluye migraciones, restauraciones, despliegues, escrituras SQL o cambios de permisos.

## Qué se ha preparado

- `.github/workflows/fintin-remote-backup.yml`: instalar en la misma ruta de la **raíz de Webs**. Es autocontenido; no hace checkout ni ejecuta código de otras aplicaciones.
- `scripts/remote-backup.mjs`: fuente del respaldo y herramientas locales de cifrado/recuperación, sin dependencias externas de Node.
- `prepare-remote-workflow.mjs`: regenera el workflow incorporando exclusivamente la clave pública y la fuente anterior.
- La imagen oficial PostgreSQL 17 y `upload-artifact` están fijados por digest/SHA.
- Solo se puede lanzar manualmente como `alaraz1921`, desde `main`, en el entorno `fintin-backup`.

## Credenciales y privacidad

El repositorio Webs es público. Por eso solo se sube un archivo **ya cifrado** con AES-256-GCM y clave aleatoria protegida con RSA-OAEP-SHA256. Los dumps sin cifrar permanecen en el espacio temporal del runner y se limpian al terminar. Ningún dump ni contraseña entra en Git, Pages o logs.

La clave privada está exclusivamente en:

`%LOCALAPPDATA%\FinTin\Backups\keys\backup-private.pem`

Conservar esa clave junto a una copia de seguridad local protegida. Sin ella no se puede recuperar el respaldo. **No subirla a GitHub, compartirla en el chat ni añadirla como secreto remoto.** La huella de la clave pública usada es:

`c57d2c41387a0f8da73b5c1b76d7130750d4a106d8faa970d2e8ebdd3b8d0e48`

La contraseña de PostgreSQL se introduce por el propietario directamente en GitHub como secreto de entorno `FINTIN_DB_PASSWORD`, dentro del entorno `fintin-backup`. No se usa una clave `service_role`, una clave secreta Supabase de API ni la contraseña de acceso al panel. El secreto debe limitarse a este respaldo y retirarse manualmente después de completarlo. No reutilizar ni modificar los secretos de las otras aplicaciones.

El cliente conecta al pooler oficial por TLS con comprobación del certificado (`verify-full`) y todas sus conexiones establecen `default_transaction_read_only=on`. El job no recibe una clave privada de descifrado ni ejecuta migraciones. La contraseña de PostgreSQL es administrativa: su uso en modo de lectura lo establece este código, por lo que el secreto remoto debe retirarse al terminar.

## Ejecución y recuperación

1. Instalar únicamente el workflow preparado en `.github/workflows/fintin-remote-backup.yml` de Webs. No publicar el frontend ni modificar los workflows existentes.
2. Crear el entorno `fintin-backup` en GitHub y añadir su secreto `FINTIN_DB_PASSWORD`. Es recomendable limitar sus ramas a `main` y exigir aprobación del propietario.
3. Lanzar «FinTin · Respaldo remoto cifrado (manual)» desde Actions.
4. El job confirma proyecto, versión, existencia de TrackTin y ausencia de objetos previos de FinTin; copia la base y los roles sin contraseñas; comprueba el índice y recorre/descomprime el archivo con `pg_restore` sin ejecutar su contenido. Si falla, no sube un respaldo incompleto y no migra.
5. Descargar el artefacto cifrado (retención: 7 días) a `%LOCALAPPDATA%\FinTin\Backups\remoto\<ejecucion>`. No guardarlo en el repositorio.
6. Descifrarlo localmente con Node:

```powershell
node scripts/remote-backup.mjs decrypt "RUTA\fintin-pre-migration.enc" "$env:LOCALAPPDATA\FinTin\Backups\keys\backup-private.pem" "RUTA\backup.tar"
```

7. Extraer `backup.tar` en esa misma carpeta privada. Comprobar SHA-256 y tamaños del manifiesto, proyecto, ejecución y huella. Repetir localmente `pg_restore --list` y la lectura completa de `database.dump` con las herramientas portátiles ya descargadas. No ejecutar los SQL en producción para verificarlos.
8. Con la copia recuperada y comprobada, realizar otra vez el preflight y las firmas de objetos ajenos; comprobar `fintin_private` fuera de Data API; aplicar la migración de FinTin autorizada y verificar tablas, RLS, grants y las firmas de las otras aplicaciones.

## Alcance y límites

El archivo incluye la base de datos completa (también Auth y metadatos Storage) y los roles sin sus contraseñas. Los archivos almacenados mediante Storage no se incluyen; la migración de FinTin no los modifica. Un dump de la base no sustituye la configuración externa del proyecto, Edge Functions ni sus secretos.

La verificación del respaldo comprueba su integridad y recuperación local de bytes, estructura y contenido del archivo. No equivale a un ensayo de restauración completa en un servidor Supabase. Una restauración futura debe planificarse respetando los objetos gestionados por Supabase y los permisos de sus roles; no restaurar a ciegas los esquemas internos sobre el proyecto definitivo.

Hasta obtener el artefacto remoto y comprobarlo no se da por creada ninguna copia ni se ejecuta la migración. La autorización de migración ya existe; no necesita repetirse.
