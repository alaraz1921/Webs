# TODO

Ultima revision: 2026-06-10

## Prioridad Alta

## Prioridad Media

## Prioridad Baja

## Pruebas Manuales Recomendadas

## Ideas de mejora
- [ ] IM-01 Informe de mensajes publicos
- [ ] IM-02 Informe de respuestas recibidas de invitaciones
- [ ] IM-03 La fuente de los datos de fecha, hora y lugar, que sea la misma que la del texto del datalle, solo la fuente del dato, el epigrafe mantiene la fuente actual.
- [ ] IM-04 El botón para ver en Google Maps que salga centrado en la versión para móvil
- [ ] IM-05 URL amigables
- [ ] IM-06 Cambiar la sección Galería

Quiero mejorar la sección “Recuerdos” de la página del evento.

Contexto:
Ahora mismo en móvil la sección aparece solo con el título “Recuerdos” y dos botones:
- Ver Galería
- Sube tus recuerdos

Quiero que quede más visual y atractiva, especialmente en móvil.

Objetivo:
Rediseñar la sección “Recuerdos” para que muestre una previsualización de la galería antes de los botones.

Diseño deseado:
- Título: “Recuerdos”
- Subtítulo: Aunque se vea en la imagen adjunta, no lo añadas
- Debajo, mostrar 3 miniaturas en una fila.
- Las miniaturas deben tener bordes redondeados.
- En móvil deben verse 3 miniaturas cuadradas o casi cuadradas.
- La tercera miniatura puede mostrar una capa superpuesta con el texto:
  “+24”
  o el número de fotos restantes.
- Debajo de las miniaturas, mostrar:
  “28 recuerdos compartidos”
  con un pequeño icono de imagen.
- Después, dos botones en vertical:
  1. Botón principal relleno:
     “Ver galería”
  2. Botón secundario con borde:
     “Sube tus recuerdos”

Estilo:
- Mantener la estética actual de EvenTin.
- Usar los colores del tema activo.
- Botón principal con el color del tema.
- Botón secundario blanco/transparente con borde del color del tema.
- Bordes redondeados tipo píldora.
- Mantener fondo suave y elegante.

Comportamiento:
- Si hay imágenes en la galería:
  - Mostrar hasta 3 miniaturas.
  - Si hay más de 3 fotos, en la tercera mostrar overlay con “+N”.
- Si no hay imágenes:
  - Mostrar una tarjeta vacía elegante con el texto:
    “Aún no hay recuerdos compartidos”
  - Mantener visible el botón “Sube tus recuerdos”, si procede.
- El botón “Ver galería” debe llevar a la galería pública.
- El botón “Sube tus recuerdos” debe llevar a la galería colaborativa.

Responsive:
- En escritorio mostrar 4 o 6 miniaturas si hay espacio.
- En móvil mostrar solo 3 miniaturas.
- La sección debe verse bien antes del formulario “Envía un mensaje”.


Resultado esperado:
La sección debe parecerse a la muestra de la imagen adjunta
