# Manual de usuario de EvenTin

Ultima actualizacion: 2026-06-09

## Acceso

EvenTin tiene una parte publica y una parte privada.

Parte publica:

- Portada: `https://alaraz1921.com/EvenTin/`
- Contacto y solicitud de evento: `contacto.html`
- Evento: `evento.html?evento=CODIGO_O_SLUG`
- Invitacion generica: `invitacion.html?evento=CODIGO_O_SLUG`
- Invitacion individual: `invitacion.html?token=TOKEN`

Parte privada:

- Panel de administracion: `admin.html`
- Gestion de invitados: `invitados.html`
- Restaurar clave: `reset-password.html`

La portada mantiene visible una banda superior con el icono de inicio de sesion a la izquierda y el acceso por codigo de evento a la derecha.

La portada muestra ejemplos visuales, los estilos disponibles y accesos al evento demo. Los botones `Crear mi evento` y `Contacto` abren el formulario independiente `contacto.html`.

Dentro del panel privado, el icono de usuario de la cabecera abre el menu de sesion. Para cerrar sesion se puede usar ese menu o el enlace `Cerrar sesion` del final; ambos solicitan confirmacion.

Hay dos tipos de usuario:

- `admin`: puede gestionar todos los eventos, usuarios, invitados, respuestas, mensajes publicos y contactos.
- `user`: usuario de evento. Solo puede gestionar el evento cuyo codigo numerico coincide con su perfil.

## Panel de administracion

El panel se abre desde `admin.html`.

Al iniciar sesion se muestra:

- El email del usuario conectado.
- El nombre del evento activo.
- Las opciones disponibles segun el rol.

Si el usuario es `admin`, puede cambiar de evento desde el desplegable. Si es `user`, se usa automaticamente su evento asignado.

## Gestion de eventos

Desde la seccion de eventos se puede:

- Crear un evento nuevo.
- Editar el nombre del evento.
- Cambiar el tipo de evento.
- Cambiar fecha y hora reales.
- Editar lugar y enlace de Google Maps.
- Ver el codigo numerico de 6 digitos, solo lectura.
- Editar textos visibles de la pagina publica.
- Subir imagen principal y detalle.
- Cambiar la paleta de color entre Clasica, Dulce, Brisa y Natura. Clasica es el estilo predeterminado.
- Copiar o abrir el enlace publico del evento.
- Copiar o abrir el enlace generico de invitacion.
- Borrar el evento mediante modal de confirmacion.

Al crear un evento, el codigo numerico se genera automaticamente.

Las imagenes se optimizan en el navegador antes de subirlas a Supabase:

- Imagen principal: ancho maximo 1600 px.
- Imagen detalle: ancho maximo 1200 px.
- Si el archivo ya pesa 500 KB o menos y es JPEG/PNG/WebP, se conserva sin reprocesar.
- Archivo optimizado objetivo: 500 KB o menos.
- Archivo optimizado limite: menos de 2.5 MB.
- Al subir una imagen nueva se borra la variante anterior aunque tuviera otra extension.

## Gestion de usuarios

Solo el administrador puede gestionar usuarios de evento.

Datos del usuario:

- Nombre.
- Email.
- Clave.
- Codigo numerico del evento.

El usuario queda asociado al evento cuyo codigo numerico coincide con `eventin_profiles.event_code`.

La creacion del usuario real de Supabase Auth se hace mediante la Edge Function `create-event-user`. Si se borra un usuario desde el panel, se borra su perfil/asignacion de EvenTin. Si se quiere eliminar por completo el acceso Auth, debe borrarse tambien desde Supabase.

## Gestion de invitados

La gestion de invitados esta en `invitados.html`. Se accede desde el boton `Gestion Invitados` del panel del evento.

Si la pagina no detecta una sesion activa, muestra un formulario de login propio.

La lista permite:

- Filtrar por nombre o telefono.
- Ordenar por nombre, telefono o estado.
- Ver invitados paginados de 10 en 10.
- Crear un invitado con el boton `Nuevo`.
- Editar con el icono de lapiz.
- Copiar el mensaje de invitacion con el icono de sobre.
- Abrir WhatsApp con el icono de WhatsApp.
- Borrar con el icono de papelera, siempre con modal de confirmacion.

Datos del invitado:

- Nombre.
- Telefono.
- Email.
- Numero de adultos.
- Numero de ninos.
- Notas.

Cada invitado tiene un `invitation_token` unico. Ese token se usa para generar el enlace individual:

```text
https://www.alaraz1921.com/EvenTin/invitacion.html?token=TOKEN
```

El telefono no se usa en la URL publica.

## Estados de invitacion

Los estados posibles del invitado son:

- `pending`: invitacion pendiente.
- `opened`: el invitado abrio su enlace individual, pero aun no confirmo.
- `confirmed`: confirmo asistencia.
- `declined`: rechazo asistencia.

Cuando un invitado abre su enlace individual por token, se marca `opened_at` si todavia estaba vacio. Si estaba en `pending`, pasa a `opened`.

## Compartir invitaciones

En la gestion de invitados hay dos formas rapidas:

- Copiar invitacion: copia un mensaje completo con saludo, texto y enlace individual.
- WhatsApp: abre `wa.me` con el mensaje preparado.

Si el invitado no tiene telefono, WhatsApp queda deshabilitado. Aun asi se puede copiar la invitacion.

Mensaje base:

```text
Hola {nombre}.

Nos encantaria compartir contigo un dia muy especial.

Puedes ver todos los detalles y confirmar tu asistencia aqui:

{enlace_invitacion}

Un abrazo.
```

## Confirmacion por invitacion individual

Cuando el invitado entra con `invitacion.html?token=TOKEN`:

1. Se busca el invitado por `invitation_token`.
2. Si existe, se muestra `Hola {nombre}`.
3. Se muestra el nombre del evento y la fecha/hora real del evento.
4. Se marca la apertura si procede.
5. El invitado puede responder:
   - Asistire: si/no.
   - Adultos confirmados.
   - Ninos confirmados.
   - Mensaje.

Al enviar:

- Si responde que si, el invitado queda en `confirmed`.
- Si responde que no, queda en `declined`.
- Se guarda o actualiza una respuesta asociada al invitado.
- Siempre se muestra `Respuesta enviada correctamente`.
- No se informa al invitado si estaba modificando una respuesta anterior.

Si el invitado no tiene telefono en su ficha, la respuesta se guarda sin telefono.

## Confirmacion por invitacion generica

La invitacion generica es:

```text
invitacion.html?evento=CODIGO_O_SLUG
```

En este caso el formulario pide nombre y telefono.

Reglas al guardar:

1. Se exige nombre.
2. Se exige telefono.
3. Se busca un invitado del mismo evento con ese telefono.
4. Si existe invitado:
   - No se cambia el nombre de su ficha.
   - No se cambia su telefono.
   - Se actualiza asistencia.
   - Se actualizan adultos y ninos.
   - Se actualiza su estado a `confirmed` o `declined`.
   - La respuesta queda vinculada a ese invitado.
5. Si no existe invitado:
   - Se crea un invitado nuevo con el nombre y telefono introducidos.
   - Se guarda adultos, ninos y estado.
   - Se crea la respuesta vinculada a ese invitado.

Esto permite que una persona conteste desde el enlace generico y quede asociada si el telefono coincide con una ficha ya existente.

## Respuestas de invitaciones

En el panel del evento se muestran las 3 ultimas respuestas.

Si hay mas, aparece `Ver todas`.

La vista completa:

- Carga respuestas por bloques con `Cargar mas`.
- Muestra el nombre del evento activo en el encabezado general del panel.
- Permite editar solo la asistencia.
- Permite borrar una respuesta mediante modal.
- Usa iconos de lapiz y papelera.

Editar una respuesta desde el panel no cambia nombre, telefono, mensaje, adultos ni ninos. Solo cambia `asistencia`.

## Mensajes publicos

Los mensajes publicos se envian desde la pagina del evento en el formulario `Enviar un mensaje`.

Se guardan en:

```text
public.eventin_public_messages
```

Datos guardados:

- Evento.
- Nombre del autor.
- Mensaje.
- Fecha de creacion.
- Visibilidad interna.

En el panel del evento se muestran los 3 ultimos mensajes. Si hay mas, aparece `Ver todos`.

La vista completa:

- Carga mensajes por bloques con `Cargar mas`.
- Muestra el nombre del evento activo en el encabezado general del panel.
- Permite borrar mensajes mediante modal.
- Usa icono de papelera.

Los mensajes publicos no se editan desde el panel.

Cuando se guarda un mensaje publico, EvenTin intenta enviar un aviso por email al usuario asignado al evento. El mensaje permanece guardado aunque el envio del correo falle.

## Avisos de respuestas de invitacion

Cuando un invitado confirma o rechaza su asistencia, EvenTin intenta enviar un aviso por email al usuario asignado al evento. El aviso resume la asistencia, numero de adultos, numero de ninos y mensaje recibido.

El destinatario se obtiene automaticamente del perfil de usuario cuyo codigo coincide con el codigo del evento. Si el evento no tiene un usuario asignado con email, no se envia aviso.

El correo es solamente una notificacion: la informacion completa y actualizada debe consultarse desde el panel de administracion.

## Mensajes de contacto

El formulario de `contacto.html` guarda mensajes en:

```text
public.eventin_contact_requests
```

Tambien intenta llamar a la Edge Function `notify-contact` para enviar aviso por email.

Si falla el email, el mensaje queda guardado igualmente en Supabase.

En el panel de administracion se pueden:

- Ver mensajes de contacto.
- Responder por email mediante `mailto:`.
- Borrar mensajes mediante modal.

## Galeria publica

La pagina del evento muestra la seccion `Recuerdos`, desde la que cualquier visitante puede abrir la galeria publica.

- Las fotografias se muestran como miniaturas y se amplian al pulsarlas.
- Los usuarios de evento y administradores que tengan una sesion iniciada pueden añadir y borrar imagenes.
- Cada imagen se optimiza antes de subirla y no puede superar 500 KB.
- Desde el panel del evento existe un enlace directo a esta galeria.

## Galeria colaborativa

La galeria colaborativa se configura desde el panel de administracion del evento:

1. Indicar una clave de acceso.
2. Marcar `Ver enlace en la pagina del evento` solo si se quiere mostrar el acceso en la pagina publica del evento.
3. Guardar la configuracion.
4. Copiar el enlace privado y compartirlo junto con la clave.

Cuando esta opcion esta marcada, la pagina del evento muestra su enlace dentro de `Recuerdos`. Desde administracion siempre se puede copiar el enlace y acceder a la galeria, aunque no se muestre en la pagina publica.

- Cualquier persona con el enlace y la clave puede ver y añadir fotografias.
- El administrador global y el usuario administrador del evento pueden borrar fotografias.
- `Iniciar presentacion` muestra las imagenes a pantalla completa de forma secuencial.
- Las fotografias se optimizan a un maximo de 500 KB.

## Restaurar clave

Desde el login del panel o desde administracion de usuarios se puede abrir `reset-password.html`.

El usuario introduce su email y Supabase envia un correo de recuperacion.

Despues de abrir el enlace recibido, se puede establecer una nueva clave.

## Enlace de credito

Todas las pantallas HTML de EvenTin muestran:

```text
Desarrollado por alaraz1921 - VJG
```

El enlace apunta a la portada de EvenTin.

## Reglas de seguridad importantes

- No se guarda ninguna clave privada en frontend.
- La web usa la anon public key de Supabase.
- Las operaciones privadas se protegen con Supabase Auth y RLS.
- Los invitados individuales se identifican por token aleatorio, nunca por telefono en la URL.
- Los usuarios de evento solo acceden al evento cuyo codigo coincide con su perfil.

## Tareas habituales

Crear evento:

1. Entrar como admin.
2. Ir a administracion de eventos.
3. Pulsar `Nuevo`.
4. Indicar nombre y tipo.
5. Guardar y editar detalles.

Crear invitado:

1. Entrar al panel.
2. Seleccionar evento.
3. Pulsar `Gestion Invitados`.
4. Pulsar `Nuevo`.
5. Guardar datos.
6. Copiar invitacion o enviar por WhatsApp.

Revisar respuestas:

1. Entrar al panel.
2. Seleccionar evento.
3. Revisar `Respuestas Invitaciones`.
4. Pulsar `Ver todas` si hay mas de 3.

Revisar mensajes publicos:

1. Entrar al panel.
2. Seleccionar evento.
3. Revisar `Mensajes publicos`.
4. Pulsar `Ver todos` si hay mas de 3.

