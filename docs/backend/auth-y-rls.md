# Autenticación, roles y RLS

## Flujo de autenticación

1. El usuario se registra con email/password (Supabase Auth).
2. El trigger `on_auth_user_created` sobre `auth.users` ejecuta `handle_new_user()`, que inserta una fila en `public.user_profiles` con `role = 'customer'`.
3. El rol vive en `user_profiles.role` — **no en JWT claims ni en `user_metadata`** — y toda autorización se resuelve consultando esa tabla vía la función `is_admin()`.

## Roles de aplicación

Definidos por el CHECK de `user_profiles.role`:

| Rol | Quién es | Qué ve/puede |
|---|---|---|
| `customer` | Cliente minorista (default al registrarse) | Catálogo con `price_cop` |
| `customer_ws1` | Mayorista nivel 1 | `price_ws1` (y `price_ws2` por volumen) |
| `customer_ws3` | Mayorista nivel 3 | `price_ws3` (y `price_ws4` por volumen) |
| `admin` | Personal de FSP | CRUD de catálogo, perfiles e imágenes |

**Escalada de privilegios bloqueada por tres capas:**
- El INSERT de perfil propio exige `role = 'customer'`.
- El UPDATE de perfil propio exige que `role` no cambie (comparación contra el valor actual en el `WITH CHECK`).
- El trigger `prevent_role_change` rechaza cualquier cambio de `role` que no venga de `postgres` o `service_role` (es decir, solo desde el dashboard o una edge function con service key).

## Función helper

```sql
-- public.is_admin() — SECURITY INVOKER, sql
select exists (
  select 1 from public.user_profiles
  where id = (select auth.uid()) and role = 'admin'
);
```

Todas las políticas de escritura del catálogo delegan en ella.

> Nota: `is_admin()` es INVOKER y lee `user_profiles`, cuyo SELECT permite leer el perfil propio — por eso funciona dentro de las políticas sin necesitar DEFINER.

## Políticas RLS por tabla

Todas las tablas de `public` tienen RLS habilitado. Además, el event trigger `rls_auto_enable` activa RLS automáticamente en cualquier tabla nueva que se cree en `public`.

### Patrón general del catálogo

`products`, `brands`, `categories`, `product_lines` comparten el mismo patrón:

| Operación | Roles | Condición |
|---|---|---|
| SELECT | `anon`, `authenticated` | `true` — catálogo público |
| INSERT / UPDATE / DELETE | `authenticated` | `is_admin()` |

### `user_profiles`

| Política | Operación | Condición |
|---|---|---|
| `users can insert own profile` | INSERT | `auth.uid() = id` **y** `role = 'customer'` |
| `own_profile_select` | SELECT | `auth.uid() = id` **o** `is_admin()` |
| `own_profile_update` | UPDATE | Propio perfil, no-admin; `WITH CHECK` impide cambiar `role` |
| `admin_profile_update` | UPDATE | `is_admin()` (permite al admin editar cualquier perfil, incl. rol vía service role) |

No hay política DELETE — los perfiles no se borran desde el cliente.

### `storage.objects` (bucket `product-images`)

| Política | Operación | Condición |
|---|---|---|
| `public can view product images` | SELECT | `bucket_id = 'product-images'` (público) |
| `admins can upload product images` | INSERT | bucket + `is_admin()` |
| `admins can update product images` | UPDATE | bucket + `is_admin()` |
| `admins can delete product images` | DELETE | bucket + `is_admin()` |

## Observaciones de seguridad conocidas

Recogidas por los advisors de Supabase (detalle en [README.md](README.md#estado-de-salud-advisors-de-supabase)):

- `handle_new_user` y `rls_auto_enable` (SECURITY DEFINER) son ejecutables vía RPC por `anon`/`authenticated`; conviene `REVOKE EXECUTE`. En la práctica `handle_new_user` falla fuera de un trigger (no hay `NEW`), pero mejor cerrarlo.
- Las políticas `own_profile_select` / `own_profile_update` usan `auth.uid()` sin `(select ...)`, lo que se re-evalúa por fila (rendimiento, no seguridad).
- La política pública de SELECT en storage permite **listar** el bucket, no solo leer por URL.
- Leaked password protection de Auth está desactivada.
