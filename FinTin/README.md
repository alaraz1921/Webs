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

Abrir la URL de Vite, normalmente `http://127.0.0.1:5173/FinTin/`. Sin variables aparece una pantalla de configuración, sin datos simulados. No se habilitan registros ni se modifica Supabase Auth. Usar correo y contraseña de una cuenta existente. Cerrar sesión afecta únicamente a la sesión local de FinTin. La sesión se mantiene en memoria: al recargar se inicia sesión de nuevo. Al volver a la pestaña o renovarse el token del mismo usuario, se conserva la pantalla montada y sus filtros y paginación; la autorización se revalida en segundo plano. Un cierre de sesión, un cambio de UUID o una autorización revocada retiran el acceso. No se almacenan claves secretas ni movimientos en localStorage.

Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` o, alternativamente, `VITE_SUPABASE_ANON_KEY` pública legacy. Nunca usar `service_role`, `sb_secret_…` ni contraseñas de PostgreSQL en Vite o Actions. `.env.local` está ignorado. Vite rechaza claves secretas o JWT de roles privilegiados antes de compilar. La clave pública es visible en la compilación: grants y RLS son la frontera de seguridad.

## Base de datos única compartida con TrackTin

Se utilizará el mismo proyecto Supabase definitivo que TrackTin. No se exige otro proyecto de pruebas: la migración se verifica primero en PostgreSQL embebido local y su instalación se realiza posteriormente en la base compartida con autorización explícita.

La URL y la clave pública pueden ser las mismas de TrackTin. Los usuarios de Auth existentes también se reutilizan, pero el permiso de acceso a FinTin es independiente: exige una fila activa en `fintin_usuarios_autorizados`. Ser miembro de TrackTin, o administrador de su sistema compartido, no concede acceso financiero automáticamente. No se modifican `app_projects`, `project_members`, `is_admin()`, `can_use_tracktin()` ni sus políticas.

La migración `supabase/migrations/20261027000001_fintin_inicial.sql` conserva íntegro el SQL original. Se ha aplicado en el proyecto compartido tras verificar una copia previa; no repetirla. Solo crea objetos `fintin_*` y `fintin_private`; no cambia privilegios globales ni objetos de otras aplicaciones. Para la secuencia de revisión, copia de seguridad, instalación y comprobación, consultar [INSTALACION_COMPARTIDA.md](./INSTALACION_COMPARTIDA.md).

**Nunca ejecutar `supabase/tests/bootstrap.sql` en la base compartida**: simula Auth únicamente dentro del arnés desechable local. Tampoco ejecutar `supabase db reset` sobre el proyecto definitivo. No crear usuarios ficticios, ni importar fixtures financieros en la cuenta real.

## Importación

En «Destino de los movimientos», elegir «CSV del agregador · sustituir ejercicio» (contrato original de 11 columnas) o «Movimientos manuales · añadir». La carga manual utiliza estas **9 columnas exactas**:

`Fecha valor,Fecha de operación,Importe,Concepto,Entidad,Nombre de producto,Tipo de movimiento,Categoría,Nota`

Se puede descargar un ejemplo sintético desde la pantalla. No lleva Moneda ni Tipo de producto: la moneda procede de la cuenta elegida. Se reconoce la pareja entidad/producto si hay una correspondencia única en los alias existentes o en las cuentas; ante ambigüedad hay que seleccionar explícitamente la cuenta. Debe ser posterior a su saldo de partida y pertenecer al ejercicio seleccionado. La fecha de operación puede quedar vacía (usa fecha valor con aviso).

Los manuales se AÑADEN, se pueden editar después y sobreviven a las sustituciones anuales del agregador. Las categorías se vinculan por nombre y tipo solo si hay una coincidencia única; si no, su nombre se conserva en categoria_csv sin crear categorías automáticamente. Máximo 5.000 filas y 10 MiB por carga manual. Se validan todas las filas, se previsualizan 50, se muestran totales completos por moneda y tipo y se exige confirmar antes del único INSERT transaccional de PostgREST. Un error SQL revierte toda la carga. Se utilizan los GRANT, RLS y triggers existentes sin migrar la base.

Cada previsualización manual genera UUID propios para las filas. Ante un resultado de red incierto, reintentar la **misma previsualización**: si los UUID ya están guardados, se verifican propietario, origen y todos los campos antes de confirmar éxito. No hay UPDATE, DELETE ni reintento automático. Los duplicados legítimos del archivo se conservan. Volver a seleccionar el archivo o recargar genera una carga nueva: comprobar primero Movimientos para evitar duplicados. El historial de lotes de esta pantalla corresponde al agregador; las cargas manuales se consultan en Movimientos con origen Manual. No se guardan archivos ni datos en localStorage.


Seleccionar ejercicio y codificación: UTF-8 o Windows-1252 como conversión explícita. La cabecera debe tener las once columnas exactas del contrato. Papa Parse maneja comillas, multilinea, BOM y CRLF. Se normalizan importes españoles a cadenas decimales sin floats y fechas a ISO. Se aceptan D/M/YYYY y D/M/YY en ambas fechas, con días y meses de una o dos cifras; los años abreviados 00–99 corresponden explícitamente a 2000–2099. La fecha valor es obligatoria y debe seguir coincidiendo con el ejercicio seleccionado. Si la fecha de operación está vacía o contiene solo espacios, se usa la fecha valor y se muestra un aviso con el número de filas afectadas. Una fecha de operación presente pero inválida se rechaza. Tipos desconocidos, filas erróneas y años mezclados bloquean publicación. Los duplicados legítimos se conservan. Los signos no se transforman; se advierten gastos positivos e ingresos negativos.

Resolver alias explícitos antes de publicar; no se hacen correspondencias parciales ni se crean cuentas automáticamente. La previsualización muestra las primeras 50 filas, los recuentos y los totales completos por tipo y moneda. Se requiere confirmar la sustitución del ejercicio. Se carga en lotes de 500 con progreso e índices 1..N. SHA-256 usa los bytes originales. El historial conserva metadatos y hash, nunca el archivo.

Si se interrumpe una carga, seleccionar otra vez **el mismo archivo**, ejercicio y codificación, y elegir su lote pendiente en «Lote de preparación». Se insertan solo ordinales ausentes, sin UPDATE ni DELETE en staging. Ante respuesta de red incierta, consultar primero historial: un lote aplicado no se publica otra vez. Los lotes pendientes de otros archivos se mantienen y pueden requerir limpieza administrativa futura; el cliente no puede eliminarlos.

Solo `fintin_publicar_importacion` publica. Valida sesión, autorización, propiedad, integridad, ejercicio, alias, moneda y fecha de partida; sustituye CSV del año, crea categorías, conserva manuales y otros años, y limpia staging en una transacción. Si falla, revierte todo. El navegador no ejecuta DELETE de CSV.

## Cálculos y consulta

### Origen CSV y cuentas de destino

En instalaciones nuevas, aplicar después de la migración inicial `supabase/migrations/20261028000001_fintin_origen_alias.sql`. Ya está aplicada en el proyecto compartido el 28/10/2026; no reejecutarla. Se validó primero en PostgreSQL embebido y se comprobaron iguales las firmas de metadatos de otras aplicaciones y de movimientos, alias y saldos existentes antes y después. `supabase/verify-origin-alias.sql` permite comprobar estructura y seguridad en modo de solo lectura.

Es una ampliación exclusiva de FinTin: conserva `entidad_csv`, `nombre_producto_csv` y `tipo_producto_csv` en cada movimiento antes de limpiar staging. No cambia los datos existentes, Auth, RLS ni permisos de otras aplicaciones. Las cargas CSV manuales también conservan estos campos. La tabla Movimientos muestra por separado el origen recibido y la cuenta de destino guardada.

Los CSV publicados antes de esta ampliación no conservaban su origen. No se deduce por el destino, ni siquiera si actualmente tiene un único alias: mostrar «Origen no conservado». Para recuperarlo, reimportar cada ejercicio necesario una vez desde su CSV original; la sustitución anual mantiene los movimientos manuales. Los manuales históricos sin origen no pueden recuperarlo automáticamente y no se reasignan mediante alias.

Cuentas agrupa por la cuenta de destino (`cuenta_id`), no por el nombre original del CSV: varios orígenes asignados al mismo destino aportan sus movimientos a un único saldo, con un único saldo inicial. Al cambiar el destino de un alias, un trigger privado reasigna los movimientos identificados por la misma terna normalizada (entidad, producto, tipo), incluidos los importados como manuales. Los manuales sin origen conservado mantienen su cuenta. No se alteran importes, fechas, categorías, notas ni los saldos reales anotados: estos últimos pertenecen a su cuenta de destino y fecha, por lo que puede aparecer una nueva diferencia de conciliación.

La reasignación y el cambio de alias son atómicos. Si cualquier movimiento resulta incompatible con la moneda o fecha inicial del destino, se revierte todo y se muestra el error en el formulario. Se comprueban usuario autorizado y propietario, y se serializa con la publicación anual. Los CSV siguen protegidos contra ediciones directas desde el navegador. Cambiar los campos que identifican el origen de un alias lo convierte en una correspondencia para ese nuevo origen; no renombra los datos originales de movimientos históricos. Eliminar un alias no elimina ni mueve movimientos.

El resumen presenta cuatro bloques en orden: Ingresos, Gastos, No computables y Totales y neto. Los tres primeros desglosan categorías y meses con subtotales mensuales y anual. El cuarto muestra solo los totales mensuales y anual de los tres tipos y el Neto. Como el CSV conserva gastos con signo negativo y devoluciones con signo positivo, el Neto suma ingresos y gastos con su signo, excluyendo no computables.

PostgREST devuelve los importes con cast `::text`; Decimal.js calcula con precisión de 40 dígitos sin perder céntimos en numeric(18,2). Monedas separadas, sin conversión. Balance computable = ingresos + gastos con sus signos originales. No computables afectan al saldo, no al balance computable.

En los campos de importe manual, saldo inicial y saldo real, la tecla decimal del teclado numérico introduce coma, respetando cursor y selección. El punto del teclado principal se conserva para separar miles. Con Bloq Num desactivado, Supr mantiene su función. Cuentas y Conciliación anotan y editan los saldos desde sus celdas o filas, sin formulario inferior permanente.

En Cuentas, pulsar una celda mensual abre un menú con «Ver movimientos» y «Saldo real». La primera opción filtra la cuenta y el mes completo de la celda. La segunda abre el modal con la cuenta y el último día del mes fijos, para crear el saldo o editar el existente y su nota. También funciona en meses sin cierre calculado; anotar un saldo no crea un cierre futuro ni modifica el cálculo. El menú admite teclado, Escape y cierre al pulsar fuera o desplazar la página.

Los cierres usan la vista invocadora SQL: saldo inicial + todos los movimientos posteriores al corte y hasta el cierre inclusive. Incluye meses sin movimientos hasta el mes actual según `Atlantic/Canary`, zona del SQL original. Meses futuros sin cierre. Los saldos históricos de otras fechas se conservan como observaciones; la conciliación mensual usa el último día del mes. Guardar de nuevo cuenta/fecha actualiza ese saldo real.

En Conciliación se combinan los filtros de mes y estado (Con diferencia, Sin diferencia, Sin saldo real) con ejercicio, cuenta y moneda. Sin diferencia exige un saldo real registrado, incluido cero; los pendientes no se consideran coincidentes. El botón «Sin saldo real» de la fila abre un modal de alta con cuenta y cierre fijos; «Editar», junto a «Revisar», abre el saldo existente y su nota. Guardar actualiza ese registro y refresca los cierres manteniendo mes, estado y ordenación. Cancelar no guarda cambios y los errores permanecen en el modal para poder corregir o reintentar.

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
