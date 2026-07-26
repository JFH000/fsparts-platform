# Funciones de Postgres y triggers

4 funciones en el schema `public` y 3 triggers propios (los de `storage.*` son internos de Supabase).

## Funciones

### `is_admin()` → boolean

`SECURITY INVOKER`, SQL. Helper de autorización usado por casi todas las políticas RLS.

```sql
select exists (
  select 1 from public.user_profiles
  where id = (select auth.uid()) and role = 'admin'
);
```

### `handle_new_user()` → trigger

`SECURITY DEFINER`, plpgsql. Crea el perfil al registrarse un usuario. DEFINER es necesario porque el trigger corre en el contexto de Auth y debe poder insertar en `public.user_profiles`.

```sql
begin
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, 'customer')
  on conflict (id) do nothing;
  return new;
end;
```

### `prevent_role_change()` → trigger

`SECURITY INVOKER`, plpgsql. Hace `user_profiles.role` inmutable salvo para `postgres`/`service_role`.

```sql
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'role cannot be changed';
  END IF;
  RETURN NEW;
END;
```

Implicación práctica: para cambiar el rol de un usuario hay que hacerlo desde el dashboard de Supabase (rol `postgres`) o con la service key — nunca desde el cliente.

### `rls_auto_enable()` → event trigger

`SECURITY DEFINER`, plpgsql. Event trigger a nivel de DDL: cada `CREATE TABLE` en el schema `public` recibe `ENABLE ROW LEVEL SECURITY` automáticamente. Red de seguridad contra tablas nuevas expuestas sin RLS.

## Triggers

| Trigger | Tabla | Momento | Evento | Función |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER | INSERT | `handle_new_user()` |
| `enforce_role_immutable` | `public.user_profiles` | BEFORE | UPDATE | `prevent_role_change()` |
| `no_role_change` | `public.user_profiles` | BEFORE | UPDATE | `prevent_role_change()` |

> `enforce_role_immutable` y `no_role_change` son **duplicados** — ambos ejecutan `prevent_role_change()` en el mismo evento. Es inofensivo (la validación es idempotente) pero uno de los dos sobra; probablemente quedó de dos migraciones distintas.

Además existe el **event trigger** de `rls_auto_enable()` (no aparece en `information_schema.triggers` por ser de DDL).

## Pendientes anotados por los advisors

- Fijar `search_path` en `prevent_role_change` (`SET search_path = ''` o explícito) — [lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Revocar `EXECUTE` de `handle_new_user` y `rls_auto_enable` para `anon`/`authenticated` (hoy son invocables vía `/rest/v1/rpc/...`).
