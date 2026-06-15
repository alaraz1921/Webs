# Trastero

Aplicacion privada para gestionar zonas, cajas, objetos y sus fotos.

## Puesta en marcha

1. Ejecutar `trastero.sql` en el SQL Editor del proyecto Supabase de Webs, o aplicar la migracion `supabase/migrations/20260616090000_trastero.sql`.
2. Asignar en `public.profiles.role` el valor `admin` o `trastero` a cada usuario autorizado.
3. Acceder desde `Privado/index.html` y pulsar `Abrir Trastero`.

El SQL crea el bucket privado `trastero-fotos`; no es necesario crearlo manualmente. Las fotos se guardan bajo `{user_id}/{tipo}s/{relacion_id}/...`, y las politicas de Storage impiden el acceso entre usuarios.

## Configuracion

La aplicacion reutiliza `../assets/supabase-client.js`; no necesita variables adicionales. El bucket admite archivos originales de hasta 10 MB, pero el navegador convierte y comprime cada imagen a JPEG con un objetivo aproximado de 300 KB antes de subirla.

## Seguridad

- El frontend comprueba que el usuario autenticado tenga rol `admin` o `trastero`.
- RLS exige ese rol y `auth.uid() = user_id` en todas las tablas.
- Los triggers impiden asociar zonas, cajas, objetos o fotos pertenecientes a otro usuario.
- El bucket es privado y las miniaturas usan URLs firmadas temporales.
