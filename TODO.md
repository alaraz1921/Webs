# TODO

## Prioridad Alta

- [x] Corregir la codificacion de caracteres en HTML/CSS para que acentos, eñes, simbolos e iconos se vean correctamente.
- [x] Definir si `Privado/index.html` sera una zona privada real o solo un placeholder; ahora usa Supabase Auth.
- [x] Evitar publicar PINes o claves como seguridad real en cliente. Bingo Monitor e Impostor validan la clave diaria con RPC en Supabase.
- [x] Cambiar `localStorage.clear()` en `impostor/index.html` por borrado selectivo de claves `impostor_*` para no eliminar estado de Bingo u otras paginas.
- [x] Decidir que hacer con `Bingo/bingoOLD.html` y `Bingo/bingo_monitorOLD.html`: eliminados porque ya no se usan.

## Prioridad Media

- [ ] Crear un `README.md` con descripcion del sitio, estructura, como ejecutarlo localmente y rutas principales.
- [ ] Documentar el flujo de Bingo: monitor, carton, PIN, clave/contraclave y comportamiento con `localStorage`.
- [ ] Documentar el flujo de El Impostor: acceso, caducidad de sesion, configuracion, persistencia y reinicios.
- [ ] Aplicar en Supabase la migracion `supabase/migrations/20260601110000_initial_private_schema.sql`.
- [ ] Aplicar en Supabase la migracion `supabase/migrations/20260601113000_daily_access_codes.sql`.
- [ ] Crear el primer usuario privado en Supabase Auth y asignarle rol `admin` en `profiles`.
- [ ] Cargar en `Privado/index.html` los proyectos accesibles desde `app_projects` y `project_members`.
- [x] Sustituir los `alert()` restantes por modales propios para mantener una UX consistente.
- [ ] Hacer que el monitor de Bingo persista partida en `localStorage` si se recarga accidentalmente.
- [ ] Revisar el formulario de contacto de `index.html`: conectar a un servicio real, usar `mailto:` o quitarlo si es decorativo.
- [ ] Fijar o reemplazar dependencias CDN, especialmente Tailwind, para evitar cambios inesperados o fallos sin conexion.
- [ ] Separar JavaScript inline en archivos por pagina cuando el mantenimiento empiece a crecer.
- [ ] Dividir `assets/styles.css` en secciones o archivos mas manejables si se siguen añadiendo paginas.

## Prioridad Baja

- [x] Revisar `index_redireccion.html` y confirmar si todavia tiene uso: eliminado porque ya no se usa.
- [ ] Añadir favicon y metadatos sociales basicos.
- [ ] Añadir atributos de accesibilidad a modales: foco inicial, cierre con Escape y roles ARIA.
- [ ] Revisar contraste y tamaños tactiles en moviles.
- [x] Crear una checklist manual de pruebas para portada, ValentinaPlay, Bingo, Impostor, Privado y 404.
- [x] Normalizar nombres de archivos y titulos visibles: El Impostor usa `impostor/index.html`.
- [ ] Considerar mover imagenes y assets por dominio funcional si crecen.

## Pruebas Manuales Recomendadas

- [ ] Abrir `index.html` en escritorio y movil; comprobar navbar, submenu y modal "Otros".
- [ ] Probar enlaces a `Privado`, `ValentinaPlay`, `Bingo/carton.html`, `Bingo/monitor.html` e `impostor/index.html`.
- [ ] En Bingo carton: generar carton, empezar partida, marcar numeros, recargar y verificar persistencia.
- [ ] En Bingo carton: terminar partida, solicitar cambio, generar clave y validar con contraclave del monitor.
- [ ] En Bingo monitor: entrar con PIN, comenzar, pausar, reanudar, reiniciar y calcular contraclave.
- [ ] En El Impostor: entrar con clave del dia, configurar jugadores, revelar roles, recargar a mitad de partida y finalizar.
- [ ] En ValentinaPlay: abrir cada juego y validar reinicio/victoria/flujo principal.
- [ ] Abrir una ruta inexistente para validar `404.html` en el entorno de despliegue real.

## Ideas de Mejora

- [ ] Convertir los juegos en componentes reutilizables solo si el proyecto crece lo suficiente para justificarlo.
- [x] Añadir ayuda contextual para explicar reglas de Bingo e Impostor.
- [ ] Preparar despliegue en GitHub Pages con instrucciones claras.
- [ ] Añadir versionado visible o changelog si se usa en eventos/familia.
- [x] En el juego del impostor, cambiar las cajas de texto para indicar los impostores al resolver el juego, por desplegables que contengan los nombres de los participantes.
- [ ] Icono para el 404.
