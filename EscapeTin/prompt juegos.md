
Para entrar en un juego se pedirá el código del juego y el nombre del equipo participante.

Quiero ampliar el proyecto existente EscapeTin, que ya tiene landing page en:

https://www.alaraz1921.com/EscapeTin/

El objetivo es convertir EscapeTin en una web/app para crear y jugar gincanas, juegos de pistas o rutas de escape desde el móvil.

La landing page ya existe, por lo que no hay que rehacerla desde cero. Solo hay que añadir enlaces visibles a:

1. Acceso de participantes.
2. Acceso de administrador.

El proyecto convive con otros proyectos dentro del mismo repositorio y la misma infraestructura, así que todas las tablas nuevas de Supabase deben usar obligatoriamente el prefijo:
escapetin_

No usar GPS por ahora. Las pruebas se validarán mediante respuestas, palabras clave o códigos QR.

---

## Objetivo general

Implementar una aplicación dentro de EscapeTin con dos zonas principales:

1. Zona de administración:
   * Crear y gestionar gincanas.
   * Crear y gestionar pruebas.
   * Ver equipos/participantes.
   * Ver progreso y ranking.
   * Generar códigos QR.

2. Zona de participantes:
   * Acceder a una gincana mediante enlace, código o QR. 
   * Crear equipo o introducir nombre.
   * Avanzar por las pruebas.
   * Responder preguntas o introducir palabras clave.
   * Escanear QR cuando corresponda.
   * Ver puntuación, progreso y pantalla final.

---

## Consideraciones generales

* Mantener el estilo visual actual de EscapeTin.
* Diseño responsive, especialmente optimizado para móvil.
* No romper la landing page actual.
* Usar Supabase como backend.
* Usar autenticación de Supabase solo para administradores.
* Los participantes no necesitan login.
* Los participantes acceden con código, enlace o QR.
* Las rutas deben funcionar correctamente en GitHub Pages o en el entorno actual del proyecto.
* Evitar rutas absolutas que puedan romperse al estar el proyecto dentro de `/EscapeTin/`.
* Usar nombres claros y consistentes.
* Añadir comentarios en el código cuando la lógica sea importante.
* Si ya existen utilidades comunes para Supabase o auth en el proyecto, reutilizarlas.
* Si hay que crear nuevos archivos, mantener una estructura limpia dentro de la carpeta del proyecto EscapeTin.

---

# FASE 1 — Juego básico funcional

Implementar la primera versión completa y funcional del juego.

## 1. Enlaces en landing page

Añadir en la landing page existente dos accesos claros:

* “Jugar”
* “Administrar”

El enlace “Jugar” debe llevar a la pantalla pública de acceso de participantes.

El enlace “Administrar” debe llevar al login o panel de administrador.

No rediseñar toda la landing. Integrar los botones respetando el diseño actual.

---

## 2. Tablas Supabase fase 1

Crear las tablas necesarias con prefijo `escapetin_`.

### Tabla `escapetin_games`

Representa cada gincana.

Campos recomendados:

* `id` uuid primary key default gen_random_uuid()
* `title` text not null
* `description` text
* `cover_image_url` text
* `access_code` text unique not null
* `status` text not null default 'draft'

  * valores: `draft`, `active`, `finished`
* `mode` text not null default 'linear'

  * valores iniciales: `linear`
* `show_ranking` boolean not null default true
* `allow_teams` boolean not null default true
* `created_by` uuid references auth.users(id)
* `created_at` timestamptz default now()
* `updated_at` timestamptz default now()

---

### Tabla `escapetin_challenges`

Representa las pruebas de cada gincana.

Campos recomendados:

* `id` uuid primary key default gen_random_uuid()
* `game_id` uuid not null references escapetin_games(id) on delete cascade
* `title` text not null
* `description` text
* `image_url` text
* `challenge_type` text not null default 'question'

  * valores iniciales: `question`, `keyword`, `qr`, `manual`
* `question` text
* `correct_answer` text
* `keyword` text
* `points` integer not null default 10
* `order_index` integer not null default 0
* `hint_1` text
* `hint_2` text
* `hint_penalty` integer not null default 0
* `is_active` boolean not null default true
* `created_at` timestamptz default now()
* `updated_at` timestamptz default now()

---

### Tabla `escapetin_teams`

Representa equipos o participantes.

Campos recomendados:

* `id` uuid primary key default gen_random_uuid()
* `game_id` uuid not null references escapetin_games(id) on delete cascade
* `name` text not null
* `access_token` text unique not null
* `recovery_pin` text
* `total_points` integer not null default 0
* `current_challenge_order` integer not null default 0
* `started_at` timestamptz default now()
* `finished_at` timestamptz
* `created_at` timestamptz default now()

---

### Tabla `escapetin_progress`

Registra el avance de cada equipo.

Campos recomendados:

* `id` uuid primary key default gen_random_uuid()
* `game_id` uuid not null references escapetin_games(id) on delete cascade
* `team_id` uuid not null references escapetin_teams(id) on delete cascade
* `challenge_id` uuid not null references escapetin_challenges(id) on delete cascade
* `answer` text
* `is_correct` boolean not null default false
* `points_awarded` integer not null default 0
* `hints_used` integer not null default 0
* `completed_at` timestamptz
* `created_at` timestamptz default now()

Añadir una restricción para evitar que el mismo equipo complete dos veces la misma prueba:

* unique (`team_id`, `challenge_id`)

---

## 3. Seguridad y políticas RLS

Activar RLS en todas las tablas.

Reglas recomendadas:

### Administración

Los usuarios autenticados pueden gestionar sus propias gincanas:

* Insertar gincanas con `created_by = auth.uid()`.
* Ver, editar y eliminar gincanas propias.
* Gestionar pruebas de sus gincanas.
* Ver equipos y progreso de sus gincanas.

### Participantes

Los participantes no tienen login, así que se debe permitir acceso público controlado:

* Leer gincanas solo si están en estado `active`.
* Leer pruebas activas de gincanas activas.
* Crear equipo en una gincana activa.
* Crear progreso de su propio equipo usando `access_token`.

Si la política con `access_token` resulta compleja en RLS, implementar funciones RPC seguras en Supabase para:

* crear equipo
* validar respuesta
* registrar progreso
* obtener ranking
* obtener siguiente prueba

Evitar exponer operaciones peligrosas desde el cliente.

---

## 4. Panel de administración

Crear una zona privada para administradores.

Rutas o pantallas sugeridas:

* `/EscapeTin/admin/`
* `/EscapeTin/admin/login.html`
* `/EscapeTin/admin/games.html`
* `/EscapeTin/admin/game-edit.html?id=...`
* `/EscapeTin/admin/challenges.html?game=...`
* `/EscapeTin/admin/participants.html?game=...`

Adaptar la estructura exacta a la arquitectura actual del proyecto.

---

### Login administrador

* Usar Supabase Auth.
* Si el usuario no está autenticado, redirigir a login.
* Si está autenticado, mostrar panel.
* Añadir botón de cerrar sesión.

---

### Listado de gincanas

Mostrar tarjetas con:

* Título
* Estado
* Código de acceso
* Número de pruebas
* Fecha de creación
* Botón editar
* Botón pruebas
* Botón participantes/ranking
* Botón copiar enlace público
* Botón activar/finalizar

---

### Crear/editar gincana

Formulario con:

* Título
* Descripción
* Imagen de portada
* Código de acceso
* Estado: borrador / activa / finalizada
* Mostrar ranking sí/no
* Permitir equipos sí/no

El código de acceso puede generarse automáticamente, pero debe poder editarse.

---

### Crear/editar pruebas

Debe permitir:

* Crear prueba.
* Editar prueba.
* Eliminar prueba.
* Reordenar pruebas.
* Activar/desactivar prueba.
* Duplicar prueba si es sencillo.

Campos del formulario:

* Título
* Descripción
* Imagen opcional
* Tipo de prueba:

  * pregunta
  * palabra clave
  * QR
  * validación manual
* Pregunta
* Respuesta correcta
* Palabra clave
* Puntos
* Orden
* Pista 1
* Pista 2
* Penalización por usar pista

---

## 5. Pantalla pública de acceso de participantes

Crear pantalla pública para acceder a una gincana.

Rutas sugeridas:

* `/EscapeTin/play/`
* `/EscapeTin/play/index.html`
* `/EscapeTin/play/game.html?code=CODIGO`
* `/EscapeTin/play/challenge.html?team=TOKEN`

Debe permitir:

* Introducir código de gincana.
* Acceder directamente si el código viene en la URL.
* Ver portada, nombre y descripción de la gincana.
* Introducir nombre de equipo o participante.
* Crear equipo.
* Guardar `access_token` en `localStorage` para poder continuar la partida.
* Continuar partida si ya existe equipo guardado para esa gincana.

---

## 6. Pantalla de juego

La pantalla de juego debe mostrar:

* Nombre de la gincana.
* Nombre del equipo.
* Progreso: “Prueba 2 de 8”.
* Puntuación actual.
* Título de la prueba.
* Imagen si existe.
* Descripción.
* Pregunta o instrucción.
* Campo de respuesta.
* Botón “Comprobar”.
* Botón “Usar pista” si hay pistas.
* Mensajes de acierto/error.
* Botón para continuar a la siguiente prueba.

La validación debe ser flexible:

* Ignorar mayúsculas/minúsculas.
* Ignorar espacios al principio y final.
* Opcionalmente normalizar tildes para evitar errores por acentos.

Ejemplo:

* “Utrera”
* “utrera”
* “Útrera”

deberían poder validarse correctamente si la respuesta esperada es “Utrera”.

---

## 7. Pantalla final

Cuando el equipo complete todas las pruebas:

Mostrar:

* Mensaje de enhorabuena.
* Nombre del equipo.
* Puntuación final.
* Tiempo empleado si está disponible.
* Ranking si la gincana lo permite.
* Botón para volver al inicio.

---

# FASE 2 — QR, ranking y pistas con penalización

Implementar funcionalidades adicionales para hacer el juego más completo.

---

## 1. Generación de QR

Desde el panel de administración, en cada gincana y en cada prueba, añadir opción para generar QR.

Tipos de QR:

### QR de acceso a gincana

Debe llevar a la pantalla pública de entrada:

`/EscapeTin/play/?code=CODIGO`

### QR de prueba

Debe llevar a una URL que desbloquee o valide una prueba concreta.

Ejemplo:

`/EscapeTin/play/challenge.html?game=CODIGO&checkpoint=TOKEN_PRUEBA`

Para esto puede añadirse un campo en `escapetin_challenges`:

* `qr_token` text unique

Si no existe, generarlo automáticamente.

---

## 2. Descarga de QR

Permitir:

* Ver QR en pantalla.
* Descargar QR como PNG.
* Copiar enlace del QR.
* Imprimir o preparar para imprimir.

Usar una librería ligera de generación QR en cliente si encaja bien con el proyecto.

---

## 3. Escaneo QR desde móvil

Añadir un botón en la pantalla de juego:

* “Escanear QR”

Debe abrir la cámara del móvil dentro de la web/PWA si el navegador lo permite.

Al escanear:

* Leer el contenido del QR.
* Comprobar si corresponde a la gincana/prueba actual.
* Si es válido, desbloquear o completar la prueba según el tipo.

Si el escaneo con cámara complica demasiado la implementación, dejar al menos preparada la lectura por URL de QR, de forma que al escanear con la cámara normal del móvil se abra directamente la pantalla correcta.

---

## 4. Pruebas tipo QR

Para `challenge_type = 'qr'`:

* El jugador no debe introducir respuesta manual.
* Debe escanear el QR correcto o abrir el enlace del QR.
* Al validar el QR correcto, se completa la prueba y se suman los puntos.

---

## 5. Ranking

Crear ranking por gincana.

Debe ordenar por:

1. Mayor puntuación.
2. En caso de empate, menor tiempo empleado.
3. Si sigue el empate, equipo que terminó antes.

Mostrar ranking:

* En pantalla final del jugador.
* En panel de administración.
* Opcionalmente en una pantalla pública de ranking.

Ruta sugerida:

`/EscapeTin/play/ranking.html?code=CODIGO`

El ranking debe respetar `show_ranking`.

---

## 6. Pistas con penalización

Implementar uso de pistas.

Cada prueba puede tener:

* Pista 1.
* Pista 2.
* Penalización por pista.

Funcionamiento:

* El jugador pulsa “Usar pista”.
* Se muestra la pista disponible.
* Se registra que el equipo ha usado una pista.
* Al acertar la prueba, se restan los puntos correspondientes.

Ejemplo:

* Prueba vale 10 puntos.
* Usa 1 pista.
* Penalización 2 puntos.
* Recibe 8 puntos.

No permitir puntuación negativa. El mínimo debe ser 0.

---

## 7. Panel de progreso en directo

En administración, crear pantalla para ver equipos en directo:

* Equipo
* Puntos
* Pruebas completadas
* Prueba actual
* Última actividad
* Finalizado sí/no

No es obligatorio usar Supabase Realtime, pero si ya está disponible en el proyecto se puede usar para refresco automático.

Si no, usar recarga manual o refresco periódico sencillo.
Intentar usar Supabase Realtime.

---

# FASE 3 — Retos avanzados y mejoras

Implementar funcionalidades avanzadas para dejar la aplicación más completa.

---

## 1. Tabla de subidas

Crear tabla:

### `escapetin_uploads`

Campos recomendados:

* `id` uuid primary key default gen_random_uuid()
* `game_id` uuid not null references escapetin_games(id) on delete cascade
* `team_id` uuid not null references escapetin_teams(id) on delete cascade
* `challenge_id` uuid not null references escapetin_challenges(id) on delete cascade
* `file_url` text not null
* `file_type` text
* `status` text not null default 'pending'

  * valores: `pending`, `approved`, `rejected`
* `created_at` timestamptz default now()

---

## 2. Retos con foto

Añadir un nuevo tipo de prueba:

* `photo`

Funcionamiento:

* El jugador debe subir una foto para completar la prueba.
* La foto queda registrada.
* Puede haber dos modos:

  * Autovalidación: se da por completada al subir la foto.
  * Validación manual: el administrador aprueba o rechaza.

Añadir en `escapetin_challenges` si hace falta:

* `requires_admin_validation` boolean default false

---

## 3. Validación manual

Para pruebas tipo `manual` o `photo`:

* El jugador envía respuesta o foto.
* El estado queda pendiente.
* El administrador puede aprobar o rechazar.
* Si aprueba, se suman puntos.
* Si rechaza, el equipo puede intentarlo de nuevo si se permite.

---

## 4. Modo libre

Añadir modo de juego:

* `free`

En modo libre:

* Los equipos pueden ver todas las pruebas activas.
* Pueden completarlas en cualquier orden.
* El progreso se calcula por pruebas completadas, no por orden.

Mantener el modo `linear` como modo principal.

---

## 5. Temporizador

Añadir campos opcionales en `escapetin_games`:

* `starts_at` timestamptz
* `ends_at` timestamptz
* `time_limit_minutes` integer

Funcionamiento:

* Si la gincana no ha comenzado, mostrar mensaje.
* Si ha terminado, impedir nuevas respuestas.
* Si hay tiempo límite por equipo, calcular desde `started_at`.

---

## 6. Duplicar gincana

Desde administración, permitir duplicar una gincana completa:

* Copiar datos principales.
* Copiar pruebas.
* Generar nuevo código de acceso.
* Dejarla en estado `draft`.
* No copiar equipos ni progreso.

Esto será útil para reutilizar plantillas.

---

## 7. Plantillas

Opcionalmente, permitir marcar una gincana como plantilla.

Añadir en `escapetin_games`:

* `is_template` boolean default false

---

## 8. Mejoras PWA

Si EscapeTin ya es PWA o se quiere convertir en PWA:

* Revisar manifest.
* Asegurar iconos.
* Asegurar nombre de app.
* Permitir instalación.
* Mejorar experiencia móvil.
* Ocultar botón de instalación si ya se accede desde PWA.
* Mantener funcionamiento correcto desde navegador normal.

---

# Requisitos de interfaz

## Estilo general

Mantener un estilo tipo aventura, pistas, escape, mapa o misión.

Usar elementos visuales como:

* Tarjetas.
* Iconos de pista.
* Iconos de candado.
* Iconos de mapa.
* Iconos de QR.
* Barra de progreso.
* Mensajes de logro.

La experiencia debe ser divertida, clara y sencilla.

---

## Textos sugeridos

Usar textos cercanos y motivadores.

Ejemplos:

* “Comenzar aventura”
* “Siguiente pista”
* “Prueba superada”
* “Necesito una pista”
* “Escanear QR”
* “Código correcto”
* “Respuesta incorrecta, inténtalo de nuevo”
* “¡Gincana completada!”
* “Ver ranking”
* “Crear nueva gincana”
* “Añadir prueba”
* “Activar juego”

---

# Requisitos técnicos importantes

* Todas las tablas deben empezar por `escapetin_`.
* No usar GPS.
* Usar QR o palabras clave para validar ubicación/pruebas.
* No romper otros proyectos del repositorio.
* No modificar configuraciones globales si no es necesario.
* Mantener compatibilidad con GitHub Pages.
* Revisar rutas relativas por estar dentro de `/EscapeTin/`.
* Evitar exponer claves privadas.
* No usar service role key en el frontend.
* No guardar secretos en JavaScript público.
* Usar la anon key de Supabase solo donde corresponda.
* Añadir SQL de creación de tablas y políticas en un archivo separado, por ejemplo:

  * `EscapeTin/supabase/escapetin_schema.sql`
* Si se crean funciones RPC, incluirlas también en el SQL.
* Documentar brevemente los pasos necesarios para aplicar el SQL en Supabase.

---

# Entregables esperados

Implementar o preparar:

1. Enlaces nuevos en la landing existente:

   * Jugar
   * Administrar

2. Pantallas públicas:

   * Acceso a gincana.
   * Crear/continuar equipo.
   * Juego/prueba actual.
   * Pantalla final.
   * Ranking.

3. Pantallas de administración:

   * Login.
   * Listado de gincanas.
   * Crear/editar gincana.
   * Crear/editar pruebas.
   * Participantes/progreso.
   * Ranking.
   * Generación de QR.

4. Supabase:

   * SQL completo con tablas `escapetin_`.
   * Políticas RLS.
   * Índices necesarios.
   * Funciones RPC si son necesarias.

5. Funciones de juego:

   * Crear equipo.
   * Continuar partida.
   * Validar respuesta.
   * Completar prueba.
   * Calcular puntos.
   * Usar pistas.
   * Mostrar ranking.
   * Finalizar gincana.

6. QR:

   * Generar QR de acceso.
   * Generar QR por prueba.
   * Descargar QR.
   * Leer QR por URL.
   * Preparar escaneo desde cámara si es viable.

7. Fase 3:

   * Subida de fotos.
   * Validación manual.
   * Modo libre.
   * Temporizador.
   * Duplicar gincana.
   * Mejoras PWA.

---

# Prioridad de implementación

Si el trabajo es demasiado amplio para hacerlo de una sola vez, implementar primero la Fase 1 completamente funcional, dejando preparadas la estructura y las tablas para las fases 2 y 3.

Prioridad:

1. Fase 1 funcional.
2. QR y ranking.
3. Pistas con penalización.
4. Panel de progreso.
5. Fotos y validación manual.
6. Modo libre.
7. Temporizador.
8. Duplicar gincanas.
9. Mejoras PWA.

---

# Resultado esperado

Al finalizar, EscapeTin debe permitir que un administrador cree una gincana desde el panel privado, añada pruebas, active el juego y comparta un enlace o QR con los participantes.

Los participantes deben poder entrar desde el móvil sin iniciar sesión, crear su equipo, avanzar por las pruebas, responder preguntas o introducir palabras clave, sumar puntos y ver el resultado final.

Todo debe quedar preparado para que el proyecto pueda reutilizarse en diferentes gincanas, eventos, pueblos, colegios, cumpleaños o actividades familiares.


# Prompt adicional
Añadir gestión de continuidad de partida para participantes sin login.

Los participantes no tendrán cuenta ni autenticación, pero deben poder continuar la partida si cierran la web, recargan la página, apagan la pantalla o vuelven a entrar más tarde.

Implementar el sistema así:

1. Al crear un equipo/participante en `escapetin_teams`, generar:

   * `access_token`: token único, largo y seguro.
   * `recovery_pin`: PIN corto de recuperación, preferiblemente de 4 a 6 dígitos.

2. Guardar el `access_token` en `localStorage` del navegador usando una clave específica por gincana, por ejemplo:

   * `escapetin_team_token_<game_code>`

3. Cuando el participante vuelva a entrar a una gincana:

   * comprobar si existe token local para esa gincana;
   * si existe, recuperar el equipo desde Supabase;
   * mostrar opción “Continuar como [nombre del equipo]”;
   * llevarlo a la prueba actual.

4. Añadir una opción en la pantalla de acceso:

   * “Ya habíamos empezado”
   * “Continuar partida”

5. Para recuperar desde otro dispositivo o si se pierde el `localStorage`, permitir recuperar partida usando:

   * código de gincana
   * nombre del equipo
   * PIN de recuperación

6. Al crear el equipo, mostrar claramente el PIN:

   * “Tu PIN de recuperación es 4821”
   * “Guárdalo o haz una captura de pantalla para poder continuar desde otro dispositivo.”

7. No permitir recuperar una partida solo por nombre de equipo. Debe requerir PIN.

8. Añadir a `escapetin_teams` los campos necesarios:

   * `access_token text unique not null`
   * `recovery_pin text`
   * opcionalmente `recovery_pin_hash text` si se implementa de forma más segura.

9. Si se puede implementar de forma segura, guardar hash del PIN en vez del PIN en texto claro. Si complica demasiado la primera versión, usar `recovery_pin` en texto claro y dejar comentario TODO para mejorar seguridad.

10. Crear funciones o lógica para:

* crear equipo con token y PIN;
* continuar equipo desde token local;
* recuperar equipo con nombre + PIN;
* guardar de nuevo el token en `localStorage` tras recuperar partida.

11. La experiencia esperada es:

* mismo móvil/navegador: continuación automática;
* otro móvil/navegador: recuperación con nombre de equipo y PIN.
