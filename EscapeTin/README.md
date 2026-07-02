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