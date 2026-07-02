# EscapeTin app

EscapeTin incluye una primera version funcional para crear y jugar gincanas desde el movil.

## Pasos de Supabase

1. Abrir el proyecto de Supabase usado por `alaraz1921.com`.
2. Ir a SQL Editor.
3. Ejecutar completo el archivo `EscapeTin/supabase/escapetin_schema.sql`.
4. Crear usuarios administradores desde Supabase Auth.
5. Entrar en `/EscapeTin/admin/` con ese usuario.

## Flujo

- Administrador: crea una gincana, anade pruebas y cambia el estado a `active`.
- Participante: entra en `/EscapeTin/play/`, introduce codigo y crea equipo.
- Continuidad: el token se guarda en `localStorage` por codigo de gincana. En otro dispositivo se recupera con nombre de equipo y PIN.
- Ranking: disponible en `/EscapeTin/play/ranking.html?code=CODIGO` si la gincana lo permite.

## Notas

- No se usa GPS.
- La validacion acepta respuestas sin distinguir mayusculas/minusculas y normaliza acentos.
- Las pruebas QR funcionan abriendo la URL con `checkpoint` generada desde el panel de pruebas.
- El PIN se guarda en texto claro en esta primera version. TODO: migrarlo a hash cuando se endurezca la seguridad.
## Fases 2 y 3 incluidas

- QR de acceso y de prueba desde administracion, con visualizacion, descarga PNG y copia de enlace.
- Lectura de QR por URL y escaneo desde camara cuando el navegador soporte `BarcodeDetector`.
- Ranking ordenado por puntos y tiempo.
- Pistas con penalizacion aplicada al puntuar.
- Panel de progreso con pruebas pendientes de revision y botones aprobar/rechazar.
- Pruebas `manual` y `photo` como envio pendiente de validacion.
- Modo `free` para completar pruebas en cualquier orden.
- Temporizadores por fecha de inicio/fin y limite por equipo.
- Duplicado de gincanas completas como borrador.
- Campo `is_template` preparado para plantillas.

La subida real de archivos a Storage queda preparada a nivel de tabla `escapetin_uploads`, pero la primera interfaz de foto registra el envio para revision manual usando el nombre del archivo. Para fotos reales persistentes, el siguiente paso es conectar un bucket de Supabase Storage.