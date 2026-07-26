# Base de datos — Schema `public`

5 tablas, todas con RLS habilitado (ver [auth-y-rls.md](auth-y-rls.md) para las políticas).

## Diagrama de relaciones

```
product_lines ──┬──< categories ──< products >── brands
                └──────────────────< products

auth.users ──── user_profiles
```

## Catálogo

### `products` — 170 filas

Tabla central del catálogo. PK: `id` (uuid).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `sku` | text | **UNIQUE**. Clave de negocio del producto |
| `ref_code` | text | UNIQUE, nullable. Código de referencia alterno |
| `name` | text | |
| `slug` | text | UNIQUE. Para URLs del catálogo |
| `description` | text | default `''` |
| `brand_id` | int4 → `brands.id` | nullable |
| `category_id` | int4 → `categories.id` | nullable |
| `product_line_id` | int4 → `product_lines.id` | nullable |
| `stock` | int4 | default 0. Campo editable directamente desde el formulario de producto del admin |
| `is_featured` / `is_new` | bool | default false |
| `images` | text[] | default `{}`. Rutas dentro del bucket `product-images` |
| `specs` | jsonb | default `[]`. Lista de especificaciones técnicas |
| `refrigerants` | text[] | default `{}`. Códigos de refrigerante (R-410A, etc.) |
| `price_usd` | numeric | nullable. Precio de referencia en USD |
| `price_cop` | numeric | nullable. Precio público en COP (rol `customer`) |
| `price_ws1`…`price_ws4` | numeric | nullable. Cuatro niveles de precio mayorista |
| `created_at` | timestamptz | default `now()` |

**Lógica de precios (frontend, `useProductPrice.ts`):** `customer` ve `price_cop`; `customer_ws1` ve `price_ws1` (y `price_ws2` al comprar volumen); `customer_ws3` ve `price_ws3` (y `price_ws4` con volumen).

### `brands` — 12 filas

PK: `id` (serial). Marcas de los productos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | int4 | PK, serial |
| `name` | text | |
| `slug` | text | UNIQUE |
| `logo_url` | text | nullable |
| `country` | text | nullable |

### `categories` — 7 filas

PK: `id` (serial). Categorías, opcionalmente ligadas a una línea de producto.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | int4 | PK, serial |
| `name` | text | |
| `slug` | text | UNIQUE |
| `product_line_id` | int4 → `product_lines.id` | nullable |
| `description` | text | nullable |

### `product_lines` — 7 filas

PK: `id` (serial). Líneas de producto (nivel superior de navegación del catálogo).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | int4 | PK, serial |
| `code` | text | UNIQUE. Código corto |
| `name` | text | |
| `description` | text | default `''` |
| `icon` | text | default `'Wrench'` (nombre de ícono Lucide) |
| `slug` | text | UNIQUE |
| `product_count` | int4 | default 0. Contador desnormalizado |

## Usuarios

### `user_profiles` — 2 filas

Perfil 1:1 con `auth.users` (PK = FK a `auth.users.id`). Se crea automáticamente al registrarse (trigger `on_auth_user_created`).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` |
| `email` | text | nullable, copiado del registro |
| `full_name` | text | nullable |
| `role` | text | default `'customer'`. CHECK: `admin` \| `customer` \| `customer_ws1` \| `customer_ws3`. **Inmutable para el usuario** (trigger `prevent_role_change`; solo `postgres`/`service_role` pueden cambiarlo) |
| `phone` / `company` / `notes` | text | nullable. Datos B2B; `notes` es de uso interno del admin |
| `created_at` | timestamptz | default `now()` |

## Índices

Además de las PKs y los UNIQUE de `slug`/`sku`/`ref_code`/`code`, no hay índices adicionales definidos.

Las FKs de `products` (brand/category/line) no tienen índice propio; con ~170 filas es irrelevante, pero está anotado en los advisors (ver README).

## Migraciones aplicadas

| Versión | Nombre | Qué introdujo |
|---|---|---|
| `20260605224546` | `catalog` | Tablas del catálogo (products, brands, categories, product_lines) |
| `20260605224553` | `add_ref_code` | Columna `products.ref_code` |
| `20260605224607` | `users_roles_storage` | `user_profiles`, roles, bucket `product-images` |
| `20260605225436` | `price_default_zero` | Ajuste de defaults de precios |
| `20260605230024` | `grant_service_role` | Grants para `service_role` |
| `20260606030022` | `fix_authenticated_grants_and_admin_write_policies` | Grants + políticas de escritura admin |
| `20260606033958` | `replace_prices_with_six_tiers` | Esquema de 6 precios (usd, cop, ws1–ws4) |
| `20260606034246` | `rename_price_mxn_to_price_cop` | Renombre mxn → cop |
| `20260606035004` | `create_app_settings` | Tabla `app_settings` |
| `20260611073242` | `extend_user_profiles_ws_roles_notes_rls` | Roles `customer_ws1`/`customer_ws3`, `phone`/`company`/`notes` |
| `20260611154549` | `stock_tables` | `stock_receipts` y `stock_movements` |
| `20260611155042` | `stock_tables_fixes` | Correcciones al módulo de stock |
| `20260611164914` | `grant_stock_table_permissions` | Grants para tablas de stock |
| `20260715` | `remove_favorites_stock_settings_csv` | Drop `product_favorites`, `stock_movements`, `stock_receipts`, `app_settings`, y `update_product_stock()` |
