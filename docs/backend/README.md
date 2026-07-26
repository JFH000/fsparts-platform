# Backend — FSP Parts (Supabase)

Documentación del backend de Supabase que soporta el catálogo e-commerce de FSP Parts.
Generada a partir de una inspección directa del proyecto remoto (2026-07-15).

- **Proyecto:** `jcugmeuvwqjvrlrdlyyh`
- **URL del API:** `https://jcugmeuvwqjvrlrdlyyh.supabase.co`

## Índice

| Documento | Contenido |
|---|---|
| [database.md](database.md) | Tablas, columnas, relaciones, índices y migraciones |
| [auth-y-rls.md](auth-y-rls.md) | Autenticación, roles de usuario y políticas RLS |
| [funciones-y-triggers.md](funciones-y-triggers.md) | Funciones de Postgres y triggers |
| [storage.md](storage.md) | Buckets de Storage y sus políticas |

## Arquitectura general

El frontend (Vue 3 + Vite) habla directamente con Supabase — **no hay servidor de aplicación propio**. Todo el control de acceso vive en la base de datos vía RLS.

```
┌─────────────────────┐
│  Frontend (Vue 3)   │
│  src/core/supabase/ │
└──────────┬──────────┘
           │ supabase-js (clave publishable/anon)
           ▼
┌─────────────────────────────────────────────┐
│  Supabase (jcugmeuvwqjvrlrdlyyh)            │
│                                             │
│  • Postgres  → catálogo, usuarios           │
│  • Auth      → email/password + perfil      │
│  • Storage   → bucket product-images        │
└─────────────────────────────────────────────┘
```

### Cliente en el frontend

- `src/core/supabase/client.ts` crea el cliente con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback a `VITE_SUPABASE_ANON_KEY`).
- `src/core/supabase/catalog.service.ts` — lectura del catálogo (products, brands, categories, product_lines).
- `src/modules/admin/services/admin.service.ts` — CRUD de admin (catálogo, imágenes, perfiles).

## Piezas del backend en uso

| Pieza | Uso |
|---|---|
| **Postgres (schema `public`)** | 5 tablas: catálogo (4), usuarios (1) |
| **Funciones Postgres** | 4: `is_admin`, `handle_new_user`, `prevent_role_change`, `rls_auto_enable` |
| **Triggers** | Alta de perfil al registrarse, inmutabilidad del rol, RLS automático en tablas nuevas |
| **Edge Functions** | 0 en uso — `sync-sheets` quedó decomisionada del app; borrado manual desde el Dashboard de Supabase aún pendiente |
| **Storage** | 1 bucket: `product-images` (público, 5 MB, jpeg/png/webp) |
| **Extensiones activas** | `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `plpgsql` (solo las de base; nada exótico) |
| **Auth** | Email/password. El registro dispara la creación automática de `user_profiles` |

## Datos actuales (2026-07-15)

| Tabla | Filas |
|---|---|
| `products` | 170 |
| `brands` | 12 |
| `categories` | 7 |
| `product_lines` | 7 |
| `user_profiles` | 2 |

## Estado de salud (advisors de Supabase)

Avisos abiertos al momento de generar esta doc. Ninguno es crítico, pero conviene tenerlos en el radar:

### Seguridad (WARN)
- `handle_new_user` y `rls_auto_enable` son `SECURITY DEFINER` ejecutables por `anon`/`authenticated` vía RPC (`/rest/v1/rpc/...`). Conviene revocar `EXECUTE` a esos roles.
- `prevent_role_change` no fija `search_path` ([lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)).
- El bucket público `product-images` tiene una política SELECT amplia que permite **listar** todos los archivos (no solo verlos por URL) ([lint 0025](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)).
- Protección de contraseñas filtradas (HaveIBeenPwned) desactivada en Auth.

### Rendimiento (WARN/INFO)
- Políticas de `user_profiles` (`own_profile_select`, `own_profile_update`) usan `auth.uid()` sin envolver en `(select ...)` — se re-evalúa por fila ([lint 0003](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)).
- `user_profiles` tiene dos políticas permisivas de UPDATE (`admin_profile_update` + `own_profile_update`) para `authenticated`.
- Varias FKs sin índice de cobertura (`products.brand_id/category_id/product_line_id`, etc.). Irrelevante al volumen actual (~170 productos).
