# FinTin: migración aplicada y respaldo verificado

Fecha: 27/10/2026. Proyecto Supabase: `nxuqkvuvmllqihaefjky`, compartido con TrackTin. Se mantiene el plan Free.

## Resultado

La migración `supabase/migrations/20261027000001_fintin_inicial.sql` se ha ejecutado realmente en SQL Editor, en una transacción. Supabase ha confirmado **Success. No rows returned**. Se conserva exactamente el SQL original, SHA-256:

`22ae20fba9e2828c9c6d1b7c416d4c296a1e4d376cf7cd9a0939875f3be0b2ce`

No repetir esta migración inicial: no es idempotente. La ejecución ha sido manual; no se ha registrado ni conciliado su historial mediante Supabase CLI. Antes de un futuro `db push`, revisar ese historial para evitar intentar crear de nuevo sus objetos. No ejecutar `db reset` en este proyecto.

## Copia previa

[GitHub Actions: ejecución correcta 40545055421](https://github.com/alaraz1921/Webs/actions/runs/40545055421).

Se ejecutó el respaldo con conexiones de solo lectura y TLS `verify-full`, usando el certificado público oficial de Supabase. El dump de la base y los roles sin contraseñas se comprobaron con `pg_restore`, se empaquetaron y se cifraron antes de subir el artefacto. El propietario autorizó expresamente la publicación del workflow y la transferencia del respaldo completo cifrado a ese repositorio público durante siete días.

- Artefacto: `fintin-pre-migration-40545055421`.
- SHA-256 del ZIP descargado: `b8e7779c1dd4507e85ef76594a47583f998866c89e24c4ffe815cd665fb3b4c1`.
- SHA-256 del contenido cifrado: `7edeb02114c92f153f83e413ebd67e4d7542185e8b8194aaa698fac5852a3d66`.
- Caducidad del artefacto remoto: 03/11/2026. La copia local no depende de esa retención.

Copia local recuperada y verificada, fuera del repositorio:

`C:\Users\vjimenez\AppData\Local\FinTin\Backups\remoto\40545055421-2026-10-27T16-54-55-693Z`

Contiene `database.dump` (676.977 bytes), `roles-sin-passwords.sql` (5.526 bytes), manifiesto, verificación local y firmas anteriores/posteriores. Se comprobaron el hash del ZIP, el descifrado autenticado, el SHA-256 y tamaño de ambos archivos, la identidad del proyecto/ejecución, el índice y la lectura/descompresión completa con `pg_restore` local. No se ensayó una restauración completa en otro servidor.

La clave privada de recuperación está únicamente en:

`C:\Users\vjimenez\AppData\Local\FinTin\Backups\keys\backup-private.pem`

Conservarla protegida: no se subió a GitHub ni está en el repositorio. El respaldo incluye la base y los roles sin sus contraseñas; no incluye archivos de Storage, Edge Functions ni secretos/configuración externos del proyecto. Una restauración futura debe planificarse teniendo en cuenta los objetos gestionados por Supabase.

## Protección de otras aplicaciones

Antes y después se compararon las mismas seis firmas de metadatos de objetos existentes en `public`, `auth` y `storage`, excluyendo los objetos nuevos de FinTin. **Coinciden las seis**:

| Comprobación                        | Firma anterior = posterior         |
| ----------------------------------- | ---------------------------------- |
| Esquemas y ACL                      | `001134f08006927628901e92d967abe9` |
| Funciones, definiciones y permisos  | `171407f9be50cf9c5fec7b0a9878a73c` |
| Permisos de columnas                | `557e71209d83340b8fdbe13cf91e9f75` |
| Privilegios por defecto             | `ab84fa3591ef537eb3ef53d99bd3e697` |
| Políticas RLS                       | `d27847224c2cdfa34f6bb40d623f2322` |
| Relaciones, propietarios, ACL y RLS | `ee9428ae1fc476616eb51e71f60d4fe4` |

No se ejecutaron escrituras de datos sobre tablas de TrackTin u otras aplicaciones. No se modificaron sus usuarios, políticas, permisos, contraseña, restricciones de red ni configuración Auth. Las firmas anteriores verifican los metadatos y permisos; no equivalen a una comparación de cada fila de datos frente a actividad concurrente legítima.

## Seguridad verificada en el servicio real

- Ocho tablas FinTin, las ocho con RLS.
- Tres vistas con `security_invoker=true`.
- Ninguna función `SECURITY DEFINER` de FinTin en `public`.
- Ninguna tabla/vista FinTin con privilegios anónimos; ninguna función FinTin ejecutable por `anon`.
- Un usuario `authenticated` no puede modificar la lista de autorizados, los lotes ni las filas de staging mediante UPDATE/DELETE.
- Ocho consultas reales con la clave pública anónima a las tablas FinTin: HTTP 401 / SQLSTATE `42501` en todos los casos.
- RPC de publicación sin sesión de usuario: HTTP 401 / `42501`.
- Intento Data API con `Content-Profile: fintin_private`: HTTP 406 / `PGRST106` (esquema no expuesto).
- El panel confirma que solo se exponen dos de los tres schemas elegibles; se conserva la configuración existente de Data API.
- Cero usuarios autorizados en FinTin y cero movimientos iniciales. No se han importado fixtures ni creado usuarios ficticios en la base definitiva.

El secreto temporal `FINTIN_DB_PASSWORD` del entorno GitHub `fintin-backup` fue eliminado tras autorización explícita del propietario. El panel confirma **This environment has no secrets**. No se ha cambiado la contraseña real de PostgreSQL ni los secretos de otras aplicaciones.

## Código y comprobaciones locales

Se publicó únicamente `.github/workflows/fintin-remote-backup.yml`, con correcciones del almacén de certificados y la CA oficial. El contenido remoto se comparó con la versión local validada. No se publicó el frontend de FinTin ni se modificaron los workflows existentes o la configuración de Pages. Los commits en `main` pueden activar el proceso automático de Pages ya existente, sin cambios en el contenido de las aplicaciones.

TypeScript y lint correctos; 34 tests de aplicación/SQL/interfaz superados y 5 comprobaciones adicionales de cifrado y CA superadas. Los intentos remotos previos se detuvieron por configuración de certificados del cliente y no generaron artefactos ni migraciones; el intento final terminó correctamente manteniendo TLS completo.

## Pendiente para utilizar FinTin

Elegir y autorizar explícitamente el UUID existente de Supabase Auth que deba gestionar FinTin. La autorización de TrackTin no se hereda. La migración deja el acceso cerrado por defecto y no elige una cuenta administrativa automáticamente. La prueba de interfaz con esa sesión real y el despliegue del frontend siguen pendientes.

La ejecución correcta incluye una advertencia de GitHub por el runtime declarado de upload-artifact v4: el runner lo ejecutó con Node.js 24 y completó la subida. No es un fallo del dump ni de su verificación. Antes de reutilizar el workflow en el futuro conviene actualizar esa acción a una versión que declare Node.js 24. El checkout local de Webs ha quedado alineado por fast-forward con los tres commits autorizados: el único archivo cambiado en ese avance es el workflow de respaldo. FinTin continúa sin publicar en GitHub.
