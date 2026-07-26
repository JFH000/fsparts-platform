# Favoritos de Productos — Design Spec
**Date:** 2026-06-07
**Status:** Approved

## Overview

Los usuarios autenticados pueden marcar productos con una estrella para guardarlos como favoritos. Los favoritos se persisten en Supabase y son accesibles desde el dropdown del perfil, que navega a una página dedicada `/favorites`.

---

## Base de datos

### Tabla `product_favorites`

```sql
CREATE TABLE product_favorites (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
```

- La clave primaria compuesta `(user_id, product_id)` garantiza que no haya duplicados.
- `ON DELETE CASCADE` en ambas FKs: si se borra un usuario o un producto, sus favoritos desaparecen automáticamente.

### RLS

| Operación | Política |
|-----------|----------|
| SELECT    | `auth.uid() = user_id` |
| INSERT    | `auth.uid() = user_id` |
| DELETE    | `auth.uid() = user_id` |

No hay UPDATE (el toggle es DELETE + INSERT, nunca se modifica una fila existente).

---

## Arquitectura

### Nuevo módulo: `src/modules/favorites/`

```
src/modules/favorites/
  stores/
    favorites.store.ts   ← estado, fetch, toggle
  views/
    FavoritesView.vue    ← página /favorites
```

### Store `useFavoritesStore`

```ts
// Estado
const favoriteIds = ref<Set<string>>(new Set())

// API pública
isFavorite(productId: string): boolean
fetchFavorites(): Promise<void>           // carga desde Supabase
toggleFavorite(productId: string): Promise<void>  // optimistic UI
clearFavorites(): void                    // al cerrar sesión
```

**Optimistic UI en `toggleFavorite`:**
1. Actualiza `favoriteIds` localmente de inmediato
2. Ejecuta INSERT o DELETE en Supabase
3. Si falla, revierte el cambio local

**Inicialización:** `fetchFavorites()` se llama desde `auth.store.ts` después de un login exitoso (junto a `fetchProfile`). `clearFavorites()` se llama en `signOut()`.

---

## Componentes

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/modules/catalog/components/ProductCard.vue` | Botón estrella en esquina superior derecha de la imagen, visible al hacer hover sobre la card |
| `src/modules/catalog/views/ProductDetailView.vue` | Botón estrella siempre visible, junto al título del producto |
| `src/modules/auth/components/ProfileDropdown.vue` | Item "Mis favoritos" con ícono estrella, antes de "Editar perfil" |
| `src/modules/auth/stores/auth.store.ts` | Llamar `fetchFavorites()` en login y `clearFavorites()` en signOut |
| `src/router/index.ts` | Ruta `/favorites` con guard de autenticación |

### Creados

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/modules/favorites/stores/favorites.store.ts` | Estado reactivo de favoritos, comunicación con Supabase |
| `src/modules/favorites/views/FavoritesView.vue` | Página `/favorites` |

---

## Botón estrella — Comportamiento

- **Usuario autenticado, producto no favorito:** estrella vacía (`Star`, `text-slate-300 hover:text-amber-400`). Clic → `toggleFavorite(product.id)` → estrella llena.
- **Usuario autenticado, producto favorito:** estrella llena (`text-amber-400`). Clic → `toggleFavorite(product.id)` → estrella vacía.
- **Usuario no autenticado:** estrella vacía. Clic → `useAuthModal().open('login')`.

En `ProductCard`: el botón aparece al hacer hover sobre la card (usando el `group` de Tailwind que ya existe). Se posiciona `absolute top-2 right-2`, encima de los badges de línea de producto.

En `ProductDetailView`: siempre visible, sin hover requerido.

---

## Ruta `/favorites`

```ts
{ path: '/favorites', component: FavoritesView, meta: { requiresAuth: true } }
```

**Guard:** si el usuario no está autenticado, `useAuthModal().open('login')` y `return false` (mismo patrón que `/admin`).

### FavoritesView — Layout

- Breadcrumb: Inicio → Mis favoritos
- Título: "Mis favoritos" + contador `(N productos)`
- Grid de `ProductCard` con los productos favoritos (mismo componente del catálogo)
- **Estado vacío:** ícono de estrella, mensaje "Aún no tienes favoritos", botón "Explorar catálogo" → `/catalog`

Los productos se obtienen haciendo JOIN en Supabase: `product_favorites` → `products` con todos sus campos relacionados (brand, productLine, etc.), usando la misma query shape que el catálogo.

---

## Flujo completo

```
Usuario hace clic en ⭐ (no autenticado)
  → open('login') → modal login

Usuario hace clic en ⭐ (autenticado, no favorito)
  → favoriteIds.add(id) [inmediato]
  → INSERT INTO product_favorites
  → si error: favoriteIds.delete(id)

Usuario hace clic en ⭐ (autenticado, es favorito)
  → favoriteIds.delete(id) [inmediato]
  → DELETE FROM product_favorites
  → si error: favoriteIds.add(id)

Usuario abre ProfileDropdown → "Mis favoritos"
  → router.push('/favorites')

FavoritesView carga
  → products ya en favoriteIds → fetch detalles desde Supabase
  → renderiza grid de ProductCard
```

---

## Archivos a crear

- `src/modules/favorites/stores/favorites.store.ts`
- `src/modules/favorites/views/FavoritesView.vue`

## Archivos a modificar

- `src/modules/catalog/components/ProductCard.vue`
- `src/modules/catalog/views/ProductDetailView.vue`
- `src/modules/auth/components/ProfileDropdown.vue`
- `src/modules/auth/stores/auth.store.ts`
- `src/router/index.ts`
