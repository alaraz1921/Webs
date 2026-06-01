# TODO

## Prioridad Alta

- [x] PA-01 Corregir la codificacion de caracteres en HTML/CSS para que acentos, eñes, simbolos e iconos se vean correctamente.
- [x] PA-02 Definir si `Privado/index.html` sera una zona privada real o solo un placeholder; ahora usa Supabase Auth.
- [x] PA-03 Evitar publicar PINes o claves como seguridad real en cliente. Bingo Monitor e Impostor validan la clave diaria con RPC en Supabase.
- [x] PA-04 Cambiar `localStorage.clear()` en `impostor/index.html` por borrado selectivo de claves `impostor_*` para no eliminar estado de Bingo u otras paginas.
- [x] PA-05 Decidir que hacer con `Bingo/bingoOLD.html` y `Bingo/bingo_monitorOLD.html`: eliminados porque ya no se usan.
- [ ] PA-06 Al desplegar el menú hamburguesa el fondo de este no debe ser opaco, que tenga transparencia. Y parece que hay un error cuando desde el menu se pulsa en contacto, que a pesar de desplazarse a esta sección, no se cierra el menu.
- [ ] PA-07 En el panel de acceso de el impostor en la caja de la clave deben aparecer asteriscos y poner titulo a la pagina "IMPOSTOR" y al label "CONTROL DE ACCESO" le falta el icono del candado. Ademas poner un poco de margen al panel de acceso, igual que tiene el panel de acceso al bingo.
- [ ] PA-08 en el panel de accesor al monitor de bingo tambien añadir el titulo "MONITOR BINGO" y el label "CONTROL DE ACCESO" en mayusculas y el boton verde de acceder solo con el caption "ACCEDER" en mayúsculas.


## Prioridad Media

- [ ] PM-01 Crear un `README.md` con descripcion del sitio, estructura, como ejecutarlo localmente y rutas principales.
- [ ] PM-02 Documentar el flujo de Bingo: monitor, carton, PIN, clave/contraclave y comportamiento con `localStorage`.
- [ ] PM-03 Documentar el flujo de El Impostor: acceso, caducidad de sesion, configuracion, persistencia y reinicios.
- [ ] PM-04 Aplicar en Supabase la migracion `supabase/migrations/20260601110000_initial_private_schema.sql`.
- [ ] PM-05 Aplicar en Supabase la migracion `supabase/migrations/20260601113000_daily_access_codes.sql`.
- [ ] PM-06 Crear el primer usuario privado en Supabase Auth y asignarle rol `admin` en `profiles`.
- [ ] PM-07 Cargar en `Privado/index.html` los proyectos accesibles desde `app_projects` y `project_members`.
- [x] PM-08 Sustituir los `alert()` restantes por modales propios para mantener una UX consistente.
- [ ] PM-09 Hacer que el monitor de Bingo persista partida en `localStorage` si se recarga accidentalmente.
- [ ] PM-10 Revisar el formulario de contacto de `index.html`: conectar a un servicio real, usar `mailto:` o quitarlo si es decorativo.
- [ ] PM-11 Fijar o reemplazar dependencias CDN, especialmente Tailwind, para evitar cambios inesperados o fallos sin conexion.
- [x] PM-12 Separar JavaScript inline en archivos por pagina cuando el mantenimiento empiece a crecer.
- [ ] PM-13 Dividir `assets/styles.css` en secciones o archivos mas manejables si se siguen añadiendo paginas.

## Prioridad Baja

- [x] PB-01 Revisar `index_redireccion.html` y confirmar si todavia tiene uso: eliminado porque ya no se usa.
- [ ] PB-02 Añadir favicon y metadatos sociales basicos.
- [ ] PB-03 Añadir atributos de accesibilidad a modales: foco inicial, cierre con Escape y roles ARIA.
- [ ] PB-04 Revisar contraste y tamaños tactiles en moviles.
- [x] PB-05 Crear una checklist manual de pruebas para portada, ValentinaPlay, Bingo, Impostor, Privado y 404.
- [x] PB-06 Normalizar nombres de archivos y titulos visibles: El Impostor usa `impostor/index.html`.
- [ ] PB-07 Considerar mover imagenes y assets por dominio funcional si crecen.

## Pruebas Manuales Recomendadas

- [ ] PR-01 Abrir `index.html` en escritorio y movil; comprobar navbar, submenu y modal "Otros".
- [ ] PR-02 Probar enlaces a `Privado`, `ValentinaPlay`, `Bingo/carton.html`, `Bingo/monitor.html` e `impostor/index.html`.
- [ ] PR-03 En Bingo carton: generar carton, empezar partida, marcar numeros, recargar y verificar persistencia.
- [ ] PR-04 En Bingo carton: terminar partida, solicitar cambio, generar clave y validar con contraclave del monitor.
- [ ] PR-05 En Bingo monitor: entrar con PIN, comenzar, pausar, reanudar, reiniciar y calcular contraclave.
- [ ] PR-06 En El Impostor: entrar con clave del dia, configurar jugadores, revelar roles, recargar a mitad de partida y finalizar.
- [ ] PR-07 En ValentinaPlay: abrir cada juego y validar reinicio/victoria/flujo principal.
- [ ] PR-08 Abrir una ruta inexistente para validar `404.html` en el entorno de despliegue real.

## Ideas de Mejora

- [ ] IM-01 Convertir los juegos en componentes reutilizables solo si el proyecto crece lo suficiente para justificarlo.
- [x] IM-02 Añadir ayuda contextual para explicar reglas de Bingo e Impostor.
- [ ] IM-03 Preparar despliegue en GitHub Pages con instrucciones claras.
- [ ] IM-04 Añadir versionado visible o changelog si se usa en eventos/familia.
- [x] IM-05 En el juego del impostor, cambiar las cajas de texto para indicar los impostores al resolver el juego, por desplegables que contengan los nombres de los participantes.
- [ ] IM-06 Icono para el 404.
- [x] IM-07 En las pantallas de bingo e impostor, donde hemos añadido el icono de ayuda junto al titulo, mejor lo vamos a quitar de la parte superior y lo vamos a colocar en la parte inferior, aislado, bajo el boton de volver.