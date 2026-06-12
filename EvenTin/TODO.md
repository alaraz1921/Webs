# TODO

Ultima revision: 2026-06-11

## Prioridad Alta

## Prioridad Media
- [X] PM-01 Nueva gestión de invitados.

## Prioridad Baja

## Pruebas Manuales Recomendadas

## Ideas de mejora
- [ ] IM-01 Informe de mensajes publicos
- [ ] IM-03 La fuente de los datos de fecha, hora y lugar, que sea la misma que la del texto del datalle, solo la fuente del dato, el epigrafe mantiene la fuente actual.
- [ ] IM-04 El botón para ver en Google Maps que salga centrado en la versión para móvil
- [ ] IM-05 URL amigables
- [X] IM-06 Cambiar la sección Galería
- [ ] IM-07 Al compartir el enlace en WhatsApp aparezca la imagen principal y el título del evento.
- [ ] IM-08 Hacer PWA
- [X] IM-09 Añadir nueva tarjeta de datos de evento
En la tabla "eventin_events" vamos a añadir nuevos campos: "location2_name", "maps2_url", "location_title" y "location2_title"
En la tabla "eventin_event_settings" vamos a añadir los campos: "display_date2", "display_time2"
El objetivo de estos campos es el siguiente, si el campo "location_title" está relleno, este aparecerá en lugar de "Cuando y donde" de la seccion de la tarjeta del evento. 
Si el campo "location2_title" tiene valor distinto de cadena vacia se mostrará otra tarjeta igual a la anterior con los datos "display_date2", "display_time2" y location2_name" y el boton correspondiente de ver en google maps con "maps2_url" con el estilo secundario blanco/transparente con borde del color del tema.
- [X] IM-10 Confirmar asistencia. Con la nueva confirmación de asistencia basada en en el numero de telefono, ya le encuentro mas sentido a que aparezca en la pagina del evento. Situaría un boton con el estilo secundario blanco/transparente con borde del color del tema, justo antes de la sección de enviar un mensaje.
- [ ] IM-11 Modulos personalizados
- [X] IM-12 Animación al cargar datos en la pagina del evento.
