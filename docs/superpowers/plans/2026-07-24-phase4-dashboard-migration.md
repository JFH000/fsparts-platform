# Phase 4: Admin Panel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `fsp_web`'s admin panel (product/catalog/customer/sales management) into `apps/dashboard`, replacing its old router-level auth guard with an app-wide gate that includes a login UI local to `apps/dashboard`.

**Architecture:** The three admin services and five admin views port from `fsp_web/src/modules/admin/*` into `apps/dashboard/src/modules/admin/*`, with import paths rewritten to `@fsparts/core`/`@fsparts/ui`/relative paths. `AdminProductFormView.vue`'s dependency on `apps/shop`'s Pinia catalog store is replaced with direct calls to `@fsparts/core`'s `fetchProductLines`/`fetchBrands`/`fetchCategories`. A new, trimmed auth module (`LoginForm.vue`, `ProfileDropdown.vue`) is adapted from `apps/shop`'s already-ported versions. `App.vue` becomes a four-state gate (loading / login / restricted / admin) that renders `AdminLayout` — which is a self-contained, full-viewport shell in `fsp_web` (`fixed inset-0`, its own top bar) — in place of the shared `AppHeader`/`AppFooter` brand shell once the visitor is a confirmed admin, rather than nesting one inside the other.

**Tech Stack:** Vue 3.5 Composition API, Vite, Vitest 4, `@fsparts/core` (Supabase client, auth store, types, catalog fetchers), `@fsparts/ui` (`AppSpinner`, `useToast`), `@lucide/vue` icons.

## Global Constraints

- Every file ported from `fsp_web/src/modules/admin/*` starts as a byte-identical `cp` (not Read+Write), then gets the specific edits shown in each task — same convention Phases 2–3 used.
- `cp` commands that reference `fsp_web/...` are run from `C:\Users\juanf\fs` — the parent directory containing both `fsp_web` and `fsparts-platform` as sibling folders (confirmed: `fsp_web` is not nested inside `fsparts-platform`). Every such command in this plan is written with an explicit `fsparts-platform/` destination prefix so it is unambiguous regardless of shell cwd. All other commands (`npm`, `npx`, `git`) run from the `fsparts-platform` repo root, exactly as in Phases 1–3.
- `apps/dashboard` has no `@` alias (matches `apps/calculator`'s precedent, not `apps/shop`'s) — all new/ported code in `apps/dashboard` uses relative imports.
- `@lucide/vue` is pinned to `^1.17.0`, matching the version already used by `apps/shop` and `apps/calculator`.
- Route paths drop the `/admin` prefix `fsp_web` used (`/admin/products` → `/products`, etc.) — the whole app is the admin app now, same pattern Phase 3 used dropping `/hvac-calculator` down to `/`.
- No route `meta` and no `router.beforeEach` guard are added anywhere in `apps/dashboard` — all admin access control lives in `App.vue`'s four-state gate (Task 7), per the approved design.
- The "Ver producto →" toast link `fsp_web` shows after saving a product is **not** carried over — `@fsparts/ui`'s `AppToast.vue` renders `toast.href` through `RouterLink`, which cannot target a cross-origin URL (the product now lives on `shop.fsparts.org`, a different app). `AdminProductFormView.vue` shows a plain "Producto guardado" toast with no link instead. `@fsparts/ui` itself is not modified in this phase.
- Baseline before this phase: `npm test` → `Test Files 16 passed (16)`, `Tests 72 passed (72)` (confirmed by running it before writing this plan).

---

### Task 1: Port the three admin services

**Files:**
- Create: `apps/dashboard/src/modules/admin/services/admin.service.ts`
- Create: `apps/dashboard/src/modules/admin/services/customers.service.ts`
- Create: `apps/dashboard/src/modules/admin/services/sales.service.ts`

**Interfaces:**
- Consumes: `supabase` from `@fsparts/core`.
- Produces: from `admin.service.ts` — `listAdminProducts()`, `getAdminProduct(id)`, `createProduct(payload)`, `updateProduct(id, payload)`, `deleteProduct(id)`, types `ProductPayload`/`AdminProductRow`/`AdminProductDetail`; `listBrands()`/`createBrand(name, country?)`/`updateBrand(id, name, country?)`/`deleteBrand(id)`, type `Brand`; `listCategories()`/`createCategory(name, productLineId?)`/`updateCategory(id, name, productLineId?)`/`deleteCategory(id)`, type `Category`; `listProductLines()`/`createProductLine(code, name)`/`updateProductLine(id, code, name)`/`deleteProductLine(id)`, type `ProductLine`. From `customers.service.ts` — `listCustomers(opts?)`, `updateCustomerRole(userId, role)`, `updateCustomerNotes(userId, notes)`, type `CustomerRow`. From `sales.service.ts` — `listAllOrders()`, `updateOrderStatus(id, status)`. Tasks 2 and 3 consume all of the above. (These `Brand`/`Category`/`ProductLine` types are `admin.service.ts`'s own local types — distinct shapes from `@fsparts/core`'s same-named types, e.g. `product_line_id` snake_case here vs. `productLineId` camelCase there. Both are used, in different files, in this phase.)

- [ ] **Step 1: Create the directory and copy all three services verbatim**

Run from `C:\Users\juanf\fs`:

```bash
mkdir -p fsparts-platform/apps/dashboard/src/modules/admin/services
cp fsp_web/src/modules/admin/services/admin.service.ts fsparts-platform/apps/dashboard/src/modules/admin/services/admin.service.ts
cp fsp_web/src/modules/admin/services/customers.service.ts fsparts-platform/apps/dashboard/src/modules/admin/services/customers.service.ts
cp fsp_web/src/modules/admin/services/sales.service.ts fsparts-platform/apps/dashboard/src/modules/admin/services/sales.service.ts
```

- [ ] **Step 2: Fix `admin.service.ts`'s only import**

In `apps/dashboard/src/modules/admin/services/admin.service.ts`, line 1 currently reads:

```typescript
import { supabase } from './client'
```

Replace with:

```typescript
import { supabase } from '@fsparts/core'
```

Nothing else in the file changes — all types, mappers, and CRUD functions are copied unchanged.

- [ ] **Step 3: Fix `customers.service.ts`'s imports**

Lines 1-2 currently read:

```typescript
import { supabase } from '@/core/supabase/client'
import type { UserRole } from '@/shared/types'
```

Replace with:

```typescript
import { supabase } from '@fsparts/core'
import type { UserRole } from '@fsparts/core'
```

- [ ] **Step 4: Fix `sales.service.ts`'s imports**

Lines 1-2 currently read:

```typescript
import { supabase } from '@/core/supabase/client'
import type { Order, OrderStatus } from '@/shared/types'
```

Replace with:

```typescript
import { supabase } from '@fsparts/core'
import type { Order, OrderStatus } from '@fsparts/core'
```

- [ ] **Step 5: Verify it all compiles**

Run (from `fsparts-platform` root): `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/modules/admin/services
git commit -m "feat(dashboard): port admin CRUD services (products, customers, sales) from fsp_web"
```

---

### Task 2: Add `@lucide/vue`; port AdminProducts/Catalog/Customers/Sales views

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/modules/admin/views/AdminProductsView.vue`
- Create: `apps/dashboard/src/modules/admin/views/AdminCatalogView.vue`
- Create: `apps/dashboard/src/modules/admin/views/AdminCustomersView.vue`
- Create: `apps/dashboard/src/modules/admin/views/AdminSalesView.vue`

**Interfaces:**
- Consumes: everything produced by Task 1's three services; `AppSpinner`, `OrderStatusBadge`, `formatCurrency` from `@fsparts/core`/`@fsparts/ui` as noted per file below.
- Produces: 4 of the 5 admin views (the 5th, `AdminProductFormView.vue`, is Task 3 — it needs a real logic change, not just an import-path fix). Task 6 routes to all of these.

- [ ] **Step 1: Add `@lucide/vue` as a dependency**

In `apps/dashboard/package.json`, the `dependencies` block currently reads:

```json
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
```

Replace with:

```json
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "@lucide/vue": "^1.17.0",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: exits 0.

- [ ] **Step 3: Copy all four views verbatim**

Run from `C:\Users\juanf\fs`:

```bash
mkdir -p fsparts-platform/apps/dashboard/src/modules/admin/views
cp fsp_web/src/modules/admin/views/AdminProductsView.vue fsparts-platform/apps/dashboard/src/modules/admin/views/AdminProductsView.vue
cp fsp_web/src/modules/admin/views/AdminCatalogView.vue fsparts-platform/apps/dashboard/src/modules/admin/views/AdminCatalogView.vue
cp fsp_web/src/modules/admin/views/AdminCustomersView.vue fsparts-platform/apps/dashboard/src/modules/admin/views/AdminCustomersView.vue
cp fsp_web/src/modules/admin/views/AdminSalesView.vue fsparts-platform/apps/dashboard/src/modules/admin/views/AdminSalesView.vue
```

- [ ] **Step 4: Fix `AdminProductsView.vue`**

Two `RouterLink` targets change. Line 10 currently reads:

```html
        to="/admin/products/new"
```

Replace with:

```html
        to="/products/new"
```

Line 141 currently reads:

```html
                  :to="`/admin/products/${p.id}/edit`"
```

Replace with:

```html
                  :to="`/products/${p.id}/edit`"
```

Line 164 currently reads:

```typescript
import { listAdminProducts, deleteProduct, type AdminProductRow } from '@/modules/admin/services/admin.service'
```

Replace with:

```typescript
import { listAdminProducts, deleteProduct, type AdminProductRow } from '../services/admin.service'
```

- [ ] **Step 5: Fix `AdminCatalogView.vue`**

Lines 172-177 currently read:

```typescript
import {
  listBrands, createBrand, updateBrand, deleteBrand as deleteBrandSvc,
  listCategories, createCategory, updateCategory, deleteCategory as deleteCategorySvc,
  listProductLines, createProductLine, updateProductLine, deleteProductLine as deleteProductLineSvc,
  type Brand, type Category, type ProductLine,
} from '@/modules/admin/services/admin.service'
```

Replace with:

```typescript
import {
  listBrands, createBrand, updateBrand, deleteBrand as deleteBrandSvc,
  listCategories, createCategory, updateCategory, deleteCategory as deleteCategorySvc,
  listProductLines, createProductLine, updateProductLine, deleteProductLine as deleteProductLineSvc,
  type Brand, type Category, type ProductLine,
} from '../services/admin.service'
```

Nothing else in this file changes — its `../services/sales.service`-style relative import doesn't exist here (it only imports from `admin.service`), and every function/tab/table stays as-is.

- [ ] **Step 6: Fix `AdminCustomersView.vue`**

Lines 204 and 211 currently read (with lines 205-210's `../services/customers.service` import unchanged between them — that relative path already resolves correctly in the new location):

```typescript
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import {
  listCustomers,
  updateCustomerRole,
  updateCustomerNotes,
  type CustomerRow,
} from '../services/customers.service'
import type { UserRole } from '@/shared/types'
```

Replace with:

```typescript
import { AppSpinner } from '@fsparts/ui'
import {
  listCustomers,
  updateCustomerRole,
  updateCustomerNotes,
  type CustomerRow,
} from '../services/customers.service'
import type { UserRole } from '@fsparts/core'
```

- [ ] **Step 7: Fix `AdminSalesView.vue`**

Lines 174-178 currently read:

```typescript
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
import { listAllOrders, updateOrderStatus } from '../services/sales.service'
import { formatCurrency } from '@/shared/utils/currency'
import type { Order, OrderStatus } from '@/shared/types'
```

Replace with:

```typescript
import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
import { listAllOrders, updateOrderStatus } from '../services/sales.service'
import { formatCurrency } from '@fsparts/core'
import type { Order, OrderStatus } from '@fsparts/core'
```

- [ ] **Step 8: Verify it all compiles**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean). (No test run in this task — these are presentational views with no unit tests, matching the convention established in Phases 1-3.)

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/package.json package-lock.json apps/dashboard/src/modules/admin/views/AdminProductsView.vue apps/dashboard/src/modules/admin/views/AdminCatalogView.vue apps/dashboard/src/modules/admin/views/AdminCustomersView.vue apps/dashboard/src/modules/admin/views/AdminSalesView.vue
git commit -m "feat(dashboard): port AdminProducts/Catalog/Customers/Sales views from fsp_web"
```

---

### Task 3: Port `AdminProductFormView.vue`, replacing shop's catalog store with `@fsparts/core` fetchers

**Files:**
- Create: `apps/dashboard/src/modules/admin/views/AdminProductFormView.vue`

**Interfaces:**
- Consumes: `fetchProductLines`, `fetchBrands`, `fetchCategories`, `supabase`, types `ProductLine`/`Brand`/`Category` from `@fsparts/core`; `getAdminProduct`/`createProduct`/`updateProduct`/`type ProductPayload` from Task 1's `admin.service`; `useToast` from `@fsparts/ui`.
- Produces: `AdminProductFormView.vue`, routed (Task 6) at `/products/new` and `/products/:id/edit`.

- [ ] **Step 1: Copy the view verbatim**

Run from `C:\Users\juanf\fs`:

```bash
cp fsp_web/src/modules/admin/views/AdminProductFormView.vue fsparts-platform/apps/dashboard/src/modules/admin/views/AdminProductFormView.vue
```

- [ ] **Step 2: Fix the two `/admin/products` `RouterLink` targets**

Line 7 currently reads:

```html
          <RouterLink to="/admin/products" class="hover:text-slate-600 transition-colors">Productos</RouterLink>
```

Replace with:

```html
          <RouterLink to="/products" class="hover:text-slate-600 transition-colors">Productos</RouterLink>
```

Lines 16-18 currently read:

```html
        <RouterLink
          to="/admin/products"
          class="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
        >
```

Replace with:

```html
        <RouterLink
          to="/products"
          class="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
        >
```

- [ ] **Step 3: Point the dropdowns at local refs instead of `catalogStore`**

Line 86 currently reads:

```html
              <option v-for="l in catalogStore.productLines" :key="l.id" :value="l.id">
```

Replace with:

```html
              <option v-for="l in productLines" :key="l.id" :value="l.id">
```

Line 95 currently reads:

```html
              <option v-for="b in catalogStore.brands" :key="b.id" :value="b.id">{{ b.name }}</option>
```

Replace with:

```html
              <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
```

- [ ] **Step 4: Replace the imports**

Lines 323-335 currently read:

```typescript
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Loader2, Save, Plus, X, ImagePlus, Zap } from '@lucide/vue'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'
import { supabase } from '@/core/supabase/client'
import {
  getAdminProduct,
  createProduct,
  updateProduct,
  type ProductPayload,
} from '@/modules/admin/services/admin.service'
import { useToast } from '@/shared/composables/useToast'
```

Replace with:

```typescript
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Loader2, Save, Plus, X, ImagePlus, Zap } from '@lucide/vue'
import { supabase, fetchProductLines, fetchBrands, fetchCategories, type ProductLine, type Brand, type Category } from '@fsparts/core'
import {
  getAdminProduct,
  createProduct,
  updateProduct,
  type ProductPayload,
} from '../services/admin.service'
import { useToast } from '@fsparts/ui'
```

- [ ] **Step 5: Replace the `catalogStore` instance with local refs**

Lines 337-341 currently read:

```typescript
const { add: addToast } = useToast()

const route        = useRoute()
const router        = useRouter()
const catalogStore = useCatalogStore()
```

Replace with:

```typescript
const { add: addToast } = useToast()

const route  = useRoute()
const router = useRouter()

const productLines = ref<ProductLine[]>([])
const brands        = ref<Brand[]>([])
const categories     = ref<Category[]>([])
```

- [ ] **Step 6: Fetch the three lists on mount**

Immediately after the `form` reactive object's closing `})` (originally lines 375-383) and before `const filteredCategories = computed(...)` (originally line 386), insert:

```typescript
onMounted(async () => {
  const [lineList, brandList, categoryList] = await Promise.all([fetchProductLines(), fetchBrands(), fetchCategories()])
  productLines.value = lineList
  brands.value        = brandList
  categories.value    = categoryList
})
```

- [ ] **Step 7: Point `filteredCategories` at the local ref**

Lines 386-389 currently read:

```typescript
const filteredCategories = computed(() => {
  if (!form.product_line_id) return catalogStore.categories
  return catalogStore.categories.filter((c) => c.productLineId === form.product_line_id)
})
```

Replace with:

```typescript
const filteredCategories = computed(() => {
  if (!form.product_line_id) return categories.value
  return categories.value.filter((c) => c.productLineId === form.product_line_id)
})
```

- [ ] **Step 8: Drop the cross-origin toast link and fix the post-save redirect**

Lines 544-554 currently read:

```typescript
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
```

Replace with:

```typescript
    if (isEditMode.value) {
      await updateProduct(route.params.id as string, payload)
      addToast({ message: 'Producto guardado' })
    } else {
      await createProduct(payload)
    }
    router.push('/products')
```

(The saved product now lives on `shop.fsparts.org`, a different app — `@fsparts/ui`'s `AppToast` renders `toast.href` through `RouterLink`, which only works for in-app routes, so the link is dropped rather than left broken.)

- [ ] **Step 9: Verify it compiles**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 10: Commit**

```bash
git add apps/dashboard/src/modules/admin/views/AdminProductFormView.vue
git commit -m "feat(dashboard): port AdminProductFormView, replace shop catalogStore with @fsparts/core fetchers"
```

---

### Task 4: Auth module — trimmed `LoginForm` and `ProfileDropdown`

**Files:**
- Create: `apps/dashboard/src/modules/auth/components/LoginForm.vue`
- Create: `apps/dashboard/src/modules/auth/components/ProfileDropdown.vue`

**Interfaces:**
- Consumes: `useAuthStore` from `@fsparts/core`.
- Produces: `LoginForm.vue` (no props, calls `signIn`), `ProfileDropdown.vue` (no props, calls `signOut`). Task 5 consumes `ProfileDropdown`; Task 7 consumes `LoginForm`.

- [ ] **Step 1: Copy both source components from `apps/shop`**

Run from `fsparts-platform` root:

```bash
mkdir -p apps/dashboard/src/modules/auth/components
cp apps/shop/src/modules/auth/components/LoginForm.vue apps/dashboard/src/modules/auth/components/LoginForm.vue
cp apps/shop/src/modules/auth/components/ProfileDropdown.vue apps/dashboard/src/modules/auth/components/ProfileDropdown.vue
```

- [ ] **Step 2: Trim `LoginForm.vue`**

Remove the "¿No tienes cuenta?" block — the template's closing section currently reads:

```html
    <p class="mt-6 text-center text-sm text-slate-500">
      ¿No tienes cuenta?
      <button type="button" @click="switchTo('register')"
        class="font-semibold text-brand-700 hover:text-brand-800">
        Regístrate
      </button>
    </p>
  </div>
</template>
```

Replace with:

```html
  </div>
</template>
```

The `<script setup>` block currently reads:

```typescript
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '../composables/useAuthModal'

const authStore      = useAuthStore()
const { switchTo, close } = useAuthModal()
const router         = useRouter()

const email    = ref('')
const password = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const error    = ref<string | null>(null)

async function handleLogin() {
  error.value   = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    // signIn dispara onAuthStateChange que inicia fetchProfile en paralelo;
    // lo llamamos explícitamente para asegurar que profile esté listo.
    if (authStore.user) await authStore.fetchProfile(authStore.user.id)

    if (authStore.isAdmin) {
      close()
      router.push('/admin/products')
    } else if (!authStore.profile?.full_name) {
      switchTo('onboarding')
    } else {
      close()
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>
```

Replace with:

```typescript
import { ref } from 'vue'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const error    = ref<string | null>(null)

async function handleLogin() {
  error.value   = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    if (authStore.user) await authStore.fetchProfile(authStore.user.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>
```

(No navigation call on success — `App.vue`'s gate, Task 7, reacts to `authStore`'s state automatically and swaps the login form out for either the restricted-access message or `AdminLayout` once Pinia's state updates. No `<style scoped>` change — it's untouched.)

- [ ] **Step 3: Trim `ProfileDropdown.vue`**

The template's "Acciones" section currently reads:

```html
        <!-- Acciones -->
        <div class="dropdown-body">
          <button class="dropdown-item" @click="onOrders">
            <Package class="h-3.5 w-3.5 flex-shrink-0" />
            Mis pedidos
          </button>
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

Replace with:

```html
        <!-- Acciones -->
        <div class="dropdown-body">
          <button class="dropdown-item dropdown-item--danger" @click="onSignOut">
            <LogOut class="h-3.5 w-3.5 flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
```

The `<script setup>` block currently reads:

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, LogOut, Package } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '../composables/useAuthModal'

const authStore = useAuthStore()
const { open }  = useAuthModal()
const router    = useRouter()

const isOpen       = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitials = computed(() => {
  const name = authStore.profile?.full_name ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

function toggle() { isOpen.value = !isOpen.value }

function handleOutsideClick(e: MouseEvent) {
  if (!containerRef.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

function onEditProfile() {
  isOpen.value = false
  open('editProfile')
}

function onOrders() {
  isOpen.value = false
  router.push('/orders')
}

async function onSignOut() {
  isOpen.value = false
  await authStore.signOut()
}
</script>
```

Replace with:

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { LogOut } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()

const isOpen       = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitials = computed(() => {
  const name = authStore.profile?.full_name ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

function toggle() { isOpen.value = !isOpen.value }

function handleOutsideClick(e: MouseEvent) {
  if (!containerRef.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

async function onSignOut() {
  isOpen.value = false
  await authStore.signOut()
}
</script>
```

The now-unused `.dropdown-divider` CSS rule in `<style scoped>` can stay (harmless dead rule, matches the project's "don't touch unrelated code" convention — it's still valid CSS, just unreferenced).

- [ ] **Step 4: Verify it compiles**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean). (No tests — presentational components, per convention.)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/modules/auth
git commit -m "feat(dashboard): add trimmed LoginForm and ProfileDropdown for admin auth"
```

---

### Task 5: Port `AdminLayout.vue`

**Files:**
- Create: `apps/dashboard/src/modules/admin/layouts/AdminLayout.vue`

**Interfaces:**
- Consumes: `ProfileDropdown` from Task 4.
- Produces: `AdminLayout.vue` — a self-contained (`fixed inset-0`) full-viewport shell with its own top bar and floating sidebar nav, wrapping `<RouterView />`. Task 7 consumes it.

- [ ] **Step 1: Copy the layout verbatim**

Run from `C:\Users\juanf\fs`:

```bash
mkdir -p fsparts-platform/apps/dashboard/src/modules/admin/layouts
cp fsp_web/src/modules/admin/layouts/AdminLayout.vue fsparts-platform/apps/dashboard/src/modules/admin/layouts/AdminLayout.vue
```

- [ ] **Step 2: Point "Ver tienda" at the cross-origin shop URL**

Lines 29-37 currently read:

```html
      <RouterLink
        to="/"
        class="relative group flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <ExternalLink class="h-5 w-5 flex-shrink-0" />
        <span class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Ver tienda
        </span>
      </RouterLink>
```

Replace with:

```html
      <a
        :href="shopUrl"
        class="relative group flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <ExternalLink class="h-5 w-5 flex-shrink-0" />
        <span class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Ver tienda
        </span>
      </a>
```

- [ ] **Step 3: Fix the nav paths, the `ProfileDropdown` import, and add `shopUrl`**

Lines 48-60 currently read:

```typescript
import { useRoute } from 'vue-router'
import { Package, Layers, Users, ExternalLink, ShoppingBag } from '@lucide/vue'
import ProfileDropdown from '@/modules/auth/components/ProfileDropdown.vue'

const route = useRoute()

const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package     },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers      },
  { to: '/admin/customers', label: 'Clientes',  icon: Users       },
  { to: '/admin/sales',     label: 'Ventas',    icon: ShoppingBag },
]
```

Replace with:

```typescript
import { useRoute } from 'vue-router'
import { Package, Layers, Users, ExternalLink, ShoppingBag } from '@lucide/vue'
import ProfileDropdown from '../../auth/components/ProfileDropdown.vue'

const route = useRoute()

const shopUrl = import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org'

const navItems = [
  { to: '/products',  label: 'Productos', icon: Package     },
  { to: '/catalog',   label: 'Catálogo',  icon: Layers      },
  { to: '/customers', label: 'Clientes',  icon: Users       },
  { to: '/sales',     label: 'Ventas',    icon: ShoppingBag },
]
```

- [ ] **Step 4: Verify it compiles**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/modules/admin/layouts
git commit -m "feat(dashboard): port AdminLayout with flat routes and cross-origin shop link"
```

---

### Task 6: Wire the admin route table, retire the placeholder `HomeView`

**Files:**
- Modify: `apps/dashboard/src/router/index.ts`
- Delete: `apps/dashboard/src/views/HomeView.vue`

**Interfaces:**
- Consumes: `AdminProductsView`/`AdminProductFormView`/`AdminCatalogView`/`AdminCustomersView`/`AdminSalesView` from Tasks 2-3.
- Produces: 6 routes, none gated at the router level (gating is Task 7's job). Task 7's test navigates through this router.

- [ ] **Step 1: Replace the router's placeholder route**

Replace the full contents of `apps/dashboard/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/products' },
    { path: '/products',          name: 'admin-products',     component: () => import('../modules/admin/views/AdminProductsView.vue') },
    { path: '/products/new',      name: 'admin-product-new',  component: () => import('../modules/admin/views/AdminProductFormView.vue') },
    { path: '/products/:id/edit', name: 'admin-product-edit', component: () => import('../modules/admin/views/AdminProductFormView.vue') },
    { path: '/catalog',           name: 'admin-catalog',      component: () => import('../modules/admin/views/AdminCatalogView.vue') },
    { path: '/customers',         name: 'admin-customers',    component: () => import('../modules/admin/views/AdminCustomersView.vue') },
    { path: '/sales',             name: 'admin-sales',        component: () => import('../modules/admin/views/AdminSalesView.vue') },
  ],
})

export default router
```

- [ ] **Step 2: Delete the placeholder home view**

```bash
git rm apps/dashboard/src/views/HomeView.vue
```

- [ ] **Step 3: Verify**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean).

Run: `npm run build:dashboard`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/router/index.ts
git commit -m "feat(dashboard): wire admin route table, retire placeholder HomeView"
```

(The `HomeView.vue` deletion from Step 2 is already staged by `git rm`.)

---

### Task 7: `App.vue` — the app-wide auth gate

**Files:**
- Modify: `apps/dashboard/src/App.vue`
- Modify: `apps/dashboard/src/App.test.ts`

**Interfaces:**
- Consumes: `useAuthStore` from `@fsparts/core`; `AppHeader`/`AppFooter`/`AppToast`/`AppSpinner` from `@fsparts/ui`; `LoginForm` from Task 4; `AdminLayout` from Task 5; the router from Task 6.
- Produces: the finished, gated `apps/dashboard` entrypoint.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/dashboard/src/App.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import router from './router'

const authState = reactive({
  isReady: false,
  isAuthenticated: false,
  isAdmin: false,
  user: null as { id: string } | null,
  profile: null,
  signOut: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import App from './App.vue'

describe('App gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    authState.isReady = false
    authState.isAuthenticated = false
    authState.isAdmin = false
    authState.user = null
  })

  it('shows a spinner while the auth store is not ready', async () => {
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('shows the login form when unauthenticated', async () => {
    authState.isReady = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Iniciar sesión')
  })

  it('shows a restricted-access message for an authenticated non-admin', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Acceso restringido')
  })

  it('shows AdminLayout for an admin', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    authState.isAdmin = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('FS Parts Dashboard')
  })
})
```

(`vi.mock` uses `importOriginal` and spreads `...actual` so every other `@fsparts/core` export — `supabase`, `fetchProductLines`, etc., which the routed admin views need — stays real; only `useAuthStore` is replaced with a plain reactive object the test controls directly, avoiding the real store's `init()` racing ahead of each test's intended state.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run apps/dashboard/src/App.test.ts`
Expected: FAIL — all 4 tests fail. The current `App.vue` unconditionally renders `<RouterView />` with no gate, so it never shows a spinner, `LoginForm`, or the restricted-access message, and it never mounts `AdminLayout` (only the bare routed view), so `'FS Parts Dashboard'` (a string that only `AdminLayout`'s top bar renders) never appears either.

- [ ] **Step 3: Implement the gate**

Replace the full contents of `apps/dashboard/src/App.vue`:

```vue
<template>
  <AdminLayout v-if="authStore.isReady && authStore.isAuthenticated && authStore.isAdmin" />

  <div v-else class="min-h-screen flex flex-col">
    <AppHeader app-label="Dashboard" current-app-id="dashboard">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
    <main class="flex-1 flex items-center justify-center py-12 px-6">
      <AppSpinner v-if="!authStore.isReady" size="lg" class="text-brand-600" />
      <div v-else-if="!authStore.isAuthenticated" class="w-full max-w-sm bg-white rounded-2xl border border-slate-200">
        <LoginForm />
      </div>
      <div v-else class="text-center">
        <p class="text-sm font-semibold text-slate-500">Acceso restringido</p>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Esta sección es solo para administradores de FSP Parts.</p>
        <button
          @click="authStore.signOut()"
          class="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast, AppSpinner } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import LoginForm from './modules/auth/components/LoginForm.vue'
import AdminLayout from './modules/admin/layouts/AdminLayout.vue'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
```

(`AdminLayout` is rendered on its own, not nested inside the `AppHeader`/`AppFooter` shell — its root element is `fixed inset-0` with its own top bar, designed in `fsp_web` to fully replace the surrounding chrome, not sit inside it. Nesting it inside `AppHeader`/`AppFooter` would stack two headers and two `z-40` fixed elements on top of each other.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run apps/dashboard/src/App.test.ts`
Expected: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.vue apps/dashboard/src/App.test.ts
git commit -m "feat(dashboard): add app-wide auth gate for admin-only access"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full monorepo test suite**

Run: `npm test`
Expected: all test files pass. This phase touches only `apps/dashboard/src/App.test.ts` (rewritten: 1 test → 4 tests, net +3), adding no new test files. Compared to the pre-phase baseline (16 files / 72 tests, confirmed at the top of this plan), expect `Test Files 16 passed (16)`, `Tests 75 passed (75)`.

- [ ] **Step 2: Type-check the touched app**

Run: `npx vue-tsc --noEmit -p apps/dashboard/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 3: Build the touched app**

Run: `npm run build:dashboard`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git commit --allow-empty -m "chore: verify Phase 4 admin panel migration builds and tests pass end to end"
```
