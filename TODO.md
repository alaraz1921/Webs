# TODO

Ultima revision: 2026-06-12

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

## Prioridad Media

- [ ] PM-01 Crear un `README.md` raiz con descripcion del sitio, estructura, ejecucion local y rutas principales.
- [x] PM-02 Documentar el flujo de Bingo: monitor autenticado, partidas Supabase, carton publico y `localStorage`.
- [x] PM-03 Documentar el flujo de Infiltrado: Auth, categorias, partida temporal, persistencia y reinicio.
- [x] PM-04 Aplicar en Supabase Webs la migracion inicial de zona privada.
- [x] PM-05 Aplicar en Supabase Webs las funciones de clave diaria.
- [x] PM-06 Crear usuario privado en Supabase Auth y configurar acceso administrativo.
- [ ] PM-07 Cargar en `Privado/index.html` los proyectos accesibles desde `app_projects` y `project_members`.
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

## Pruebas Manuales Recomendadas

- [ ] PR-01 Abrir `index.html` en escritorio y movil; comprobar navbar, enlace Proyectos, icono privado, H1, subtitulo, presentacion, separadores y contacto.
- [ ] PR-02 Probar `games.html` y enlaces a ValentinaPlay, Bingo e Infiltrado.
- [ ] PR-03 Comprobar que los botones `Volver a Games` regresan a `games.html`.
- [ ] PR-04 En Bingo carton: seleccionar partida, marcar numeros iniciados, limpiar y verificar persistencia.
- [ ] PR-05 En Bingo carton: comprobar cambio libre sin partida o no iniciada y bloqueo cuando `iniciada = true`.
- [ ] PR-06 En Monitor Bingo: entrar como `demobingo` y admin; iniciar, pausar, reanudar, reiniciar y crear nueva partida.
- [ ] PR-07 En Infiltrado: entrar como `demo` y admin; elegir categoria, configurar jugadores, revelar roles, recargar y finalizar.
- [ ] PR-08 En ValentinaPlay: abrir cada juego y validar reinicio/victoria/flujo principal.
- [ ] PR-09 En Privado: iniciar/cerrar sesion y comprobar recordatorio de formula.
- [ ] PR-10 Enviar contacto desde Webs; comprobar fila en `webs_contact_messages` y recepcion del email.
- [ ] PR-11 Abrir una ruta inexistente para validar `404.html`.
- [ ] PR-12 Ejecutar el flujo manual completo indicado en `EvenTin/PROJECT_HANDOFF.md`.
- [ ] PR-13 Probar `proyectos.html`; comprobar que EvenTin abre su pagina publicada y que EvenPic y Subastas Solidarias abren `coming-soon.html`.
- [ ] PR-14 Probar registro, confirmacion de correo, login compartido, cierre de sesion y acceso a Monitor Bingo e Infiltrado desde Games.
- [ ] PR-15 Probar login por usuario y correo, solicitud de restauracion y cambio de contraseña desde el enlace recibido.

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
