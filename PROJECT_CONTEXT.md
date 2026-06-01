# PROJECT_CONTEXT

## Resumen

`Webs` es un repositorio de sitio web estatico personal en HTML, CSS y JavaScript vanilla. No tiene sistema de build, gestor de dependencias, backend ni framework local. El proyecto se puede abrir directamente desde `index.html` o servirse con cualquier servidor estatico.

Repositorio analizado:

```text
V:\Proyectos\Git\Webs
```

Rama actual:

```text
main
```

Ultimos commits vistos:

```text
b2ca9cc Usar modal propio en monitor de bingo
0a43252 Ajustar botones de vuelta
8da82e9 Ajustar estilos de portada y accesos
3276389 Rename IMG_1914.jpg to images/IMG_1914.jpg
4681855 Add files via upload
```

## Stack

- HTML multipagina.
- CSS compartido en `assets/styles.css`.
- JavaScript por pagina en `assets/js/`.
- Tailwind CSS por CDN en las paginas de `ValentinaPlay`.
- Google Fonts por CDN en la portada y zona privada.
- Supabase JS por CDN en `Privado/index.html`.
- Supabase JS por CDN en `Bingo/monitor.html` e `infiltrado/index.html` para validar clave diaria por RPC.
- Persistencia local mediante `localStorage` en Bingo y El Infiltrado.

No se encontraron:

- `package.json`.
- Configuracion de build.
- Tests automatizados.
- Linter o formatter configurado.
- Backend o API.

## Estructura

```text
.
|-- index.html
|-- 404.html
|-- Notas
|-- assets/
|   |-- styles.css
|   |-- supabase-client.js
|   |-- private-auth.js
|   `-- js/
|-- images/
|   `-- IMG_1914.jpg
|-- Privado/
|   `-- index.html
|-- supabase/
|   |-- README.md
|   `-- migrations/
|       `-- 20260601110000_initial_private_schema.sql
|-- Bingo/
|   |-- carton.html
|   |-- monitor.html
|-- infiltrado/
|   `-- index.html
`-- ValentinaPlay/
    |-- index.html
    |-- tictactoe.html
    |-- connectfour.html
    |-- number_to_number.html
    |-- multiplication_hunt.html
    |-- guess_the_number.html
    `-- magic_clock.html
```

## Paginas Principales

### `index.html`

Portada del sitio `alaraz1921`.

Responsabilidades:

- Navbar responsive.
- Hero con imagen `images/IMG_1914.jpg`.
- Accesos a `Privado`, `ValentinaPlay` y otros proyectos.
- Modal de "Otros Proyectos".
- Formulario de contacto simulado.

Notas:

- El formulario no envia datos reales. Hace `event.preventDefault()`, limpia el formulario y muestra un modal propio de confirmacion.
- La codificacion de caracteres fue revisada y corregida en la pasada de mantenimiento del 2026-06-01.

### `assets/styles.css`

Hoja de estilos compartida para casi todo el sitio.

Incluye estilos para:

- Portada.
- Pagina 404.
- El Infiltrado.
- Bingo carton.
- Bingo monitor.
- ValentinaPlay.
- Zona privada.
- Ajustes responsive moviles.

Notas:

- Es un archivo grande que mezcla estilos de muchas paginas.
- Usa selectores por clase de `body`, lo que ayuda a evitar colisiones.
- Hay comentarios y caracteres mojibake visibles en algunas secciones.

### `Privado/index.html`

Pantalla de acceso privado conectada con Supabase Auth.

Comportamiento actual:

- Pide email y clave.
- Usa `assets/supabase-client.js` y `assets/private-auth.js`.
- Mantiene la sesion con Supabase Auth.
- Muestra un panel privado basico cuando hay sesion activa.
- Muestra un recordatorio de la formula de claves diarias obtenido desde Supabase.
- Todavia no carga proyectos desde tablas privadas.

### `supabase/`

Contiene la primera migracion SQL y notas para aplicar el esquema desde el SQL Editor de Supabase.

Tablas iniciales:

- `profiles`.
- `app_projects`.
- `project_members`.

Todas tienen RLS activado.

Tambien contiene una migracion para validar claves diarias de Bingo Monitor e Infiltrado mediante RPC:

- `validate_daily_access_code(text, text)`.
- `get_daily_access_formula_note()`.

### `Bingo/carton.html`

Carton de bingo tradicional.

Responsabilidades:

- Generar carton 3x9 con 15 numeros.
- Persistir carton, estado de partida, tachados y bloqueo en `localStorage`.
- Permitir marcar numeros solo cuando la partida esta empezada.
- Bloquear cambio de carton tras iniciar partida.
- Solicitar clave/contraclave para desbloquear cambio.
- Mostrar ayuda contextual con reglas basicas del juego.

Claves de `localStorage`:

- `bingo_perm_juegoEmpezado`
- `bingo_perm_matrizCarton`
- `bingo_perm_tachados`
- `bingo_perm_bloqueo`

Algoritmo de contraclave:

```js
((clave * 3) + 7) % 10000
```

### `Bingo/monitor.html`

Monitor para cantar bolas de bingo.

Responsabilidades:

- Pantalla de login por PIN.
- El PIN del monitor se valida en Supabase mediante `validate_daily_access_code`.
- Generar tablero 1-90.
- Sacar bola aleatoria cada 4 segundos.
- Pausar/reanudar.
- Reiniciar monitor con modal propio.
- Calcular contraclave para validar carton.
- Mostrar ayuda contextual del rol de monitor.

Notas importantes:

- El PIN esta hardcodeado en cliente como `2017`.
- El algoritmo de contraclave coincide con `carton.html`.
- El monitor no persiste la partida si se recarga la pagina.


### `infiltrado/index.html`

Juego "El Infiltrado/El Infiltrado".

Responsabilidades:

- Login por clave calculada segun el dia.
- Configuracion de numero de jugadores e infiltrados.
- Asignacion aleatoria de lugar secreto e infiltrados.
- Flujo de revelado por turnos.
- Evaluacion final mediante desplegables con los nombres de participantes.
- Ayuda contextual con reglas basicas.
- Persistencia de sesion y estado en `localStorage`.

Claves principales de `localStorage`:

- `infiltrado_login_time`
- `infiltrado_fase`
- `infiltrado_jugadores`
- `infiltrado_roles`
- `infiltrado_infiltradosAsignados`
- `infiltrado_jugadorActualIndex`
- `infiltrado_lugarSecreto`
- `infiltrado_config_total`
- `infiltrado_config_infs`

Notas:

- La sesion caduca tras 5 horas.
- La clave diaria se valida en Supabase mediante `validate_daily_access_code`.
- `reiniciarTodoSistema()` borra solo claves con prefijo `infiltrado_`, evitando eliminar datos de Bingo u otras paginas del mismo origen.

### `ValentinaPlay/`

Conjunto de juegos educativos/infantiles.

Indice:

- `index.html`: menu de juegos.
- `tictactoe.html`: 3 en raya.
- `connectfour.html`: conecta cuatro.
- `number_to_number.html`: juego de secuencia numerica.
- `multiplication_hunt.html`: caza multiplicaciones.
- `guess_the_number.html`: adivina el numero de una operacion.
- `magic_clock.html`: practica de reloj.

Notas:

- Todas estas paginas usan Tailwind CSS por CDN.
- Comparten algunos estilos desde `assets/styles.css`.
- La logica esta inline en cada HTML.

### `404.html`

Pagina de error estatica con estilo coherente con Bingo.

### `Notas`

Contiene una nota de historial:

```text
29-05-2026: Se abre la rama "antesdeclaves", justo antes de meter en el monitor de bingo la clave de apertura.
```

## Ejecucion Local

Como no hay build, se puede abrir directamente:

```text
V:\Proyectos\Git\Webs\index.html
```

Recomendado para evitar diferencias entre navegador y `file://`:

```powershell
python -m http.server 8000
```

desde:

```text
V:\Proyectos\Git\Webs
```

y abrir:

```text
http://localhost:8000
```

## Dependencias Externas

- Google Fonts:
  - Manrope.
  - Comic Neue importada desde CSS.
- Tailwind CSS CDN:
  - `https://cdn.tailwindcss.com`

Implicacion:

- Varias paginas dependen de internet para verse correctamente.
- No hay version fijada de Tailwind ni copia local.

## Estado de Calidad

Fortalezas:

- Proyecto simple y facil de desplegar como sitio estatico.
- Separacion parcial de estilos mediante clases de `body`.
- Muchas interacciones usan modales propios, mejor que depender siempre de `alert/confirm`.
- Las paginas principales tienen rutas de vuelta a la portada.

Riesgos y deuda:

- Codificacion de caracteres corregida en la pasada de mantenimiento del 2026-06-01.
- Credenciales/PIN y algoritmos de acceso visibles en el cliente.
- `Privado` ya usa Supabase Auth, pero aun falta cargar permisos/proyectos reales desde la base de datos.
- El formulario de contacto no envia mensajes.
- JavaScript inline dificulta reutilizacion, pruebas y mantenimiento.
- CSS compartido muy grande y acoplado a muchas paginas.
- Dependencia de CDN para Tailwind y fuentes.
- Hay checklist manual en `TODO.md`; no hay tests automatizados.

## Convenciones Observadas

- Paginas HTML independientes.
- Estilos por pagina usando clases en `body`.
- Nombres de funciones y variables principalmente en espanol.
- Estado persistente guardado en `localStorage` con prefijos por funcionalidad.
- Navegacion relativa entre carpetas.

## Recomendacion de Evolucion

Mantener el proyecto como estatico por ahora, pero ordenar progresivamente:

1. Mantener codificacion y textos revisados en nuevas paginas.
2. Documentar uso local y despliegue.
3. Separar JavaScript por modulo/pagina.
4. Dividir CSS por areas o componentes.
5. Sustituir accesos cliente por autenticacion real si la zona privada debe proteger contenido sensible.
