# Trastero

Aplicacion privada para gestionar un inventario domestico con carpetas anidadas, items y fotos.

## Puesta en marcha

1. Aplicar `../supabase/migrations/20260617090000_trastero_carpetas_items.sql`.
2. Esta migracion sustituye la estructura antigua de espacios/zonas/cajas/objetos.
3. Asignar en `public.profiles.role` el valor `admin` a cada usuario autorizado.
4. Acceder desde `Trastero/index.html` para ver la portada o desde `Trastero/app.html` para entrar en la aplicacion autenticada.

El SQL crea o actualiza el bucket privado `trastero-fotos`; no es necesario crearlo manualmente. Las fotos se guardan bajo `{user_id}/carpetas/{id}/...` o `{user_id}/items/{id}/...`, y las politicas de Storage impiden el acceso entre usuarios.

Cada nueva foto se optimiza en navegador hasta aproximadamente 300 KB antes de subirla. Puede marcarse una foto como portada para listados y ficha.

La jerarquia de trabajo es libre: una carpeta puede contener carpetas hijas e items, sin limite practico de profundidad.

La fuente unica de SQL del proyecto es `supabase/migrations/`, junto al resto de migraciones de Webs.

## Configuracion

La aplicacion reutiliza `../assets/supabase-client.js`; no necesita variables adicionales. El bucket admite archivos originales de hasta 10 MB, pero el navegador convierte y comprime cada imagen a JPEG con un objetivo aproximado de 300 KB antes de subirla.

## Seguridad

- El frontend comprueba que el usuario autenticado tenga rol `admin`.
- RLS exige ese rol y `auth.uid() = user_id` en todas las tablas.
- Los triggers impiden asociar carpetas, items o fotos pertenecientes a otro usuario.
- El bucket es privado y las portadas usan URLs firmadas temporales.
