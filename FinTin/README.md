# FinTin

**Estado 27/10/2026:** respaldo remoto recuperado y verificado; migración aplicada en el Supabase compartido con TrackTin. Seguridad y firmas de las otras aplicaciones comprobadas. El secreto temporal de GitHub se ha eliminado. Véase [MIGRACION_APLICADA.md](./MIGRACION_APLICADA.md). El acceso a FinTin permanece cerrado hasta autorizar el UUID elegido de Auth.

Aplicación de finanzas personales con React, TypeScript estricto, Vite y Supabase. Incluye acceso con cuenta existente, resumen mensual por categorías y moneda, evolución de cuentas, conciliación con saldos reales, CRUD de movimientos manuales, configuración de cuentas/categorías/alias e importación anual transaccional.

## Ejecución

Requiere Node.js 22.12+ o una versión LTS compatible (24/26), y npm. Desde esta carpeta:

```powershell
npm ci
Copy-Item .env.example .env.local
# Usar la URL y la clave PÚBLICA del mismo proyecto Supabase que TrackTin.
npm run dev
```

Abrir la URL de Vite, normalmente `http://127.0.0.1:5173/FinTin/`. Sin variables aparece una pantalla de configuración, sin datos simulados. No se habilitan registros ni se modifica Supabase Auth. Usar correo y contraseña de una cuenta existente. Cerrar sesión afecta únicamente a la sesión local de FinTin. La sesión se mantiene en memoria: al recargar se inicia sesión de nuevo. No se almacenan claves secretas ni movimientos en localStorage.

Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` o, alternativamente, `VITE_SUPABASE_ANON_KEY` pública legacy. Nunca usar `service_role`, `sb_secret_…` ni contraseñas de PostgreSQL en Vite o Actions. `.env.local` está ignorado. Vite rechaza claves secretas o JWT de roles privilegiados antes de compilar. La clave pública es visible en la compilación: grants y RLS son la frontera de seguridad.

## Base de datos única compartida con TrackTin

Se utilizará el mismo proyecto Supabase definitivo que TrackTin. No se exige otro proyecto de pruebas: la migración se verifica primero en PostgreSQL embebido local y su instalación se realiza posteriormente en la base compartida con autorización explícita.

La URL y la clave pública pueden ser las mismas de TrackTin. Los usuarios de Auth existentes también se reutilizan, pero el permiso de acceso a FinTin es independiente: exige una fila activa en `fintin_usuarios_autorizados`. Ser miembro de TrackTin, o administrador de su sistema compartido, no concede acceso financiero automáticamente. No se modifican `app_projects`, `project_members`, `is_admin()`, `can_use_tracktin()` ni sus políticas.

La migración `supabase/migrations/20261027000001_fintin_inicial.sql` conserva íntegro el SQL original. Se ha aplicado en el proyecto compartido tras verificar una copia previa; no repetirla. Solo crea objetos `fintin_*` y `fintin_private`; no cambia privilegios globales ni objetos de otras aplicaciones. Para la secuencia de revisión, copia de seguridad, instalación y comprobación, consultar [INSTALACION_COMPARTIDA.md](./INSTALACION_COMPARTIDA.md).

**Nunca ejecutar `supabase/tests/bootstrap.sql` en la base compartida**: simula Auth únicamente dentro del arnés desechable local. Tampoco ejecutar `supabase db reset` sobre el proyecto definitivo. No crear usuarios ficticios, ni importar fixtures financieros en la cuenta real.

## Importación

Seleccionar ejercicio y codificación: UTF-8 o Windows-1252 como conversión explícita. La cabecera debe tener las once columnas exactas del contrato. Papa Parse maneja comillas, multilinea, BOM y CRLF. Se normalizan importes españoles a cadenas decimales sin floats y fechas a ISO. Se aceptan D/M/YYYY y D/M/YY en ambas fechas, con días y meses de una o dos cifras; los años abreviados 00–99 corresponden explícitamente a 2000–2099. La fecha valor es obligatoria y debe seguir coincidiendo con el ejercicio seleccionado. Si la fecha de operación está vacía o contiene solo espacios, se usa la fecha valor y se muestra un aviso con el número de filas afectadas. Una fecha de operación presente pero inválida se rechaza. Tipos desconocidos, filas erróneas y años mezclados bloquean publicación. Los duplicados legítimos se conservan. Los signos no se transforman; se advierten gastos positivos e ingresos negativos.

Resolver alias explícitos antes de publicar; no se hacen correspondencias parciales ni se crean cuentas automáticamente. La previsualización muestra las primeras 50 filas, los recuentos y los totales completos por tipo y moneda. Se requiere confirmar la sustitución del ejercicio. Se carga en lotes de 500 con progreso e índices 1..N. SHA-256 usa los bytes originales. El historial conserva metadatos y hash, nunca el archivo.

Si se interrumpe una carga, seleccionar otra vez **el mismo archivo**, ejercicio y codificación, y elegir su lote pendiente en «Lote de preparación». Se insertan solo ordinales ausentes, sin UPDATE ni DELETE en staging. Ante respuesta de red incierta, consultar primero historial: un lote aplicado no se publica otra vez. Los lotes pendientes de otros archivos se mantienen y pueden requerir limpieza administrativa futura; el cliente no puede eliminarlos.

Solo `fintin_publicar_importacion` publica. Valida sesión, autorización, propiedad, integridad, ejercicio, alias, moneda y fecha de partida; sustituye CSV del año, crea categorías, conserva manuales y otros años, y limpia staging en una transacción. Si falla, revierte todo. El navegador no ejecuta DELETE de CSV.

## Cálculos y consulta

PostgREST devuelve los importes con cast `::text`; Decimal.js calcula con precisión de 40 dígitos sin perder céntimos en numeric(18,2). Monedas separadas, sin conversión. Balance computable = ingresos + gastos con sus signos originales. No computables afectan al saldo, no al balance computable.

Los cierres usan la vista invocadora SQL: saldo inicial + todos los movimientos posteriores al corte y hasta el cierre inclusive. Incluye meses sin movimientos hasta el mes actual según `Atlantic/Canary`, zona del SQL original. Meses futuros sin cierre. Saldos reales de otras fechas se guardan como observaciones; para conciliar un mes usar su último día. Guardar de nuevo cuenta/fecha actualiza ese saldo real.

El listado pagina en servidor, 50 filas, con filtros y búsqueda por concepto. Resúmenes recorren el ejercicio en páginas de 1.000 sin truncarlo al límite habitual de Supabase. Para volúmenes muy grandes conviene añadir agregados invocadores por cuenta y moneda conservando RLS.

## Verificación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`tests/database.test.ts` ejecuta la migración REAL en [PGlite](https://pglite.dev/docs/), PostgreSQL embebido en memoria. `supabase/tests/bootstrap.sql` simula Auth y los tres roles únicamente en esta base aislada. Se verifican grants, RLS, vistas invocadoras, acceso ajeno/revocado/anónimo, manuales, RPC, duplicados, ejercicios y rollback. Los tests de finanzas prueban CSV y cálculos con datos sintéticos. Los tests de interfaz ejercitan manuales, creación de cuentas, confirmación y bloqueos de publicación; los de API comprueban staging y reintentos con un cliente simulado. `supabase/tests/verify-security.sql` permite revisar los permisos desde un administrador, con consultas de solo lectura.

PGlite no sustituye la validación final de Supabase Auth, PostgREST, límites HTTP, schemas expuestos, concurrencia entre conexiones y GitHub Pages. Estas integraciones se comprobarán en la base definitiva después de la instalación autorizada, empezando por consultas de solo lectura y el acceso denegado; las comprobaciones con escrituras deben limitarse a FinTin y acordarse expresamente. Ningún test contacta con servicios externos.

## GitHub Pages

URL pública: https://www.alaraz1921.com/FinTin/

Pages mantiene su configuración existente: rama main, carpeta raíz. No cambiar a un artefacto que contenga solo FinTin: sustituiría el resto del sitio.

La entrada de Vite es src/index.html. npm run pages:prepare compila en dist/ y actualiza únicamente index.html y assets/ de esta carpeta. Estos archivos generados se versionan para que Pages pueda servirlos junto a las otras aplicaciones. Para publicar una actualización, ejecutar las verificaciones, pages:prepare y revisar/confirmar estos cambios en main. No editar manualmente los assets compilados.

El workflow raíz fintin-check.yml verifica fuentes, seguridad y compilación sin cambiar la configuración Pages ni publicar un sitio independiente. Usa las claves públicas ya existentes de TrackTin; no necesita contraseñas de PostgreSQL ni claves de servicio. El despliegue lo realiza el workflow habitual pages build and deployment tras cada publicación en main.

La autorización de usuarios sigue siendo independiente: hasta añadir expresamente el UUID de Auth elegido a fintin_usuarios_autorizados, nadie puede acceder a los datos de FinTin.
