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
- JavaScript inline dentro de cada HTML.
- Tailwind CSS por CDN en las paginas de `ValentinaPlay` y en los HTML antiguos de Bingo.
- Google Fonts por CDN en la portada y zona privada.
- Persistencia local mediante `localStorage` en Bingo y El Impostor.

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
|-- index_redireccion.html
|-- Notas
|-- assets/
|   `-- styles.css
|-- images/
|   `-- IMG_1914.jpg
|-- Privado/
|   `-- index.html
|-- Bingo/
|   |-- carton.html
|   |-- monitor.html
|   |-- bingoOLD.html
|   `-- bingo_monitorOLD.html
|-- impostor/
|   `-- indeximpostor.html
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

- El formulario no envia datos reales. Hace `event.preventDefault()` y muestra un `alert`.
- Hay texto que aparece con caracteres corruptos en consola, por ejemplo acentos y simbolos. Conviene revisar codificacion real de los archivos.

### `assets/styles.css`

Hoja de estilos compartida para casi todo el sitio.

Incluye estilos para:

- Portada.
- Pagina 404.
- El Impostor.
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

Pantalla de acceso privado todavia sin autenticacion real.

Comportamiento actual:

- Pide usuario y clave.
- Al enviar, muestra "Acceso pendiente de configurar".
- No valida credenciales ni protege contenido real.

### `Bingo/carton.html`

Carton de bingo tradicional.

Responsabilidades:

- Generar carton 3x9 con 15 numeros.
- Persistir carton, estado de partida, tachados y bloqueo en `localStorage`.
- Permitir marcar numeros solo cuando la partida esta empezada.
- Bloquear cambio de carton tras iniciar partida.
- Solicitar clave/contraclave para desbloquear cambio.

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
- Generar tablero 1-90.
- Sacar bola aleatoria cada 4 segundos.
- Pausar/reanudar.
- Reiniciar monitor con modal propio.
- Calcular contraclave para validar carton.

Notas importantes:

- El PIN esta hardcodeado en cliente como `2017`.
- El algoritmo de contraclave coincide con `carton.html`.
- El monitor no persiste la partida si se recarga la pagina.

### `Bingo/bingoOLD.html` y `Bingo/bingo_monitorOLD.html`

Versiones antiguas de carton y monitor.

Notas:

- Usan Tailwind por CDN.
- Parecen conservadas como historico.
- Pueden confundir mantenimiento y navegacion si no esta claro si siguen en uso.

### `impostor/indeximpostor.html`

Juego "El Infiltrado/El Impostor".

Responsabilidades:

- Login por clave calculada segun el dia.
- Configuracion de numero de jugadores e impostores.
- Asignacion aleatoria de lugar secreto e impostores.
- Flujo de revelado por turnos.
- Evaluacion final.
- Persistencia de sesion y estado en `localStorage`.

Claves principales de `localStorage`:

- `impostor_login_time`
- `impostor_fase`
- `impostor_jugadores`
- `impostor_roles`
- `impostor_impostoresAsignados`
- `impostor_jugadorActualIndex`
- `impostor_lugarSecreto`
- `impostor_config_total`
- `impostor_config_imps`

Notas:

- La sesion caduca tras 5 horas.
- La clave se calcula como `diaDelMes + 1021`.
- `reiniciarTodoSistema()` usa `localStorage.clear()`, lo que puede borrar datos de otras paginas del mismo origen.

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

### `index_redireccion.html`

Pagina simple de redireccion. Conviene confirmar si sigue siendo necesaria.

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

- Codificacion de caracteres aparentemente dañada o mal interpretada en varios HTML/CSS.
- Credenciales/PIN y algoritmos de acceso visibles en el cliente.
- No hay autenticacion real en `Privado`.
- El formulario de contacto no envia mensajes.
- JavaScript inline dificulta reutilizacion, pruebas y mantenimiento.
- CSS compartido muy grande y acoplado a muchas paginas.
- Uso de `localStorage.clear()` en El Impostor puede borrar estado de Bingo u otras partes del sitio.
- Dependencia de CDN para Tailwind y fuentes.
- No hay pruebas manuales documentadas ni tests automatizados.
- Existen archivos `OLD` sin documentar como historico o descartables.

## Convenciones Observadas

- Paginas HTML independientes.
- Estilos por pagina usando clases en `body`.
- Nombres de funciones y variables principalmente en espanol.
- Estado persistente guardado en `localStorage` con prefijos por funcionalidad.
- Navegacion relativa entre carpetas.

## Recomendacion de Evolucion

Mantener el proyecto como estatico por ahora, pero ordenar progresivamente:

1. Corregir codificacion y textos.
2. Documentar uso local y despliegue.
3. Separar JavaScript por modulo/pagina.
4. Dividir CSS por areas o componentes.
5. Definir si `OLD` se conserva, se archiva o se elimina.
6. Sustituir accesos cliente por autenticacion real si la zona privada debe proteger contenido sensible.
