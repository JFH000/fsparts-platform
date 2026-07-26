# Favoritos de Productos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuarios autenticados marquen productos como favoritos con una estrella y los vean en una página dedicada `/favorites` accesible desde el dropdown del perfil.

**Architecture:** Un store Pinia `useFavoritesStore` mantiene un `Set<string>` de IDs de productos favoritos del usuario actual, cargado al iniciar sesión. La estrella en cada `ProductCard` y `ProductDetailView` usa ese Set para mostrar estado. `FavoritesView` filtra los productos del catálogo por los IDs favoritos. El store de autenticación orquesta carga y limpieza del store de favoritos en el ciclo de vida del auth.

**Tech Stack:** Vue 3, Pinia, Supabase (PostgREST), Tailwind CSS v4, @lucide/vue, TypeScript.

---

## Estructura de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Crear | `src/core/supabase/favorites.service.ts` | Queries a Supabase: fetchFavoriteIds, insertFavorite, deleteFavorite |
| Crear | `src/modules/favorites/stores/favorites.store.ts` | Estado reactivo de favoritos, toggle optimista |
| Crear | `src/modules/favorites/views/FavoritesView.vue` | Página `/favorites` con grid de productos |
| Modificar | `src/modules/auth/stores/auth.store.ts` | Llamar fetch/clear favoritos en login/logout |
| Modificar | `src/modules/catalog/stores/catalog.store.ts` | Exponer `allProducts` en el return |
| Modificar | `src/modules/auth/components/ProfileDropdown.vue` | Añadir item "Mis favoritos" |
| Modificar | `src/modules/catalog/components/ProductCard.vue` | Añadir botón estrella en hover |
| Modificar | `src/modules/catalog/views/ProductDetailView.vue` | Añadir botón estrella siempre visible |
| Modificar | `src/router/index.ts` | Guard `requiresUser` + ruta `/favorites` |

---

## Task 1: Base de datos — tabla product_favorites + RLS

**Files:**
- Base de datos Supabase (SQL Editor o MCP `execute_sql`)

- [ ] **Step 1: Crear tabla y RLS**

Ejecutar en Supabase SQL Editor o vía MCP `execute_sql`:

```sql
-- Tabla de favoritos
CREATE TABLE public.product_favorites (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- Habilitar RLS
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;

-- SELECT: solo los propios
CREATE POLICY "users can read own favorites"
  ON public.product_favorites FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- INSERT: solo los propios
CREATE POLICY "users can insert own favorites"
  ON public.product_favorites FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: solo los propios
CREATE POLICY "users can delete own favorites"
  ON public.product_favorites FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

- [ ] **Step 2: Verificar**

Ejecutar:
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'product_favorites';
```
Esperado: 3 filas — SELECT, INSERT, DELETE.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: create product_favorites table with RLS in Supabase"
```

---

## Task 2: favorites.service.ts — queries Supabase

**Files:**
- Create: `src/core/supabase/favorites.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// src/core/supabase/favorites.service.ts
import { supabase } from './client'

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('product_favorites')
    .select('product_id')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []).map((r: { product_id: string }) => r.product_id)
}

export async function insertFavorite(userId: string, productId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('product_favorites')
    .insert({ user_id: userId, product_id: productId })
}

export async function deleteFavorite(userId: string, productId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('product_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/supabase/favorites.service.ts
git commit -m "feat: add favorites Supabase service (fetchFavoriteIds, insert, delete)"
```

---

## Task 3: favorites.store.ts — estado reactivo

**Files:**
- Create: `src/modules/favorites/stores/favorites.store.ts`

- [ ] **Step 1: Crear el store**

```typescript
// src/modules/favorites/stores/favorites.store.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchFavoriteIds, insertFavorite, deleteFavorite } from '@/core/supabase/favorites.service'

export const useFavoritesStore = defineStore('favorites', () => {
  const favoriteIds = ref<Set<string>>(new Set())

  function isFavorite(productId: string): boolean {
    return favoriteIds.value.has(productId)
  }

  async function fetchFavorites(userId: string): Promise<void> {
    const ids = await fetchFavoriteIds(userId)
    favoriteIds.value = new Set(ids)
  }

  async function toggleFavorite(userId: string, productId: string): Promise<void> {
    const wasFavorite = favoriteIds.value.has(productId)

    // Optimistic update
    if (wasFavorite) {
      favoriteIds.value.delete(productId)
    } else {
      favoriteIds.value.add(productId)
    }
    // Trigger reactivity on Set mutation
    favoriteIds.value = new Set(favoriteIds.value)

    try {
      if (wasFavorite) {
        await deleteFavorite(userId, productId)
      } else {
        await insertFavorite(userId, productId)
      }
    } catch {
      // Revert on error
      if (wasFavorite) {
        favoriteIds.value.add(productId)
      } else {
        favoriteIds.value.delete(productId)
      }
      favoriteIds.value = new Set(favoriteIds.value)
    }
  }

  function clearFavorites(): void {
    favoriteIds.value = new Set()
  }

  return { favoriteIds, isFavorite, fetchFavorites, toggleFavorite, clearFavorites }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/favorites/stores/favorites.store.ts
git commit -m "feat: add useFavoritesStore with optimistic toggle"
```

---

## Task 4: auth.store.ts — wiring con favorites

**Files:**
- Modify: `src/modules/auth/stores/auth.store.ts`

Estado actual del archivo clave en `_init()` (líneas 54–67):
```typescript
return new Promise<void>((resolve) => {
  supabase!.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    const resolveReady = () => {
      if (!isReady.value) { isReady.value = true; resolve() }
    }
    if (user.value) {
      fetchProfile(user.value.id).finally(resolveReady)
    } else {
      profile.value = null
      resolveReady()
    }
  })
})
```

- [ ] **Step 1: Añadir import del favorites store**

Agregar al bloque de imports (después del import de supabase):
```typescript
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
```

- [ ] **Step 2: Modificar _init para llamar fetch/clear de favoritos**

Reemplazar el bloque `if (user.value) { ... } else { ... }` dentro de `onAuthStateChange`:

```typescript
if (user.value) {
  const favStore = useFavoritesStore()
  Promise.all([
    fetchProfile(user.value.id),
    favStore.fetchFavorites(user.value.id),
  ]).finally(resolveReady)
} else {
  profile.value = null
  const favStore = useFavoritesStore()
  favStore.clearFavorites()
  resolveReady()
}
```

- [ ] **Step 3: Verificar que el archivo compila**

```bash
npx tsc --noEmit
```
Esperado: sin errores relacionados con `favorites`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/stores/auth.store.ts
git commit -m "feat: wire favorites fetch/clear into auth lifecycle"
```

---

## Task 5: catalog.store.ts — exponer allProducts

**Files:**
- Modify: `src/modules/catalog/stores/catalog.store.ts`

El return del store (líneas 176+) no expone `allProducts`. La `FavoritesView` necesita acceder a todos los productos para filtrar por IDs favoritos.

- [ ] **Step 1: Añadir allProducts al return**

Localizar el bloque `return {` y añadir `allProducts` en la sección `// data`:

```typescript
return {
  // state
  isLoading,
  filters,
  sortBy,
  searchInput,
  // data
  allProducts,          // ← añadir esta línea
  productLines:  allProductLines,
  brands:        allBrands,
  categories:    allCategories,
  refrigerants:  allRefrigerants,
  maxPrice,
  // ... resto igual
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/catalog/stores/catalog.store.ts
git commit -m "feat: expose allProducts from catalog store for favorites filtering"
```

---

## Task 6: router/index.ts — guard requiresUser + ruta /favorites

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Añadir ruta /favorites**

Dentro del bloque `children` de ShopLayout, agregar después de `hvac-calculator`:

```typescript
{ path: 'favorites', name: 'favorites', meta: { requiresUser: true }, component: () => import('@/modules/favorites/views/FavoritesView.vue') },
```

- [ ] **Step 2: Añadir guard requiresUser en beforeEach**

El guard actual (líneas 44–58):
```typescript
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.isReady) await authStore.init()

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
    if (!authStore.isAdmin) return { name: 'landing' }
  }

  return true
})
```

Reemplazar por:
```typescript
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.isReady) await authStore.init()

  if (to.meta.requiresUser && !authStore.isAuthenticated) {
    const { open } = useAuthModal()
    open('login')
    return false
  }

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
    if (!authStore.isAdmin) return { name: 'landing' }
  }

  return true
})
```

- [ ] **Step 3: Extender el tipo de meta para TypeScript**

Buscar si existe `src/router/index.ts` o `src/env.d.ts` con declaración de `RouteMeta`. Si no existe, añadir al final de `src/router/index.ts`:

```typescript
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresUser?: boolean
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add /favorites route with requiresUser guard"
```

---

## Task 7: FavoritesView.vue

**Files:**
- Create: `src/modules/favorites/views/FavoritesView.vue`

- [ ] **Step 1: Crear la vista**

```vue
<!-- src/modules/favorites/views/FavoritesView.vue -->
<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Breadcrumb + título -->
    <div class="mb-6">
      <nav class="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <RouterLink to="/" class="hover:text-brand-600">Inicio</RouterLink>
        <ChevronRight class="h-3 w-3" />
        <span class="text-slate-700 font-medium">Mis favoritos</span>
      </nav>
      <h1 class="text-2xl font-bold text-slate-900">Mis favoritos</h1>
      <p class="text-slate-500 text-sm mt-1">{{ favoriteProducts.length }} producto{{ favoriteProducts.length !== 1 ? 's' : '' }}</p>
    </div>

    <!-- Loading -->
    <div v-if="catalogStore.isLoading" class="flex justify-center py-20">
      <div class="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
    </div>

    <!-- Grid -->
    <div v-else-if="favoriteProducts.length > 0" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      <ProductCard
        v-for="product in favoriteProducts"
        :key="product.id"
        :product="product"
      />
    </div>

    <!-- Estado vacío -->
    <div v-else class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Star class="h-8 w-8 text-slate-300" />
      </div>
      <h3 class="text-lg font-semibold text-slate-700 mb-2">Aún no tienes favoritos</h3>
      <p class="text-slate-400 text-sm mb-6">Marca productos con ⭐ para guardarlos aquí</p>
      <RouterLink
        to="/catalog"
        class="bg-brand-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors"
      >
        Explorar catálogo
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ChevronRight, Star } from '@lucide/vue'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'
import { useFavoritesStore } from '../stores/favorites.store'
import ProductCard from '@/modules/catalog/components/ProductCard.vue'

const catalogStore  = useCatalogStore()
const favoritesStore = useFavoritesStore()

const favoriteProducts = computed(() =>
  catalogStore.allProducts.filter(p => favoritesStore.isFavorite(p.id))
)

onMounted(() => {
  if (!catalogStore.isLoading && catalogStore.allProducts.length === 0) {
    catalogStore.initialize()
  }
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/favorites/views/FavoritesView.vue
git commit -m "feat: add FavoritesView page at /favorites"
```

---

## Task 8: ProductCard.vue — botón estrella

**Files:**
- Modify: `src/modules/catalog/components/ProductCard.vue`

El card ya tiene `class="group ..."` en el contenedor raíz y `class="absolute top-2 left-2 ..."` para los badges. El botón estrella va en `absolute top-2 right-2`.

- [ ] **Step 1: Añadir imports en el script**

El bloque `<script setup>` actual importa `{ ref }` de vue y varios íconos. Añadir:

```typescript
import { Star } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'

const authStore      = useAuthStore()
const favoritesStore = useFavoritesStore()
const { open }       = useAuthModal()

function handleFavorite() {
  if (!authStore.isAuthenticated) {
    open('login')
    return
  }
  favoritesStore.toggleFavorite(authStore.user!.id, props.product.id)
}
```

- [ ] **Step 2: Añadir botón estrella en el template**

Dentro del bloque `<RouterLink :to="..." class="block relative ...">`, justo después del div de badges (`absolute top-2 left-2`), añadir:

```html
<!-- Favorite button -->
<button
  @click.prevent="handleFavorite"
  class="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
  :title="favoritesStore.isFavorite(product.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'"
>
  <Star
    class="h-4 w-4 transition-colors"
    :class="favoritesStore.isFavorite(product.id)
      ? 'text-amber-400 fill-amber-400'
      : 'text-slate-400'"
  />
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/catalog/components/ProductCard.vue
git commit -m "feat: add favorite star button to ProductCard"
```

---

## Task 9: ProductDetailView.vue — botón estrella

**Files:**
- Modify: `src/modules/catalog/views/ProductDetailView.vue`

El botón va en la sección `<!-- Info -->` (columna derecha), después del `<h1>` del nombre del producto (línea 83).

- [ ] **Step 1: Añadir imports en el script**

El script actual importa `{ ref, computed }` y varios íconos. Añadir:

```typescript
import { Star } from '@lucide/vue'
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'

const favoritesStore = useFavoritesStore()
const { open }       = useAuthModal()

function handleFavorite() {
  if (!auth.isAuthenticated) {
    open('login')
    return
  }
  if (!product.value) return
  favoritesStore.toggleFavorite(auth.user!.id, product.value.id)
}
```

- [ ] **Step 2: Añadir botón estrella en el template**

Después del `<h1 class="text-3xl ...">{{ product.name }}</h1>` (línea 83), añadir:

```html
<!-- Favorite button -->
<button
  @click="handleFavorite"
  class="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-all"
  :class="favoritesStore.isFavorite(product.id)
    ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'"
>
  <Star
    class="h-4 w-4 transition-colors"
    :class="favoritesStore.isFavorite(product.id) ? 'text-amber-400 fill-amber-400' : ''"
  />
  {{ favoritesStore.isFavorite(product.id) ? 'En favoritos' : 'Añadir a favoritos' }}
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/catalog/views/ProductDetailView.vue
git commit -m "feat: add favorite star button to ProductDetailView"
```

---

## Task 10: ProfileDropdown.vue — item Mis favoritos

**Files:**
- Modify: `src/modules/auth/components/ProfileDropdown.vue`

- [ ] **Step 1: Añadir import de Star y useRouter**

El script actual importa `{ Pencil, LogOut }` de `@lucide/vue` y `useAuthModal`. Añadir:

```typescript
import { Pencil, LogOut, Star } from '@lucide/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function onFavorites() {
  isOpen.value = false
  router.push('/favorites')
}
```

- [ ] **Step 2: Añadir item en el template**

En el bloque `<!-- Acciones -->` del dropdown, antes del botón "Editar perfil":

```html
<button class="dropdown-item" @click="onFavorites">
  <Star class="h-3.5 w-3.5 flex-shrink-0" />
  Mis favoritos
</button>
<div class="dropdown-divider" />
```

El bloque completo de acciones debe quedar:

```html
<div class="dropdown-body">
  <button class="dropdown-item" @click="onFavorites">
    <Star class="h-3.5 w-3.5 flex-shrink-0" />
    Mis favoritos
  </button>
  <div class="dropdown-divider" />
  <button class="dropdown-item" @click="onEditProfile">
    <Pencil class="h-3.5 w-3.5 flex-shrink-0" />
    Editar perfil
  </button>
  <div class="dropdown-divider" />
  <button class="dropdown-item dropdown-item--danger" @click="onSignOut">
    <LogOut class="h-3.5 w-3.5 flex-shrink-0" />
    Cerrar sesión
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/components/ProfileDropdown.vue
git commit -m "feat: add Mis favoritos item to ProfileDropdown"
```

---

## Verificación final

- [ ] Usuario no autenticado hace clic en estrella → se abre modal de login
- [ ] Usuario autenticado hace clic en estrella en catálogo → estrella se rellena de amarillo inmediatamente
- [ ] Recarga de página → estrella sigue activa (cargó desde Supabase al iniciar sesión)
- [ ] Abrir ProfileDropdown → aparece "Mis favoritos" antes de "Editar perfil"
- [ ] Clic en "Mis favoritos" → navega a `/favorites`
- [ ] `/favorites` sin sesión (URL directa) → abre modal login, no navega
- [ ] FavoritesView muestra los productos marcados en grid de ProductCard
- [ ] FavoritesView sin favoritos → muestra estado vacío con link al catálogo
- [ ] Quitar estrella en favoritos → el producto desaparece del grid en `/favorites`
