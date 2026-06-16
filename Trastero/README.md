# Trastero

Aplicacion privada para gestionar espacios, zonas, cajas, objetos y sus fotos.

## Puesta en marcha

1. En una instalacion nueva, ejecutar `sql/trastero.sql` o aplicar las migraciones en orden.
2. En una instalacion existente de Trastero, aplicar `20260616110000_trastero_thumbnails.sql` y despues `20260616130000_trastero_espacios.sql`.
3. Asignar en `public.profiles.role` el valor `admin` o `trastero` a cada usuario autorizado.
4. Acceder desde `Privado/index.html` y pulsar `Abrir Trastero`.

El SQL crea el bucket privado `trastero-fotos`; no es necesario crearlo manualmente. Las fotos se guardan bajo `{user_id}/{tipo}s/{relacion_id}/...`, y las politicas de Storage impiden el acceso entre usuarios.

Cada nueva foto genera dos archivos: una imagen optimizada de hasta aproximadamente 300 KB y una miniatura cuadrada de 320 px para fichas y listados. Las fotos antiguas sin miniatura siguen mostrandose usando la imagen principal como respaldo.

La jerarquia de trabajo es `Espacio -> Zonas -> Cajas -> Objetos`. Al entrar en Trastero se selecciona el espacio activo; todas las listas, busquedas y altas quedan filtradas por ese espacio.

Los SQL propios del proyecto se guardan tambien en `Trastero/sql/`.

## Configuracion

La aplicacion reutiliza `../assets/supabase-client.js`; no necesita variables adicionales. El bucket admite archivos originales de hasta 10 MB, pero el navegador convierte y comprime cada imagen a JPEG con un objetivo aproximado de 300 KB antes de subirla.

## Seguridad

- El frontend comprueba que el usuario autenticado tenga rol `admin` o `trastero`.
- RLS exige ese rol y `auth.uid() = user_id` en todas las tablas.
- Los triggers impiden asociar espacios, zonas, cajas, objetos o fotos pertenecientes a otro usuario.
- El bucket es privado y las miniaturas usan URLs firmadas temporales.
