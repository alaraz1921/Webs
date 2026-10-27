# Encargo para Codex — implementar FinTin

Actúa como desarrollador full-stack senior, especialista en React/TypeScript, Supabase/PostgreSQL, autenticación y Row Level Security (RLS). Debes implementar una aplicación web de finanzas personales llamada **FinTin**, respetando estrictamente la seguridad y sin afectar a otros proyectos que comparten Supabase.

## 1. Directorio de trabajo y control de código

- **Raíz de trabajo obligatoria en Windows:** `V:\Proyectos\Git\Webs\FinTin`.
- Comprueba que la carpeta existe y trabaja **directamente en ella**. Si el repositorio ya existe, inspecciónalo antes de cambiar nada, conservando código y configuración útiles; si está vacío, inicializa allí el proyecto. No dupliques el proyecto en otra carpeta ni sobrescribas cambios sin revisar.
- Si ejecutas Codex bajo WSL, verifica primero dónde está montada la unidad `V:` (quizá `/mnt/v/...`). No presupongas el montaje; si no existe acceso a V:, informa del bloqueo y no simules una sincronización.
- Usa Git local, haz cambios organizados y registra instrucciones de ejecución. No inventes URL, nombre de propietario de GitHub ni remote; reutiliza un `origin` existente y, si falta, documenta el paso pendiente. No hagas push, despliegues productivos ni migraciones en el Supabase compartido sin comprobar permisos y recibir autorización explícita.
- Mantén un `.gitignore` que excluya `.env`, `.env.local`, archivos CSV reales, exportaciones financieras, backups y dumps de Supabase. Usa `.env.example` con variables sin valores secretos.

## 2. Archivos que acompañan a este encargo

El archivo `20261027_000001_fintin_inicial.sql` es el **contrato inicial de la base de datos**. Cópielo a `supabase/migrations/20261027000001_fintin_inicial.sql` (mantener contenido, salvo correcciones justificadas). Debes revisarlo, validarlo en un Supabase local/de pruebas o instancia Postgres compatible y crear las pruebas necesarias. No afirmes que una migración ha pasado hasta haberla ejecutado realmente.

**Importante:** el usuario utiliza un proyecto Supabase existente con otras aplicaciones y otros usuarios. La migración debe operar **exclusivamente** sobre objetos `fintin_*` y el esquema privado `fintin_private`; nunca cambiar grants globales de `public`, Auth de otros proyectos, tablas existentes ajenas ni la configuración de las otras aplicaciones.

## 3. Stack y despliegue

- React, TypeScript estricto, Vite; usa un sistema visual moderno, limpio, claro en escritorio y usable en móvil.
- Supabase JS, Supabase Auth existente y PostgreSQL con RLS.
- GitHub Pages mediante GitHub Actions. Ajusta `base` de Vite para repositorio `FinTin` o un prefijo configurable. Si usas React Router, elige HashRouter o mecanismo equivalente que soporte recargas directas en GitHub Pages sin 404.
- Sin servidor propio ni `service_role`/secret key en el frontend, GitHub Actions, localStorage o el repositorio. Variables de navegador: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (acepta `VITE_SUPABASE_ANON_KEY` si el proyecto usa la clave legacy; publica solamente la pública).
- No habilites registro público de usuarios por defecto. El usuario se conecta con su cuenta ya existente en Supabase Auth; **solo los IDs añadidos a `fintin_usuarios_autorizados` pueden usar FinTin**. Si un usuario de otros proyectos inicia sesión, ver pantalla de acceso denegado; no revelar datos.

## 4. Cambio de Supabase del 30 de octubre de 2026

Las tablas nuevas de `public` ya no recibirán automáticamente permisos Data API. Por tanto, en la misma migración que crea las tablas, debes realizar `REVOKE` de los permisos automáticos preexistentes y `GRANT` **expresos y mínimos** para `authenticated`. Nunca conceder `SELECT` a `anon` para datos de FinTin. La clave publishable NO garantiza seguridad por sí sola: verificar RLS y grants en todas las tablas. Verificar que `fintin_private` no esté en los schemas expuestos en Data API. Las vistas de dashboard deben utilizar `security_invoker = true` para respetar RLS.

## 5. Base de datos (usar la migración adjunta)

Tablas:

1. `public.fintin_usuarios_autorizados`: usuarios aprobados; altas exclusivamente mediante SQL por el administrador, con `user_id` de `auth.users` y `activo`.
2. `public.fintin_cuentas`: entidad, nombre/tipo de producto, moneda, saldo inicial y fecha de corte del saldo inicial.
3. `public.fintin_cuenta_aliases`: correspondencia unívoca entre (Entidad, Nombre de producto, Tipo de producto) del CSV y cuenta interna; permite renombrar cuentas sin romper importaciones. Nunca asignar a una cuenta por mera coincidencia parcial.
4. `public.fintin_categorias`: categorías privadas, separadas por tipo `ingreso`, `gasto` o `no_computable`.
5. `public.fintin_importaciones`: cada lote, ejercicio, hash, filas esperadas/importadas y estado.
6. `public.fintin_importacion_filas`: staging temporal del CSV.
7. `public.fintin_movimientos`: tabla unificada de movimientos `csv` y `manual`, con UUID interno y FKs compuestas que impiden referencias a registros de otro propietario.
8. `public.fintin_saldos`: saldo real anotado manualmente por cuenta y fecha.

Vistas:

- `fintin_v_resumen_categorias_mensual`: agrupación por fecha valor, mes, categoría, tipo, moneda.
- `fintin_v_resumen_cuentas_mensual`: entradas/salidas mensuales por cuenta.
- `fintin_v_conciliacion_mensual`: cierre calculado (saldo inicial + movimientos acumulados) frente a saldo real y diferencia, incluidos meses sin movimientos.

**Reglas críticas:** `user_id` debe venir del usuario autenticado; verificar autorización activa; RLS en todas las tablas; las consultas desde el navegador deben limitarse a su ámbito. Los clientes pueden editar/borrar solo movimientos `manual`. Los CSV se reemplazan en una operación de servidor controlada y autorizada. Nunca exponer funciones `SECURITY DEFINER` en esquema `public`: la implementación privilegiada está en `fintin_private`, fuera de Data API, accesible por wrapper invocador `public.fintin_publicar_importacion` y con validación de sesión/propietario dentro.

## 6. CSV del agregador (fuente de verdad)

La cabecera contiene estas **11 columnas exactas** (respetar tildes y espacios):

`Fecha valor,Fecha de operación,Importe,Moneda,Concepto,Entidad,Nombre de producto,Tipo de producto,Tipo de movimiento,Categoría,Nota`

- Soportar CSV real, comillas y comas dentro de conceptos, caracteres UTF-8, BOM, CRLF, encabezados y fechas españolas `DD/MM/YYYY`, números decimales con coma, miles y símbolos de euro; aceptar variantes razonables de codificación con aviso o manejo controlado.
- No dividir líneas o columnas mediante `split(',')`: usar parser de CSV robusto (por ejemplo Papa Parse) con manejo de comillas y multilinea. No usar `parseFloat` sobre `-1.234,56 €` directamente. Convertir a representaciones decimales exactas o cadenas numéricas normalizadas para las columnas `numeric(18,2)`; no redondear con floats JS.
- Validar obligatorios, errores por fila, moneda ISO 4217 (3 letras) y mapear explícitamente tipos del CSV a `ingreso`, `gasto`, `no_computable` (etiquetas español). Valores desconocidos deben bloquear publicación hasta corregirse, no clasificarlos automáticamente por descarte.
- Selección explícita de año de importación; el año corresponde a `fecha_valor`. Rechazar filas cuyo `fecha_valor` esté fuera del año. No borrar filas de otros ejercicios ni los movimientos manuales.
- Al importar desde el agregador, **reemplazar por completo los movimientos de origen `csv` de ESE EJERCICIO**; el agregador es la fuente de categorías, tipos y notas de los importados. No editar estos datos en FinTin por ahora. No eliminar duplicados exactos: varios movimientos idénticos pueden ser legítimos. Cada fila importa como un movimiento distinto con UUID nuevo.
- Las entidades/productos importados deben vincularse a una cuenta mediante `fintin_cuenta_aliases`. Si faltan correspondencias, mostrar pantalla para resolverlas, guardar los alias y volver a comprobar. No inventar cuentas automáticamente ni elegir coincidencias ambiguas.
- Mostrar antes de confirmar: nombre y año, movimientos anteriores y nuevos, importes totales por tipo y moneda, cuentas sin asignar, advertencias y confirmación explícita de sustitución. No afirmar que la diferencia de recuento sea la cantidad exacta de movimientos nuevos.
- Crear fila `fintin_importaciones` con `filas_esperadas=N`; cargar a `fintin_importacion_filas` en lotes con índices de datos 1..N; verificar errores y progreso. En caso de reintento, gestionar conflictos por índice sin alterar datos publicados. Solo entonces llamar RPC `supabase.rpc('fintin_publicar_importacion', { p_importacion_id: id })`.
- La RPC valida propietario/autorización, integridad del lote, año, mapeo de cuenta, moneda y saldo inicial; reemplaza los CSV del ejercicio en UNA transacción. Si falla, se conserva íntegra la importación anterior. No ejecutar `delete` desde JS sobre los movimientos importados.
- Mantener registro histórico de lotes (fecha, hash, recuentos, estado) aunque las filas de staging se eliminen al confirmar para ahorrar almacenamiento.

## 7. Pantallas obligatorias

1. **Acceso**: autenticación Supabase y bloqueo de usuarios no autorizados.
2. **Resumen**: año seleccionable, indicadores de ingresos, gastos, balance computable y no computables; cuadrante mes x categoría con totales y filtro por cuenta. Clic en celda abre movimientos filtrados. No mezclar monedas sin conversión explícita.
3. **Cuentas**: cuadrante de meses por cuenta con saldo calculado y cierre; consultar entradas/salidas y saldo histórico.
4. **Conciliación**: saldos reales por mes/cuenta, saldo calculado, diferencias visibles y posibilidad de abrir los movimientos responsables. `saldo_calculado = saldo_inicial + SUM(importe de TODOS los movimientos de esa cuenta con fecha_valor > fecha_saldo_inicial y <= fecha_cierre)`. Incluye movimientos `no_computable`; estos no forman parte del balance de ingresos menos gastos. Mostrar pendientes cuando no existe saldo real.
5. **Movimientos**: búsqueda, paginación, filtros por fechas, categoría, tipo, origen, entidad y cuenta; formulario de creación/edición/borrado solo para manuales; los CSV son de solo lectura. Listado combinado.
6. **Importación CSV**: previsualización, validación, asignación de alias, resumen comparativo y confirmación; historial por ejercicio.
7. **Configuración**: cuentas, fecha/saldo inicial, alias, categorías; mostrar usuario actual y opción salir.

Incluir estados vacíos y errores claros, tabla cómoda para miles de movimientos y controles accesibles. Usar cifras de ejemplo anonimizadas en tests; no incluir capturas ni exportaciones privadas en Git.

## 8. Pruebas de seguridad y negocio — obligatorias

- SQL/pgtap, cuando se disponga de Supabase local: `anon` no puede leer FinTin; otro usuario autenticado de otras webs tampoco; usuario Fintin sí puede ver sus propias filas; una sesión Fintin no puede acceder al `user_id` de otro autorizado; ningún usuario normal puede escribir en `fintin_usuarios_autorizados`.
- Usuario con permisos FinTin solo inserta/edita/borra movimientos `manual`; intentar alterar `csv` se bloquea. FKs compuestas rechazan vincular a cuenta/categoría ajena.
- RPC rechaza lotes ajenos, sin autenticar, incompletos, año incorrecto, cuentas sin mapear, monedas incompatibles; ante fallo no toca los CSV previos, los manuales ni otras anualidades.
- CSV con movimientos idénticos mantiene todas las filas; cargar 2026 dos veces sustituye solo 2026, jamás duplica sus movimientos ni altera manuales.
- Cuenta con saldo inicial 100 EUR al 31/12/2025, transferencia propia de +20 y gasto -10 en enero de 2026: saldo calculado al 31/01/2026 = 110 EUR, y una transferencia no computable no altera el balance de ingresos/gastos aunque sí el saldo bancario.
- Resúmenes y vistas no filtran inadvertidamente datos de otros usuarios; vistas `security_invoker`. Verificar explícitamente grants con `information_schema.role_table_grants` o consulta a `has_table_privilege`, y RLS en `pg_class`.
- Tests unitarios de parseo CSV: decimal negativo español, millares, fechas, cabecera exacta, duplicados idénticos, comillas multilinea, moneda, cabecera BOM y filas erróneas.
- Ejecutar lint, typecheck, tests, build y resumir resultados con comandos y salidas significativas. No inventar resultados si no hay acceso a Supabase o a un repositorio remoto.

## 9. Documentación y entrega esperada

- Carpeta completa del frontend; componentes, estilos y pantallas funcionales, no solo maquetas.
- SQL bajo `supabase/migrations/`, tests de SQL/seguridad en `supabase/tests/` (o instrucciones reproducibles si el entorno carece de Supabase local).
- `.env.example`, `.gitignore`, GitHub Action para Pages, README en español con instalación, variables, ejecución, migración (primero en entorno de prueba), alta manual del UUID de propietario en `fintin_usuarios_autorizados`, pruebas, despliegue y copia de seguridad.
- Preparar un pequeño archivo CSV ficticio de ejemplo con las 11 columnas y al menos dos filas literalmente idénticas, guardado en carpeta `fixtures`, sin datos personales.
- Documentar decisiones y cualquier diferencia respecto a la migración original, justificando la corrección y preservando seguridad.
- Si detectas un problema SQL, corrígelo antes de construir sobre él. No ejecutes la migración contra producción sin permiso. Si no tienes acceso al Supabase existente, prepara todo lo ejecutable localmente y explica exactamente los pasos pendientes.

Empieza inspeccionando `V:\Proyectos\Git\Webs\FinTin`, planifica los cambios en esa misma carpeta, valida la migración localmente cuando sea posible y luego implementa la aplicación de principio a fin. Prioriza integridad de datos, seguridad y funcionalidad real sobre animaciones o gráficos decorativos.
