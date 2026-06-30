# TODO

Ultima revision: 2026-06-30

## Prioridad Alta

- [x] PA-01 Corregir la codificacion visible de caracteres en las paginas principales.
- [x] PA-02 Convertir `Privado/index.html` en una zona privada real con Supabase Auth.
- [x] PA-03 Validar la clave diaria de Infiltrado mediante RPC en Supabase, sin exponer la formula como validacion cliente.
- [x] PA-04 Sustituir `localStorage.clear()` de Infiltrado por borrado selectivo de claves `infiltrado_*`.
- [x] PA-05 Eliminar `Bingo/bingoOLD.html` y `Bingo/bingo_monitorOLD.html`.
- [x] PA-06 Hacer transparente el menu hamburguesa y cerrarlo al navegar.
- [x] PA-07 Unificar el acceso de Infiltrado: clave oculta, titulo independiente, `CONTROL DE ACCESO`, margen y error `CLAVE INCORRECTA`.
- [x] PA-08 Unificar el acceso de Monitor Bingo y sustituir la clave diaria por Supabase Auth.
- [x] PA-09 Separar Webs y EvenTin en proyectos Supabase independientes.
- [x] PA-10 Conectar el formulario de contacto de Webs a `webs_contact_messages` y `notify-webs-contact`.
- [x] PA-11 Implementar partidas Supabase, permisos, nuevas reglas y PWA para Bingo.
- [x] PA-12 Hacer idempotente la migracion de Bingo para permitir reejecuciones parciales.
- [x] PA-13 Sustituir el icono PWA de Bingo por la bola azul numero 21.
- [x] PA-14 Añadir acceso de instalacion PWA al panel y menu del carton de Bingo.
- [x] PA-15 Migrar Infiltrado a Supabase Auth, palabras categorizadas, partidas temporales y PWA.
- [x] PA-16 Mostrar los botones PWA solo cuando proceda, ocultarlos tras instalar y guiar la instalacion en iOS.
- [x] PA-17 Ocultar la vuelta a Games en modo PWA y limitar a 24 horas los accesos de Monitor Bingo e Infiltrado.
- [x] PA-18 Reforzar la deteccion del modo instalado y renombrar las PWA como `Bingo Alaraz1921` e `Infiltrado Alaraz1921`.
- [x] PA-19 Destacar el nombre del jugador frente a la etiqueta `Tu turno` durante el revelado de roles de Infiltrado.
- [x] PA-20 Añadir cuenta compartida, login y solicitud de registro con confirmacion de correo en `games.html`.
- [x] PA-21 Permitir acceso por alias y añadir restauracion de contraseña en Games.
- [x] PA-22 Situar la restauracion de contraseña en la pantalla de login de Games.
- [x] PA-23 Añadir proteccion anti-spam no visual al formulario de contacto de la portada.
- [x] PA-24 Preparar aviso administrativo por email para cada nuevo usuario de Supabase Auth.
- [x] PA-25 Unificar accesos a restauracion/registro desde Games y juegos, y listar usuarios en la zona privada.
- [x] PA-26 Normalizar tamaño y separacion de los controles de acceso de Monitor Bingo e Infiltrado.
- [x] PA-27 Permitir acceso por nombre de usuario en Monitor Bingo e Infiltrado.
- [x] PA-28 Eliminar accesos especiales demo y exigir usuarios reales de Supabase en Monitor Bingo e Infiltrado.
- [x] PA-29 Añadir animaciones discretas de entrada al hacer scroll en la portada y `games.html`.
- [x] PA-30 Ralentizar las animaciones de entrada y aplicarlas también a `coming-soon.html`.
- [x] PA-31 Pausar más las animaciones de entrada y aplicarlas también a `proyectos.html`.
- [x] PA-32 Evitar palabras ocultas repetidas durante una partida de Infiltrado mediante historial temporal en Supabase.
- [x] PA-33 Añadir modo online multi-dispositivo a Infiltrado reutilizando las tablas existentes y acceso invitado por token.
- [x] PA-34 Reanudar identidades online sin duplicados, recuperar al anfitrion por login y estabilizar los desplegables durante el refresco.
- [x] PA-35 Permitir al anfitrion reintentar la resolucion online hasta acertar y volver despues a la lista de jugadores.
- [x] PA-36 Permitir abandonar una partida online con confirmacion y eliminarla por completo si abandona el anfitrion.
- [x] PA-37 Validar codigos antes de pedir nombre, mejorar avisos de fin de ronda y añadir controles contextuales en Infiltrado online.
- [x] PA-38 Separar `Terminar partida` del anfitrion y `Abandonar partida` de invitados en las pantallas online correspondientes.
- [x] PA-39 Reforzar la ocultacion de `Volver a Games` al iniciar y reanudar la PWA de Infiltrado.
- [x] PA-40 Reorganizar los controles del Monitor Bingo, añadir vuelta al carton y reforzar la ocultacion de Games en su PWA.
- [x] PA-41 Añadir Trastero a Proyectos, restringir zona privada a administradores y crear gestion de usuarios.
- [x] PA-42 Convertir la gestion de usuarios a lista con modales para editar roles y confirmar borrado.
- [x] PA-43 Hacer que `Reiniciar todo desde cero` en Infiltrado local vuelva a la seleccion de modo.
- [x] PA-44 Añadir creacion de usuarios desde la gestion privada con rol general, proyecto y rol de proyecto.
- [x] PA-45 Documentar roles generales y roles por proyecto con sus permisos actuales.
- [x] PA-46 Añadir Guia Abierta a `proyectos.html` bajo TRASTER como proyecto en desarrollo.
- [x] PA-47 Hacer visible el boton de vuelta a pagina principal en `proyectos.html`.
- [x] PA-48 Sustituir los iconos PWA de Bingo e Infiltrado por los nuevos artes de Games.
- [x] PA-49 Añadir iconos decorativos inclinados a las tarjetas de `games.html`.
- [x] PA-50 Reducir la altura de las tarjetas de `games.html` para que los iconos sobresalgan de forma decorativa.
- [x] PA-51 Añadir iconos sobrios a las tarjetas disponibles de `proyectos.html`.
- [x] PA-52 Implementar validacion administrativa de usuarios con acceso temporal de 48 horas para Games, Bingo e Infiltrado.
- [x] PA-53 Corregir la visualizacion responsive de las tarjetas de gestion de usuarios.
- [x] PA-54 Sustituir los botones de pagina principal de `games.html` y `proyectos.html` por la banda superior compartida.
- [x] PA-55 Mover las acciones de sesion de Games al menu hamburguesa, cambiar la vuelta de Valentina a Games y corregir el scroll del acceso de Infiltrado.
- [x] PA-56 Hacer mas opaco el menu desplegado de Games/Proyectos y mostrar en Games solo Cerrar sesion si hay sesion activa.
- [x] PA-57 Centrar Cerrar sesion en el menu movil de Games y reforzar el scroll del acceso de Infiltrado.

## Prioridad Media

- [ ] PM-01 Crear un `README.md` raiz con descripcion del sitio, estructura, ejecucion local y rutas principales.
- [x] PM-02 Documentar el flujo de Bingo: monitor autenticado, partidas Supabase, carton publico y `localStorage`.
- [x] PM-03 Documentar el flujo de Infiltrado: Auth, categorias, partida temporal, persistencia y reinicio.
- [x] PM-04 Aplicar en Supabase Webs la migracion inicial de zona privada.
- [x] PM-05 Aplicar en Supabase Webs las funciones de clave diaria.
- [x] PM-06 Crear usuario privado en Supabase Auth y configurar acceso administrativo.
- [x] PM-07 Mostrar en `Privado/index.html` la lista de usuarios registrados desde `profiles`.
- [x] PM-08 Sustituir los `alert()` principales por modales propios.
- [x] PM-09 Persistir los numeros cantados del Monitor Bingo por id de partida en `localStorage`.
- [x] PM-10 Conectar el formulario de contacto de `index.html` a Supabase y aviso por email.
- [ ] PM-11 Fijar o reemplazar dependencias CDN, especialmente Tailwind.
- [x] PM-12 Separar la logica JavaScript principal en archivos por pagina.
- [ ] PM-13 Dividir `assets/styles.css` en archivos mas manejables.
- [ ] PM-14 Añadir una vista privada para consultar y borrar `webs_contact_messages`.
- [ ] PM-15 Revisar y eliminar del Supabase de Webs tablas antiguas `eventin_*` o tablas de eventos sin prefijo, solo si estan vacias.
- [x] PM-16 Crear el menu `PROYECTOS` y una pagina compartida `coming-soon.html` para proyectos en desarrollo.
- [x] PM-17 Crear `proyectos.html` y actualizar el mensaje editorial y metadatos comunes de Webs.
- [x] PM-18 Convertir `PROYECTOS` en enlace directo y añadir separadores al texto de presentacion.
- [ ] PM-19 Ejecutar `20260612100000_games_self_registration.sql`, activar `Confirm email` y permitir la redireccion a `games.html` en Supabase.
- [ ] PM-20 Ejecutar `20260612120000_games_username_password_recovery.sql` y permitir la URL de recuperacion en Supabase.
- [ ] PM-21 Desplegar `notify-new-user`, configurar sus secrets/Vault y ejecutar `20260612150000_notify_new_user.sql`.
- [ ] PM-22 Ejecutar `20260615150000_infiltrado_online.sql` en Supabase y validar el flujo online con varios dispositivos.
- [ ] PM-23 Ejecutar `20260615170000_infiltrado_online_resume.sql` para permitir recuperar una sala como anfitrion por codigo.
- [ ] PM-24 Ejecutar `20260615190000_infiltrado_online_retry_resolution.sql` para mantener activa la partida online tras una resolucion incorrecta.
- [ ] PM-25 Ejecutar `20260615200000_infiltrado_online_leave.sql` para habilitar el abandono seguro de partidas online.
- [ ] PM-26 Ejecutar `20260615210000_infiltrado_online_round_flow.sql` para validar codigos y habilitar los nuevos finales de ronda online.
- [ ] PM-27 Ejecutar `20260619170000_admin_user_management.sql` para habilitar el borrado seguro desde la gestion de usuarios.
- [ ] PM-28 Desplegar `admin-create-user` y confirmar que `SUPABASE_SERVICE_ROLE_KEY` esta disponible como secret de Edge Functions.
- [ ] PM-29 Ejecutar `20260630103000_games_user_approval.sql` en Supabase y redesplegar `admin-create-user`.

## Prioridad Baja

- [x] PB-01 Eliminar `index_redireccion.html`.
- [ ] PB-02 Añadir favicon y metadatos sociales basicos.
- [ ] PB-03 Mejorar accesibilidad de modales: foco inicial, cierre con Escape y roles ARIA.
- [ ] PB-04 Revisar contraste y tamanos tactiles en movil.
- [x] PB-05 Mantener una checklist manual de pruebas.
- [x] PB-06 Normalizar nombres visibles y rutas de Infiltrado.
- [ ] PB-07 Considerar mover imagenes y assets por dominio funcional si crecen.
- [ ] PB-08 Revisar y corregir comentarios/textos mojibake restantes en CSS y documentacion.

## EvenTin

La lista operativa detallada esta en `EvenTin/PROJECT_HANDOFF.md`.

- [ ] ET-01 Ejecutar `EvenTin/sql/schema.sql` actualizado en Supabase tras cambios de esquema.
- [ ] ET-02 Activar `Leaked password protection` en Supabase Auth.
- [ ] ET-03 Confirmar que `create-event-user` esta desplegada y crea usuarios correctamente.
- [ ] ET-04 Confirmar que `notify-contact` tiene secretos correctos y envia emails.
- [ ] ET-05 Probar subida y sustitucion de imagenes tras aplicar el esquema actualizado.
- [ ] ET-06 Probar flujo completo de evento, invitaciones, invitados, respuestas, mensajes y contactos.
- [ ] ET-07 Verificar dominio/remitente propio en Resend si se quiere usar `contacto@alaraz1921.com`.
- [x] ET-08 Preparar EvenTin como PWA instalable con manifest, service worker, iconos y guia iOS.

## Pruebas Manuales Recomendadas

- [ ] PR-01 Abrir `index.html` en escritorio y movil; comprobar navbar, enlace Proyectos, icono privado, H1, subtitulo, presentacion, separadores y contacto.
- [ ] PR-02 Probar `games.html`, el menu hamburguesa con cierre de sesion solo si hay sesion activa y enlaces a ValentinaPlay, Bingo, Infiltrado y EscapeTin.
- [ ] PR-03 Comprobar que los botones `Volver a Games`, incluido ValentinaPlay, regresan a `games.html`.
- [ ] PR-04 En Bingo carton: seleccionar partida, marcar numeros iniciados, limpiar y verificar persistencia.
- [ ] PR-05 En Bingo carton: comprobar cambio libre sin partida o no iniciada y bloqueo cuando `iniciada = true`.
- [ ] PR-06 En Monitor Bingo: entrar con nombre de usuario o correo autorizado; iniciar, pausar, reanudar, reiniciar y crear nueva partida.
- [ ] PR-07 En Infiltrado local: entrar con nombre de usuario o correo autorizado; repetir rondas sin palabras duplicadas y comprobar que reiniciar desde cero elimina el historial y vuelve a la seleccion de modo.
- [ ] PR-08 En ValentinaPlay: abrir cada juego y validar reinicio/victoria/flujo principal.
- [ ] PR-09 En Privado: iniciar/cerrar sesion y comprobar recordatorio de formula.
- [ ] PR-10 Enviar contacto desde Webs; comprobar fila en `webs_contact_messages` y recepcion del email.
- [ ] PR-11 Abrir una ruta inexistente para validar `404.html`.
- [ ] PR-12 Ejecutar el flujo manual completo indicado en `EvenTin/PROJECT_HANDOFF.md`.
- [ ] PR-13 Probar `proyectos.html`; comprobar la banda superior, que EvenTin abre su pagina publicada, TRASTER abre Trastero y que EvenPic, Guia Abierta y Subastas Solidarias abren `coming-soon.html`.
- [ ] PR-14 Probar registro, confirmacion de correo, login compartido, cierre de sesion y acceso a Monitor Bingo e Infiltrado desde Games.
- [ ] PR-15 Probar login por usuario y correo, solicitud de restauracion y cambio de contraseña desde el enlace recibido.
- [ ] PR-16 Probar validaciones, tiempo minimo y honeypot del formulario de contacto sin generar mensajes ni emails bloqueados.
- [ ] PR-17 Crear un usuario nuevo y comprobar confirmacion al usuario, aviso al administrador y logs de `notify-new-user`.
- [ ] PR-18 Comprobar enlaces de restauracion/registro desde Games, Monitor e Infiltrado y listado de usuarios en Privado.
- [ ] PR-19 En Infiltrado online: crear sala, unir invitados sin cuenta, iniciar, comprobar roles privados, finalizar, mostrar resultado y eliminar jugadores.
- [ ] PR-20 En Infiltrado online: reentrar como anfitrion e invitado sin indicar nombre ni duplicar jugadores y comprobar que el refresco no cierra desplegables.
- [ ] PR-21 En Infiltrado online: resolver incorrectamente y reintentar; al acertar, aceptar el modal y comprobar la vuelta a la lista de jugadores.
- [ ] PR-22 En Infiltrado online: abandonar como invitado y como anfitrion; comprobar que el anfitrion elimina la partida para todos.
- [ ] PR-23 En Infiltrado online: probar codigo inexistente, resolucion correcta, fin manual del anfitrion y los avisos previos a la lista abierta.
- [ ] PR-24 En Infiltrado online: comprobar que solo el anfitrion puede terminar desde la lista y que un invitado abandona desde su tarjeta para introducir otro codigo.
- [ ] PR-25 Abrir y reanudar la PWA instalada de Infiltrado y comprobar que nunca aparece `Volver a Games`.
- [ ] PR-26 En Monitor Bingo: probar Empezar/Pausar/Reanudar, Reiniciar, Nuevo Id, Ir a Carton y comprobar que la PWA oculta `Volver a Games`.
- [ ] PR-27 Probar `proyectos.html` con TRASTER y validar que solo administradores acceden a `Privado/` y gestionan usuarios.
- [ ] PR-28 En gestion de usuarios: buscar, abrir modal de roles, guardar cambios y borrar con confirmacion modal.
- [ ] PR-29 Instalar EvenTin desde navegador compatible y comprobar boton de instalacion, icono y arranque en modo standalone.
- [ ] PR-31 Abrir la PWA instalada de EvenTin y comprobar que arranca en `admin.html`.
- [ ] PR-30 En gestion de usuarios: crear un usuario nuevo, asignar proyecto/rol, iniciar sesion con ese usuario y comprobar su acceso.

## Ideas De Mejora

- [ ] IM-01 Convertir juegos en componentes reutilizables solo si el crecimiento lo justifica.
- [x] IM-02 Añadir ayuda contextual para Bingo e Infiltrado.
- [ ] IM-03 Documentar claramente despliegue y mantenimiento de GitHub Pages.
- [ ] IM-04 Añadir changelog o versionado visible.
- [x] IM-05 Resolver Infiltrado mediante desplegables con participantes.
- [ ] IM-06 Añadir icono/favicon para 404 y metadatos del sitio.
- [x] IM-07 Colocar ayuda de Bingo e Infiltrado en la parte inferior.
- [ ] IM-08 Añadir indicadores operativos para avisar si una Edge Function de email falla aunque el mensaje quede guardado.
- [x] IM-09 Preparar Bingo e Infiltrado como PWA con manifest, iconos y service worker.
- [x] IM-10 Registro con perfil para los dos juegos.
# Trastero

- [x] Reemplazar Trastero por aplicacion privada responsive de carpetas, items y fotos.
- [x] Añadir busqueda global y creacion contextual entre elementos.
- [x] Agilizar la creacion repetida dentro de una zona o caja y mostrar elementos relacionados en sus fichas.
- [x] Rediseñar las fichas y generar miniaturas para fotos y listados relacionados.
- [x] Sustituir espacios/zonas/cajas/objetos por jerarquia libre de carpetas/items.
- [x] Mantener los SQL de Trastero solo en `supabase/migrations/`.
- [x] Preparar migracion con RLS por usuario, rol `admin`/`trastero` y Storage privado.
- [ ] Ejecutar `supabase/migrations/20260617090000_trastero_carpetas_items.sql` en Supabase.
