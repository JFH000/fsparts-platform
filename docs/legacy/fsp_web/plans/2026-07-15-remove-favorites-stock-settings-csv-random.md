# Remove Favorites, Stock Ledger, App Settings, CSV Import, and Random Ordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove five features from FSP Parts — product favorites, the stock/inventory movement ledger, the `app_settings` table, CSV/Google Sheets catalog import, and randomized product ordering — from the frontend code, the Supabase backend, and the living backend documentation.

**Architecture:** Pure removal work across a Vue 3 + Pinia + Vue Router frontend and a Supabase (Postgres + Edge Functions) backend. No new abstractions are introduced. Where a removal leaves a gap in required functionality (setting `products.stock`), the simplest replacement is used: `stock` becomes a normal, directly-editable field in the admin product form, exactly like `name` or `price_cop`.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), Pinia, Vue Router 4, TypeScript (`noUnusedLocals`/`noUnusedParameters` enabled — the compiler will fail on any orphaned import left behind), Vitest, Supabase (Postgres via MCP `execute_sql`, Edge Functions).

## Global Constraints

- Every task must end with both of these passing, exactly as shown (run from the repo root `C:/Users/juanf/fsp_web`):
  - `npm run test -- --run` → baseline is **4 test files, 29 tests, all passing**. No test count should ever drop below this unless a task explicitly deletes a test file tied to removed code (none of the five features have dedicated tests today).
  - `npx vue-tsc --noEmit -p tsconfig.json` → baseline is **zero errors, zero output**. Because `noUnusedLocals`/`noUnusedParameters` are on, this command is the authoritative check for orphaned imports/vars left behind by a deletion — treat any output from it as a blocking failure.
- This is a removal plan: there is no new behavior to drive with a failing test first. Each task's verification is: make the deletion/edit, run the two commands above, and `grep` for the removed symbol/table name across `src/` to confirm zero remaining references (exact grep command given per task). This replaces the usual "write failing test → implement" loop for these tasks.
- Do not touch `docs/superpowers/specs/*` or `docs/superpowers/plans/*` (except this file) — those are historical development records of what was built and why, not living documentation, and rewriting them would misrepresent history. Only `docs/backend/*.md` (living docs describing the system's current state, written earlier this session) get updated, in Task 6.
- `products.stock` becomes a normal, always-editable field in the admin product create/edit form (both modes use the same input, no `readonly`, no separate "stock inicial" concept) — per explicit product decision. The stock ledger tables/trigger are deleted outright; there is no replacement audit trail.
- The "Productos Destacados" section is removed entirely from the landing page, along with the `featuredProducts` computed and its store export — per explicit product decision. The underlying `is_featured` product attribute (DB column, `Product.isFeatured` type field, the "Destacado" toggle in the admin product form, `ProductPayload.is_featured`) is **not** part of this removal and must be left exactly as-is; only the homepage section and the shuffle-based random ordering go.
- `scripts/import.mjs` and the two devDependencies it alone uses (`csv-parse`, `sharp`) are removed too — per explicit product decision. Confirmed via grep: no other file in the repo references either package or this script.
- Task 5 (backend) is executed directly by the plan's controller via the Supabase MCP tools already connected in this session, not dispatched to an implementer subagent — dropping live tables on the connected Supabase project (`jcugmeuvwqjvrlrdlyyh`) is a destructive, hard-to-reverse action against shared infrastructure, and the user has already explicitly scoped and authorized exactly these tables in this conversation. The controller still records this task in the progress ledger and still gets it reviewed like any other task.
- The `sync-sheets` Edge Function **cannot be deleted by any tool available in this environment** (no Supabase CLI is installed locally, and the connected Supabase MCP server exposes no edge-function-deletion tool — confirmed by searching the full MCP tool catalog). Task 5 documents the exact manual step (Supabase Dashboard → Edge Functions → `sync-sheets` → Delete) instead of attempting it. This is a known, accepted gap in this plan's automation, not an oversight.

---

## Task 1: Remove product favorites feature

**Files:**
- Delete: `src/modules/favorites/stores/favorites.store.ts`
- Delete: `src/modules/favorites/views/FavoritesView.vue`
- Delete: `src/core/supabase/favorites.service.ts`
- Modify: `src/router/index.ts`
- Modify: `src/modules/catalog/components/ProductCard.vue`
- Modify: `src/modules/catalog/views/ProductDetailView.vue`
- Modify: `src/modules/auth/components/ProfileDropdown.vue`
- Modify: `src/modules/auth/stores/auth.store.ts`

**Interfaces:**
- Removes: `useFavoritesStore` (Pinia store, `isFavorite`/`fetchFavorites`/`toggleFavorite`/`clearFavorites`), the `favorites` named route, and all imports of both.
- No other task depends on anything favorites-related.

- [ ] **Step 1: Delete the favorites-only files**

```bash
rm src/modules/favorites/stores/favorites.store.ts
rm src/modules/favorites/views/FavoritesView.vue
rm -r src/modules/favorites
rm src/core/supabase/favorites.service.ts
```

(`rm -r src/modules/favorites` removes the now-empty `stores/` and `views/` subfolders along with the module directory itself.)

- [ ] **Step 2: Remove the favorites route from `src/router/index.ts`**

Delete this exact line from the `/` route's `children` array (it sits between the `hvac-calculator` line and the closing `],`):

```ts
        { path: 'favorites',       name: 'favorites',      component: () => import('@/modules/favorites/views/FavoritesView.vue'), meta: { requiresUser: true } },
```

- [ ] **Step 3: Strip the favorite button out of `src/modules/catalog/components/ProductCard.vue`**

In the `<template>`, delete this entire block (the comment line through the closing `</button>`):

```html
      <!-- Favorite button -->
      <button
        @click.stop.prevent="handleFavorite"
        :class="[
          'absolute top-2 right-2 z-10 transition-opacity p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm cursor-pointer',
          favoritesStore.isFavorite(product.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]"
        :title="favoritesStore.isFavorite(product.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'"
      >
        <Star
          class="h-4 w-4 transition-colors"
          :class="favoritesStore.isFavorite(product.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'"
        />
      </button>
```

In the `<script setup>` block:

Change:
```ts
import { ShoppingCart, Check, Package, Star } from '@lucide/vue'
```
to:
```ts
import { ShoppingCart, Check, Package } from '@lucide/vue'
```

Delete this import line entirely:
```ts
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
```

Delete this declaration:
```ts
const favoritesStore = useFavoritesStore()
```

Delete this whole function:
```ts
function handleFavorite() {
  if (!authStore.isAuthenticated) {
    authModal.open('login', 'Inicia sesión para guardar tus productos favoritos')
    return
  }
  favoritesStore.toggleFavorite(authStore.user!.id, props.product.id)
}
```

`authStore` and `authModal` (and their imports `useAuthStore` / `useAuthModal`) were only ever used inside `handleFavorite` in this file — after deleting it, also delete these now-unused lines:
```ts
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'
```
```ts
const authStore      = useAuthStore()
const authModal      = useAuthModal()
```

- [ ] **Step 4: Strip the favorite button out of `src/modules/catalog/views/ProductDetailView.vue`**

In the `<template>`, replace this block:

```html
          <!-- Name + favorite -->
          <div class="flex items-start gap-3">
            <h1 class="text-[1.75rem] font-extrabold text-slate-900 leading-snug flex-1 text-balance tracking-tight">{{ product.name }}</h1>
            <button
              @click="handleFavorite"
              class="flex-shrink-0 mt-1 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              :title="favoritesStore.isFavorite(product.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'"
            >
              <Star
                class="h-5 w-5 transition-colors"
                :class="favoritesStore.isFavorite(product.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'"
              />
            </button>
          </div>
```

with:

```html
          <!-- Name -->
          <h1 class="text-[1.75rem] font-extrabold text-slate-900 leading-snug flex-1 text-balance tracking-tight">{{ product.name }}</h1>
```

In the `<script setup>` block:

Change:
```ts
import { ChevronRight, ArrowLeft, ShoppingCart, Check, PackageSearch, Pencil, Star, Pause, Play } from '@lucide/vue'
```
to:
```ts
import { ChevronRight, ArrowLeft, ShoppingCart, Check, PackageSearch, Pencil, Pause, Play } from '@lucide/vue'
```

Delete this import line entirely:
```ts
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
```

Delete this declaration:
```ts
const favoritesStore = useFavoritesStore()
```

Delete this whole function:
```ts
function handleFavorite() {
  if (!auth.isAuthenticated) {
    authModal.open('login', 'Inicia sesión para guardar tus productos favoritos')
    return
  }
  if (product.value) {
    favoritesStore.toggleFavorite(auth.user!.id, product.value.id)
  }
}
```

`auth` (from `useAuthStore()`) is still used elsewhere in this file (the admin edit shortcut `v-if="auth.isAdmin"`) — keep it. `authModal` (from `useAuthModal()`) was only used inside `handleFavorite` in this file — after deleting the function, also delete:
```ts
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'
```
```ts
const authModal      = useAuthModal()
```

- [ ] **Step 5: Remove "Mis favoritos" from `src/modules/auth/components/ProfileDropdown.vue`**

In the `<template>`, delete this button:
```html
          <button class="dropdown-item" @click="onFavorites">
            <Star class="h-3.5 w-3.5 flex-shrink-0" />
            Mis favoritos
          </button>
```

In the `<script setup>` block:

Change:
```ts
import { Pencil, LogOut, Star } from '@lucide/vue'
```
to:
```ts
import { Pencil, LogOut } from '@lucide/vue'
```

Delete this function:
```ts
function onFavorites() {
  isOpen.value = false
  router.push('/favorites')
}
```

- [ ] **Step 6: Remove favorites wiring from `src/modules/auth/stores/auth.store.ts`**

Delete this import line entirely:
```ts
import { useFavoritesStore } from '@/modules/favorites/stores/favorites.store'
```

Inside `_init()`, replace:
```ts
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
with:
```ts
        if (user.value) {
          fetchProfile(user.value.id).finally(resolveReady)
        } else {
          profile.value = null
          resolveReady()
        }
```

- [ ] **Step 7: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
grep -rn "favorite" src/ --include=*.ts --include=*.vue -i
```

Expected: both commands pass exactly as described in Global Constraints, and the grep returns **no matches** (case-insensitive, catches `favorite`, `Favorite`, `favoritos`, `useFavoritesStore`, etc.).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "remove: product favorites feature"
```

---

## Task 2: Remove stock/inventory ledger module, make stock directly editable

**Files:**
- Delete: `src/modules/admin/services/stock.service.ts`
- Delete: `src/modules/admin/views/AdminStockView.vue`
- Delete: `src/modules/admin/views/AdminStockNewReceiptView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/modules/admin/layouts/AdminLayout.vue`
- Modify: `src/modules/admin/services/admin.service.ts`
- Modify: `src/modules/admin/views/AdminProductFormView.vue`

**Interfaces:**
- Removes: `createInitialStockMovement`, `listProductsWithStock`, `listMovements`, `createReceipt`, `createAdjustment` (all of `stock.service.ts`), the `admin-stock` and `admin-stock-new-receipt` routes.
- Changes: `admin.service.ts`'s `updateProduct(id, payload)` now takes `ProductPayload` (the full type, including `stock`) instead of `UpdateProductPayload` (`Omit<ProductPayload, 'stock'>`, which is deleted). Any future caller of `updateProduct` must pass `stock` in the payload.
- `products.stock` remains a read-only, plain `number` column display in `AdminProductsView.vue` — untouched by this task, still fine to read.

- [ ] **Step 1: Delete the stock-only files**

```bash
rm src/modules/admin/services/stock.service.ts
rm src/modules/admin/views/AdminStockView.vue
rm src/modules/admin/views/AdminStockNewReceiptView.vue
```

- [ ] **Step 2: Remove the two stock routes from `src/router/index.ts`**

Delete these exact two lines from the `/admin` route's `children` array:

```ts
        { path: 'stock',     name: 'admin-stock',            component: () => import('@/modules/admin/views/AdminStockView.vue') },
        { path: 'stock/new', name: 'admin-stock-new-receipt', component: () => import('@/modules/admin/views/AdminStockNewReceiptView.vue') },
```

- [ ] **Step 3: Remove the "Stock" nav item from `src/modules/admin/layouts/AdminLayout.vue`**

Change:
```ts
import { Package, Layers, Settings, Users, ExternalLink, Archive } from '@lucide/vue'
```
to:
```ts
import { Package, Layers, Settings, Users, ExternalLink } from '@lucide/vue'
```

Change:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
  { to: '/admin/stock',     label: 'Stock',     icon: Archive  },
  { to: '/admin/settings',  label: 'CSV',        icon: Settings },
]
```
to:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
  { to: '/admin/settings',  label: 'CSV',        icon: Settings },
]
```

(`Settings` and the CSV nav item stay for now — Task 3 removes them.)

- [ ] **Step 4: Make `stock` a normal update field in `src/modules/admin/services/admin.service.ts`**

Delete this type and its comment entirely:
```ts
/** Payload for updates — stock is ledger-managed and excluded from direct edits. */
export type UpdateProductPayload = Omit<ProductPayload, 'stock'>
```

Change:
```ts
export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<void> {
  const { error } = await getSb().from('products').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}
```
to:
```ts
export async function updateProduct(id: string, payload: ProductPayload): Promise<void> {
  const { error } = await getSb().from('products').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Unify the stock field and drop the ledger call in `src/modules/admin/views/AdminProductFormView.vue`**

In the `<template>`, replace this block:
```html
          <div>
            <label class="field-label">
              {{ isEditMode ? 'Stock' : 'Stock inicial' }}
            </label>
            <input
              v-if="isEditMode"
              v-model="form.stock"
              type="number"
              min="0"
              readonly
              class="field-input cursor-default opacity-60"
              placeholder="0"
            />
            <input
              v-else
              v-model.number="stockInicial"
              type="number"
              min="0"
              step="1"
              class="field-input"
              placeholder="0"
            />
          </div>
```
with:
```html
          <div>
            <label class="field-label">Stock</label>
            <input
              v-model="form.stock"
              type="number"
              min="0"
              step="1"
              class="field-input"
              placeholder="0"
            />
          </div>
```

In the `<script setup>` block:

Change:
```ts
import {
  getAdminProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductPayload,
} from '@/modules/admin/services/admin.service'
import { createInitialStockMovement } from '@/modules/admin/services/stock.service'
```
to:
```ts
import {
  getAdminProduct,
  createProduct,
  updateProduct,
  type ProductPayload,
} from '@/modules/admin/services/admin.service'
```

Delete this line:
```ts
const stockInicial     = ref<number>(0)
```

Replace the whole `handleSave` function:
```ts
async function handleSave() {
  pageError.value = ''
  if (!form.name || !form.sku) {
    showError('Nombre y SKU son obligatorios.')
    return
  }
  isSaving.value = true
  const toNum = (v: number | '') => v !== '' ? Number(v) : null
  try {
    const payload: ProductPayload = {
      sku:             form.sku,
      name:            form.name,
      slug:            form.slug || slugify(form.name),
      description:     form.description,
      brand_id:        form.brand_id,
      category_id:     form.category_id,
      product_line_id: form.product_line_id,
      price_usd:       toNum(form.price_usd),
      price_cop:       toNum(form.price_cop),
      price_ws1:       toNum(form.price_ws1),
      price_ws2:       toNum(form.price_ws2),
      price_ws3:       toNum(form.price_ws3),
      price_ws4:       toNum(form.price_ws4),
      stock:           Number(form.stock) || 0,
      is_featured:     form.is_featured,
      is_new:          form.is_new,
      images:          form.images,
      specs:           form.specs.filter(s => s.key).map(s => ({
        key: s.key, value: s.value,
        ...(s.unit  ? { unit: s.unit }   : {}),
        ...(s.group ? { group: s.group } : {}),
      })),
      refrigerants:    form.refrigerants,
    }

    if (isEditMode.value) {
      // Exclude stock from edit payload — stock is ledger-managed via stock_movements only
      const { stock: _stock, ...editPayload } = payload
      await updateProduct(route.params.id as string, editPayload)
      addToast({
        message: 'Producto guardado',
        href: `/product/${route.params.id}`,
        linkLabel: 'Ver producto',
      })
    } else {
      // Always create with stock=0; initial stock is managed via the movement ledger
      const newId = await createProduct({ ...payload, stock: 0 })
      try {
        if (stockInicial.value > 0) {
          await createInitialStockMovement(newId, stockInicial.value)
        }
      } catch (err) {
        try { await deleteProduct(newId) } catch { /* best-effort cleanup */ }
        throw err
      }
    }
    router.push('/admin/products')
  } catch (e: unknown) {
    showError(e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    isSaving.value = false
  }
}
```
with:
```ts
async function handleSave() {
  pageError.value = ''
  if (!form.name || !form.sku) {
    showError('Nombre y SKU son obligatorios.')
    return
  }
  isSaving.value = true
  const toNum = (v: number | '') => v !== '' ? Number(v) : null
  try {
    const payload: ProductPayload = {
      sku:             form.sku,
      name:            form.name,
      slug:            form.slug || slugify(form.name),
      description:     form.description,
      brand_id:        form.brand_id,
      category_id:     form.category_id,
      product_line_id: form.product_line_id,
      price_usd:       toNum(form.price_usd),
      price_cop:       toNum(form.price_cop),
      price_ws1:       toNum(form.price_ws1),
      price_ws2:       toNum(form.price_ws2),
      price_ws3:       toNum(form.price_ws3),
      price_ws4:       toNum(form.price_ws4),
      stock:           Number(form.stock) || 0,
      is_featured:     form.is_featured,
      is_new:          form.is_new,
      images:          form.images,
      specs:           form.specs.filter(s => s.key).map(s => ({
        key: s.key, value: s.value,
        ...(s.unit  ? { unit: s.unit }   : {}),
        ...(s.group ? { group: s.group } : {}),
      })),
      refrigerants:    form.refrigerants,
    }

    if (isEditMode.value) {
      await updateProduct(route.params.id as string, payload)
      addToast({
        message: 'Producto guardado',
        href: `/product/${route.params.id}`,
        linkLabel: 'Ver producto',
      })
    } else {
      await createProduct(payload)
    }
    router.push('/admin/products')
  } catch (e: unknown) {
    showError(e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    isSaving.value = false
  }
}
```

- [ ] **Step 6: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
grep -rn "stock_movements\|stock_receipts\|stock\.service\|createInitialStockMovement\|AdminStockView\|AdminStockNewReceiptView\|stockInicial" src/
```

Expected: both commands pass as described in Global Constraints, and the grep returns **no matches**. (Plain `products.stock` field usage — e.g. `product.stock`, `form.stock`, `p.stock`, the admin list column — is untouched and will not match this pattern.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "remove: stock ledger module, make products.stock directly editable"
```

---

## Task 3: Remove CSV/Google Sheets import feature

**Files:**
- Delete: `src/modules/admin/views/AdminSettingsView.vue`
- Delete: `scripts/import.mjs`
- Modify: `src/router/index.ts`
- Modify: `src/modules/admin/layouts/AdminLayout.vue`
- Modify: `src/modules/admin/services/admin.service.ts`
- Modify: `package.json`

**Interfaces:**
- Removes: `exportAllProducts`, `importCsv`, `ProductExportRow`, `ImportResult` (all from `admin.service.ts`), the `admin-settings` route, and the `csv-parse`/`sharp` devDependencies.
- Does not touch the Supabase `sync-sheets` Edge Function or the `app_settings` table — those are backend objects handled in Task 5.

- [ ] **Step 1: Delete the CSV-only files**

```bash
rm src/modules/admin/views/AdminSettingsView.vue
rm scripts/import.mjs
rmdir scripts 2>/dev/null || true
```

(The `rmdir` only succeeds if `scripts/` is now empty; if it fails because other files remain there, that's fine — ignore the error.)

- [ ] **Step 2: Remove the settings route from `src/router/index.ts`**

Delete this exact line from the `/admin` route's `children` array:

```ts
        { path: 'settings',          name: 'admin-settings',    component: () => import('@/modules/admin/views/AdminSettingsView.vue') },
```

- [ ] **Step 3: Remove the "CSV" nav item from `src/modules/admin/layouts/AdminLayout.vue`**

Change:
```ts
import { Package, Layers, Settings, Users, ExternalLink } from '@lucide/vue'
```
to:
```ts
import { Package, Layers, Users, ExternalLink } from '@lucide/vue'
```

Change:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
  { to: '/admin/settings',  label: 'CSV',        icon: Settings },
]
```
to:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
]
```

- [ ] **Step 4: Remove the CSV export/import section from `src/modules/admin/services/admin.service.ts`**

Delete this entire section verbatim (from the `// ── CSV export / import ──` comment through the end of the `importCsv` function, i.e. everything between the `deleteProduct` function above and the `// ── Brands ──` comment below):

```ts
// ── CSV export / import ───────────────────────────────────────────────────────

export type ProductExportRow = {
  sku: string
  name: string
  slug: string
  description: string
  brand: string
  category: string
  product_line: string
  price_usd: number | null
  price_cop: number | null
  price_ws1: number | null
  price_ws2: number | null
  price_ws3: number | null
  price_ws4: number | null
  stock: number
  is_featured: boolean
  is_new: boolean
}

export async function exportAllProducts(): Promise<ProductExportRow[]> {
  const { data, error } = await getSb()
    .from('products')
    .select(`
      sku, name, slug, description, stock, is_featured, is_new,
      price_usd, price_cop, price_ws1, price_ws2, price_ws3, price_ws4,
      brand:brands(name),
      category:categories(slug),
      product_line:product_lines(code)
    `)
    .order('name')
  if (error) throw new Error(error.message)

  return (data ?? []).map((p: Record<string, unknown>) => ({
    sku:          (p.sku as string) ?? '',
    name:         (p.name as string) ?? '',
    slug:         (p.slug as string) ?? '',
    description:  (p.description as string) ?? '',
    brand:        ((p.brand as { name: string } | null)?.name) ?? '',
    category:     ((p.category as { slug: string } | null)?.slug) ?? '',
    product_line: ((p.product_line as { code: string } | null)?.code) ?? '',
    price_usd:    p.price_usd as number | null,
    price_cop:    p.price_cop as number | null,
    price_ws1:    p.price_ws1 as number | null,
    price_ws2:    p.price_ws2 as number | null,
    price_ws3:    p.price_ws3 as number | null,
    price_ws4:    p.price_ws4 as number | null,
    stock:        (p.stock as number) ?? 0,
    is_featured:  (p.is_featured as boolean) ?? false,
    is_new:       (p.is_new as boolean) ?? false,
  }))
}

export type ImportResult = {
  updated: number
  inserted: number
  deleted: number
  failed: number
  total: number
  errors: string[]
  autoCreated: string[]
}

export async function importCsv(csvContent: string): Promise<ImportResult> {
  const sb = getSb()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-sheets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ csv: csvContent }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error en la importación')
  return data as ImportResult
}

```

- [ ] **Step 5: Remove `csv-parse` and `sharp` from `package.json`**

In the `devDependencies` block, delete these two lines:
```json
    "csv-parse": "^6.2.1",
```
```json
    "sharp": "^0.34.5",
```

Then update the lockfile:
```bash
npm install
```

- [ ] **Step 6: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
grep -rn "sync-sheets\|exportAllProducts\|importCsv\|AdminSettingsView\|csv-parse" src/ package.json
```

Expected: both commands pass as described in Global Constraints, and the grep returns **no matches**.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "remove: CSV/Google Sheets catalog import feature"
```

---

## Task 4: Remove randomized product ordering and the "Productos Destacados" home section

**Files:**
- Modify: `src/modules/catalog/stores/catalog.store.ts`
- Modify: `src/modules/landing/views/LandingView.vue`

**Interfaces:**
- Removes: the `shuffle<T>()` helper and the `featuredProducts` computed from `catalog.store.ts`'s return object — any code that referenced `catalogStore.featuredProducts` must be gone after this task (there is exactly one consumer, `LandingView.vue`, handled in the same task).
- `products.isFeatured` (the underlying data field) is untouched — do not remove it from `shared/types/index.ts`, `catalog.service.ts`, or the admin form's "Destacado" toggle.

- [ ] **Step 1: Remove `shuffle` and `featuredProducts` from `src/modules/catalog/stores/catalog.store.ts`**

Delete this function entirely:
```ts
  // ── Supabase init ─────────────────────────────────────────────────────────────
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
```
replacing it with just the comment marker, so the code above `initialize()` reads:
```ts
  // ── Supabase init ─────────────────────────────────────────────────────────────
```

Inside `initialize()`, change:
```ts
      allProducts.value     = shuffle(products)
```
to:
```ts
      allProducts.value     = products
```

Delete this computed entirely:
```ts
  const featuredProducts = computed(() => {
    const marked = allProducts.value.filter(p => p.isFeatured)
    return (marked.length ? marked : allProducts.value).slice(0, 8)
  })
```

In the returned object at the bottom of the store, delete this line:
```ts
    featuredProducts,
```

- [ ] **Step 2: Remove the "FEATURED PRODUCTS" section from `src/modules/landing/views/LandingView.vue`**

In the `<template>`, delete this entire section:
```html
    <!-- ─────────────────── FEATURED PRODUCTS ─────────────────── -->
    <section
      ref="featuredRef"
      class="bg-slate-50/80 py-16 sr-section"
      :class="featuredVisible ? 'sr-active' : featuredReady ? 'sr-pending' : ''"
    >
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-baseline justify-between mb-8">
          <h2 class="text-2xl font-bold text-slate-900 text-balance">Productos Destacados</h2>
          <RouterLink
            to="/catalog"
            class="text-sm font-medium text-brand-700 hover:text-brand-800 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </RouterLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <ProductCard
            v-for="product in catalogStore.featuredProducts"
            :key="product.id"
            :product="product"
          />
        </div>
      </div>
    </section>

```

In the `<script setup>` block:

Delete this import entirely (no longer used anywhere in this file):
```ts
import ProductCard from '@/modules/catalog/components/ProductCard.vue'
```

Delete these three ref declarations:
```ts
const featuredRef = ref<HTMLElement | null>(null)
```
```ts
const featuredReady = ref(false)
```
```ts
const featuredVisible = ref(false)
```

(They currently sit inline among `linesRef`/`calcRef`/`trustRef` and `linesReady`/`calcReady`/`trustReady` and `linesVisible`/`calcVisible`/`trustVisible` — remove only the `featured*` ones, keep the other three in each group.)

In the `reveals` array inside `onMounted`, change:
```ts
  const reveals = [
    { ref: linesRef,    ready: linesReady,    visible: linesVisible },
    { ref: featuredRef, ready: featuredReady, visible: featuredVisible },
    { ref: calcRef,     ready: calcReady,     visible: calcVisible },
    { ref: trustRef,    ready: trustReady,    visible: trustVisible },
  ]
```
to:
```ts
  const reveals = [
    { ref: linesRef, ready: linesReady, visible: linesVisible },
    { ref: calcRef,  ready: calcReady,  visible: calcVisible },
    { ref: trustRef, ready: trustReady, visible: trustVisible },
  ]
```

- [ ] **Step 3: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
grep -rn "featuredProducts\|shuffle(\|Productos Destacados\|featuredRef\|featuredReady\|featuredVisible" src/
```

Expected: both commands pass as described in Global Constraints, and the grep returns **no matches**. (`is_featured` / `isFeatured` / `is_featured` on the product model and admin form are a different string and are expected to still appear elsewhere — this grep pattern does not match them.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "remove: randomized product ordering and featured products home section"
```

---

## Task 5: Backend cleanup (controller-executed via Supabase MCP)

> Per Global Constraints, this task is executed directly by the plan controller using the already-connected Supabase MCP tools (`mcp__supabase__execute_sql`), not dispatched to an implementer subagent, because it drops live tables on the connected project. It is still logged in the progress ledger and still gets a review pass.

**Files:**
- Create: `supabase/migrations/20260715_remove_favorites_stock_settings_csv.sql` (mirrors the SQL applied to the remote project, keeping this repo's hand-maintained migration folder consistent with the change — the folder is not currently wired to a local Supabase CLI/dev stack in this environment)

**Remote objects removed (project `jcugmeuvwqjvrlrdlyyh`):**
- Table `public.product_favorites` (and its 3 RLS policies, dropped automatically with the table)
- Table `public.stock_movements` (and its RLS policies + the `trg_update_product_stock` trigger, dropped automatically with the table)
- Table `public.stock_receipts` (and its RLS policies, dropped automatically with the table)
- Function `public.update_product_stock()` (the trigger function the dropped trigger called — not owned by the table, needs an explicit drop)
- Table `public.app_settings` (and its RLS policies, dropped automatically with the table)

**Remote object that cannot be removed by any available tool (manual step for the user):**
- Edge Function `sync-sheets` — delete via Supabase Dashboard → the `jcugmeuvwqjvrlrdlyyh` project → Edge Functions → `sync-sheets` → Delete. (No local Supabase CLI is installed in this environment, and the connected `mcp__supabase__*` toolset has no edge-function-deletion tool — only `deploy_edge_function`, `get_edge_function`, and `list_edge_functions`.)

- [ ] **Step 1: Confirm current row counts before dropping (sanity check, not a blocker)**

Run via `mcp__supabase__execute_sql`:
```sql
select 'product_favorites' as t, count(*) from public.product_favorites
union all select 'stock_movements', count(*) from public.stock_movements
union all select 'stock_receipts', count(*) from public.stock_receipts
union all select 'app_settings', count(*) from public.app_settings;
```
Expected (per the backend audit done earlier this session): `product_favorites` 0, `stock_movements` 0, `stock_receipts` 0, `app_settings` 1 (the `sheets_url` setting, which is only meaningful for the CSV import feature being removed). If any count is materially different from this, stop and flag it before proceeding — it means data has been added since the audit and the user should be told what's about to be deleted.

- [ ] **Step 2: Drop the tables and the orphaned trigger function**

Run via `mcp__supabase__execute_sql`:
```sql
drop table if exists public.product_favorites cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.stock_receipts cascade;
drop function if exists public.update_product_stock() cascade;
drop table if exists public.app_settings cascade;
```

- [ ] **Step 3: Verify the drop**

Run via `mcp__supabase__list_tables` (schemas: `["public"]`) and confirm `product_favorites`, `stock_movements`, `stock_receipts`, and `app_settings` are no longer listed, and `products`, `brands`, `categories`, `product_lines`, `user_profiles` still are.

Run via `mcp__supabase__get_advisors` (type `security`) and confirm the advisories that previously referenced `update_product_stock`'s missing `search_path` and the storage/RLS items unrelated to these tables are the only remaining ones — no new errors introduced by the drop.

- [ ] **Step 4: Write the mirrored local migration file**

Create `supabase/migrations/20260715_remove_favorites_stock_settings_csv.sql` with exactly the SQL from Step 2:
```sql
-- Remove product favorites, the stock movement ledger, and app_settings
-- (features removed from the app: favorites, stock ledger UI, CSV/Sheets import).
drop table if exists public.product_favorites cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.stock_receipts cascade;
drop function if exists public.update_product_stock() cascade;
drop table if exists public.app_settings cascade;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260715_remove_favorites_stock_settings_csv.sql
git commit -m "remove: backend tables for favorites, stock ledger, and app_settings"
```

---

## Task 6: Update backend documentation

**Files:**
- Modify: `docs/backend/README.md`
- Modify: `docs/backend/database.md`
- Modify: `docs/backend/auth-y-rls.md`
- Modify: `docs/backend/funciones-y-triggers.md`
- Delete: `docs/backend/edge-functions.md`
- Modify: `docs/backend/storage.md` (only if it references `sync-sheets` uploads by name — check first)

**Interfaces:**
- Depends on Task 5 having already run — this task documents the post-removal backend state, so it must be dispatched after Task 5's backend changes are confirmed.
- Do not touch `docs/superpowers/specs/*` or `docs/superpowers/plans/*` — see Global Constraints.

- [ ] **Step 1: Update `docs/backend/database.md`**

Remove the entire `### product_favorites` subsection (under "## Usuarios"), the entire `## Inventario` section (both `### stock_receipts` and `### stock_movements` subsections), and the entire `## Configuración` section (`### app_settings`).

In the "Diagrama de relaciones" ASCII block near the top, remove the `product_favorites`, `stock_receipts`, and `stock_movements` boxes/edges, leaving only:
```
product_lines ──┬──< categories ──< products >── brands
                └──────────────────< products

auth.users ──── user_profiles
```

In the "Índices" section, remove the line for `idx_stock_movements_product_id` (that index no longer exists) and remove `product_favorites_pkey` from wherever it's listed alongside other PKs.

Leave the "Migraciones aplicadas" table as-is — it's a historical record of what was applied, not a description of current state; add one new row at the bottom for this removal:
```markdown
| `20260715` | `remove_favorites_stock_settings_csv` | Drop `product_favorites`, `stock_movements`, `stock_receipts`, `app_settings`, and `update_product_stock()` |
```

- [ ] **Step 2: Update `docs/backend/auth-y-rls.md`**

Remove the `### product_favorites` subsection, the `### stock_receipts y stock_movements` subsection, and the `### app_settings` subsection from "## Políticas RLS por tabla".

- [ ] **Step 3: Update `docs/backend/funciones-y-triggers.md`**

Remove the entire `### update_product_stock()` subsection from "## Funciones".

In the "## Triggers" table, remove the `trg_update_product_stock` row.

In "## Pendientes anotados por los advisors", remove the bullet about fixing `search_path` on `update_product_stock` (that function no longer exists) — keep the one about `prevent_role_change`.

- [ ] **Step 4: Delete `docs/backend/edge-functions.md`**

```bash
rm docs/backend/edge-functions.md
```

(The only Edge Function it documented, `sync-sheets`, is being removed — see Task 5's note on the manual Dashboard-deletion step still pending.)

- [ ] **Step 5: Check and update `docs/backend/storage.md` if needed**

Read the file. If it mentions `sync-sheets` or the CSV import flow by name anywhere, remove that specific mention (the bucket itself, `product-images`, is untouched and stays fully documented — only remove references to the deleted import feature, if any exist).

- [ ] **Step 6: Update `docs/backend/README.md`**

In the "Índice" table, remove the row for `edge-functions.md`.

In the "Piezas del backend en uso" table:
- Change the Postgres row from "9 tablas: catálogo (4), usuarios (2), inventario (2), configuración (1)" to "5 tablas: catálogo (4), usuarios (1)".
- Change "Funciones Postgres" from "5: `is_admin`, `handle_new_user`, `prevent_role_change`, `update_product_stock`, `rls_auto_enable`" to "4: `is_admin`, `handle_new_user`, `prevent_role_change`, `rls_auto_enable`".
- Change "Triggers" to remove the stock-update mention, keeping only "Alta de perfil al registrarse, inmutabilidad del rol, RLS automático en tablas nuevas".
- Change "Edge Functions" from "1: `sync-sheets` — sincroniza el catálogo desde un CSV (Google Sheets)" to "0 — la función `sync-sheets` fue removida (nota: aún requiere borrado manual desde el Dashboard de Supabase, ver detalle en el historial de este cambio)".

In the "Datos actuales" table, remove the rows for `user_profiles` favorites/stock counts that no longer apply — specifically remove the `app_settings`, `product_favorites`, `stock_receipts`, `stock_movements` rows entirely (keep `products`, `brands`, `categories`, `product_lines`, `user_profiles`).

In "## Estado de salud (advisors de Supabase)", remove the bullets that reference `handle_new_user`/`rls_auto_enable` RPC exposure only if they were specific to the removed tables (they were not — `handle_new_user` and `rls_auto_enable` are general, unrelated to these 5 features, so leave that whole subsection as-is). Remove the bullet about the public bucket listing only if Step 5 determined it referenced the CSV flow (it does not — leave it as-is too). Remove any bullet that specifically names `update_product_stock`'s `search_path` warning, since that function no longer exists.

In the architecture diagram near the top, remove the `Edge Fn → sync-sheets (import CSV)` line from the Supabase box.

- [ ] **Step 7: Verify**

```bash
grep -rln "product_favorites\|stock_movements\|stock_receipts\|app_settings\|sync-sheets" docs/backend/
```

Expected: **no matches** (empty output). This confirms none of the removed backend objects are still described as current/active anywhere in the living docs.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: update backend docs to reflect removed features"
```
