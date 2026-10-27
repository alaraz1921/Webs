# Estado actual de verificación — 27/10/2026

**La migración ya está aplicada y el respaldo remoto se ha recuperado y verificado.** Las seis firmas de los objetos ajenos coinciden antes/después; las comprobaciones de seguridad de FinTin han pasado y el secreto temporal de GitHub está eliminado. Informe completo: [MIGRACION_APLICADA.md](./MIGRACION_APLICADA.md).

Los apartados siguientes conservan el historial de implementación y de los bloqueos ya resueltos; sus frases en presente describen el estado en aquel momento.

---

# Verificación realizada — 27/10/2026

Trabajo realizado directamente en `V:\Proyectos\Git\Webs\FinTin`. Se conservan los tres documentos originales y el repositorio padre `Webs`. No se han creado repositorios anidados ni ejecutado commits, push, despliegues o cambios en Supabase externo.

| Comprobación                           | Resultado                                                             |
| -------------------------------------- | --------------------------------------------------------------------- |
| `npm run lint`                         | Correcto, sin errores                                                 |
| `npm run typecheck`                    | Correcto, TypeScript estricto                                         |
| `npm test`                             | 6 archivos, 34 tests superados con Vitest 5.0.5                       |
| `npm run build`                        | Correcto, Vite 6.4.5; artefactos en `dist/`                           |
| `npm audit --audit-level=high`         | 0 vulnerabilidades                                                    |
| Compilación con clave secreta ficticia | Rechazada antes de generar el bundle                                  |
| Previsualización HTTP                  | Respuesta 200 en `/FinTin/`                                           |
| Revisión en navegador                  | Pantalla de configuración sin credenciales, sin datos de demostración |
| Migración SQL                          | Ejecutada realmente en PostgreSQL embebido PGlite, en memoria         |
| SQL copiado                            | SHA-256 idéntico al archivo original                                  |

Los nueve casos de base de datos cubren grants mínimos, RLS de ocho tablas, tres vistas invocadoras, usuarios anónimos/ajenos/revocados, autorizaciones no editables, FKs entre propietarios, CSV de solo lectura, duplicados, sustitución anual, conservación de manuales/otras anualidades, rechazos del RPC y saldo calculado con no computables. Los demás tests comprueban parseo y cálculos decimales, interfaz de cuentas y manuales, confirmación/bloqueos/errores de importación, preparación por ordinales y rechazo de claves privilegiadas.

La auditoría inicial detectó vulnerabilidades en el entorno de pruebas Vitest 3. Se actualizó a Vitest 5.0.5, se adaptó su API y se repitió la verificación completa con los resultados anteriores.

## Pendientes que requieren acceso externo o decisión del propietario

- Usar en `.env.local` la URL y clave pública del mismo proyecto definitivo que TrackTin; no se requiere otro Supabase.
- Tras copia de seguridad, revisión previa y autorización explícita, instalar la migración en la base compartida. Comprobar Auth real, PostgREST, casts decimales y schemas expuestos. Las pruebas destructivas, multiusuario e importaciones ficticias permanecen en PostgreSQL local; no se crean usuarios de prueba ni se cargan fixtures en las cuentas reales.
- Verificar manualmente que `fintin_private` no se expone en Data API. Se incluye `supabase/tests/verify-security.sql` para diagnosticar grants/RLS con consultas de solo lectura.
- Antes de producción: copia de seguridad, revisión y autorización de la migración y alta manual del UUID. Nada de esto se ha ejecutado en el proyecto compartido.
- Elegir destino GitHub Pages sin sobrescribir otras webs. El workflow queda preparado dentro de FinTin; el repositorio padre requiere activarlo desde su `.github/workflows/`, tal como explica README. No se ha modificado la raíz del repositorio.
- Autorizar expresamente cualquier publicación o push. El workflow preparado es manual y no ejecuta migraciones.

No se ha probado la interfaz autenticada contra un Supabase real ni un despliegue remoto. Los tests de interfaz usan respuestas ficticias controladas y los datos de ejemplo son sintéticos.

## Aclaración del despliegue

El propietario confirma que solo existe una base Supabase, compartida con TrackTin, y será la definitiva. Se sustituye el requisito anterior de otro Supabase por pruebas locales y el procedimiento de INSTALACION_COMPARTIDA.md. Los documentos originales del encargo se conservan como referencia histórica; esta decisión posterior prevalece. El 27/10/2026 el propietario ha autorizado expresamente la migración de FinTin en la base compartida, condicionada a las comprobaciones previas y a conservar los datos y permisos de otras aplicaciones. La sesión del panel ya se ha abierto y se ha comprobado el proyecto correcto. La migración sigue sin ejecutarse: falta una copia previa verificada. No hace falta repetir la autorización.

Se ha preparado `.env.local` usando únicamente la URL y la clave pública existentes de TrackTin, sin peticiones remotas, y se ha comprobado que Git lo ignora. La nueva prueba `tests/shared-database.test.ts` instala el esquema base local de TrackTin y después FinTin en PGlite: conserva datos sintéticos, políticas y grants, mantiene las operaciones de TrackTin y verifica que su usuario no obtiene acceso automático a FinTin. No reproduce toda la configuración del servicio definitivo ni sustituye su revisión. Tras este cambio han pasado typecheck, los 34 tests, lint y build.

## Comprobaciones remotas de solo lectura

En el panel del proyecto `nxuqkvuvmllqihaefjky`, coincidente con TrackTin, se han ejecutado consultas BEGIN READ ONLY/COMMIT. Resultado: base/ejecutor postgres; PostgreSQL 17.6; Auth, auth.uid() y TrackTin presentes; los tres roles esperados presentes; cero objetos o funciones de FinTin y ningún esquema fintin_private previo. No se ha aplicado la migración ni dado altas de usuarios.

El propietario confirma que no hay copia recuperable previa y solicita crearla antes de migrar. El plan Free no ofrece copias en el panel. Se preparó `scripts/backup-shared.ps1`: pide contraseña solo en un formulario local, utiliza herramientas PostgreSQL 17.6 portátiles oficiales y guarda fuera del repositorio. El intento se detuvo en la conexión inicial, con timeout a los dos destinos IPv4 del pooler en el puerto 5432; el hostname de conexión directa no resuelve desde este entorno. No llegó a validar la contraseña, no se generó un dump y no se ha ejecutado ninguna escritura SQL. Las comprobaciones pendientes son copia verificable, schemas expuestos, firmas antes/después, migración y validación posterior. El acceso al panel ya está disponible.

Se ha revisado Data API en el panel: los schemas expuestos son public y graphql_public; fintin_private no figura. Max rows=1000. La opción global de exposición automática preexistente se ha conservado sin cambios: FinTin aplica sus propios REVOKE/GRANT en la migración. La migración sigue pendiente de una copia verificada. Se incluye scripts/crear-copia.cmd para ejecutar el mismo respaldo desde una sesión local de Windows fuera de Codex; si la conectividad sigue fallando, no se debe migrar ni cambiar contraseñas o restricciones de otras aplicaciones para eludirlo.

## Diagnóstico posterior de conectividad

El propietario reproduce el timeout ejecutando el respaldo directamente en Windows. Se han probado de nuevo los puertos 5432 y 6543 del pooler, ambos sin conexión. El panel de Database Settings confirma acceso permitido desde todas las IP y ninguna IP baneada; no se ha modificado nada. La consulta explícita de DNS AAAA sí resuelve el host directo: el anterior ENOTFOUND de la resolución del sistema no significaba ausencia del registro IPv6. El intento de conexión IPv6 devuelve ENETUNREACH. La ruta hacia PostgreSQL no es accesible desde este equipo; el origen exacto del bloqueo IPv4 no se puede determinar con estas pruebas.

El script de copia comprueba ahora TCP/5432 antes de abrir el formulario de contraseña y deja phase=connectivity/passwordRequested=false si no hay conexión. No se debe repetir la introducción de credenciales mientras persista este fallo. Hace falta comprobar desde una red autorizada que permita ese destino; no se han desactivado protecciones ni cambiado restricciones, usuarios o contraseñas. No existe aún una copia verificada y no se ha ejecutado la migración.

## Respaldo remoto preparado

El propietario solicita mantener Supabase Free y crear la copia desde un entorno remoto controlado. Se ha preparado un workflow manual autocontenido para GitHub Actions, sin checkout ni migraciones, con PostgreSQL oficial fijado por digest, TLS verify-full y conexiones de solo lectura. Únicamente se conservará un artefacto cifrado; la clave privada RSA permanece en LocalAppData fuera del repositorio. Se han superado cuatro pruebas locales de cifrado/recuperación, manipulación, truncamiento y protección de destinos existentes; lint correcto y sintaxis del programa incrustado en YAML comprobada. Estas comprobaciones no significan todavía que exista un respaldo remoto. La instalación y la contraseña temporal del entorno GitHub son los siguientes pasos.
