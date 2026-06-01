# Supabase

Este directorio contiene el esquema inicial para la base de datos de `Webs`.

## Proyecto

```text
https://nxuqkvuvmllqihaefjky.supabase.co
```

La clave `anon public` esta en `assets/supabase-client.js`. No guardar nunca la `service_role key` en el repositorio ni en codigo de frontend.

## Aplicar la primera migracion

Opcion sencilla desde el panel de Supabase:

1. Abrir el proyecto en Supabase.
2. Ir a `SQL Editor`.
3. Crear una query nueva.
4. Copiar el contenido de `migrations/20260601110000_initial_private_schema.sql`.
5. Ejecutar la query.

## Crear el primer usuario

1. Ir a `Authentication` -> `Users`.
2. Crear un usuario con email y contraseña.
3. Si debe ser administrador, ir a `Table Editor` -> `profiles` y cambiar su `role` a `admin`.

## Tablas iniciales

- `profiles`: perfil asociado a `auth.users`.
- `app_projects`: proyectos o secciones privadas.
- `project_members`: permisos de usuarios por proyecto.

Todas las tablas tienen RLS activado.
