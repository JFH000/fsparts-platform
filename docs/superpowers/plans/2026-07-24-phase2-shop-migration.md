# Phase 2: Migrate the Shop Vertical to `apps/shop` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the shop vertical (landing, catalog, cart, checkout, orders, auth) from `fsp_web` into `apps/shop`, so `apps/shop` reaches functional parity with `fsp_web`'s shop experience and real cross-subdomain SSO becomes testable end-to-end.

**Architecture:** Each `fsp_web` module (`src/modules/{landing,catalog,cart,orders,auth}`) ports to `apps/shop/src/modules/*`, preserving internal structure (components/composables/stores/services/views). `apps/shop` gains its own `@` → `./src` alias (mirroring `fsp_web`'s own Vite convention) so most cross-module imports (`@/modules/...`) port unchanged; only imports pointing at code that moved into the shared packages (`@fsparts/core`, `@fsparts/ui`) or that moved location during the port need editing.

**Tech Stack:** Vue 3.5, Vue Router 4.6, Pinia 3, `@fsparts/core`, `@fsparts/ui`, `@lucide/vue`, `@vueuse/core`, Vitest 4.

## Global Constraints

- Source repo for every ported file: `C:\Users\juanf\fs\fsp_web`. Destination repo: `C:\Users\juanf\fs\fsparts-platform`, app `apps/shop`.
- **Porting method:** every task below names an exact source path and an exact destination path. Where the file needs no import changes, the step is a plain copy. Where it does, the step gives the exact before → after line(s) to change after copying — this is the complete instruction; do not improvise additional changes and do not change anything not listed.
- **Import mapping rules** (apply consistently across every file in this plan):
  - `@/shared/types` → `@fsparts/core`
  - `@/shared/utils/currency` → `@fsparts/core`
  - `@/shared/composables/useToast` → `@fsparts/ui`
  - `@/shared/components/ui/AppButton.vue` (default import `AppButton`) → `@fsparts/ui` (named import `{ AppButton }`)
  - `@/shared/components/ui/AppBadge.vue` → `@fsparts/ui` (named import `{ AppBadge }`)
  - `@/shared/components/ui/AppSpinner.vue` → `@fsparts/ui` (named import `{ AppSpinner }`)
  - `@/shared/components/ui/OrderStatusBadge.vue` → `@fsparts/ui` (named import `{ OrderStatusBadge }`)
  - `@/modules/auth/stores/auth.store` (named import `useAuthStore`) → `@fsparts/core`
  - `@/core/supabase/client` (named import `supabase`) → `@fsparts/core`
  - `@/core/supabase/catalog.service` → `@/modules/catalog/services/catalog.service` (this file's location changes as part of the port — see Task 3)
  - Any other `@/modules/...` import is left **unchanged** — the target module ports to the identical relative path under `apps/shop/src/modules/`, and the new `@` alias (Task 1) resolves it the same way `fsp_web` does today.
- Behavior must match `fsp_web` exactly. This is a pure frontend port — no new features, no changed business logic, no backend/Supabase schema changes (already confirmed: `apps/shop`'s deployed env vars point at the same Supabase project `fsp_web` uses).
- Out of scope: `/hvac-calculator` route (Phase 3), `/admin/*` routes (Phase 4), any change to `fsp_web` itself.
- Testing convention (matches `fsp_web` and Phase 1): only business logic (stores/composables) is unit-tested. The three existing test files (`cart.store.test.ts`, `useAuthModal.test.ts`, `useProductPrice.test.ts`) port with the same import-mapping rules above. No new tests are added for views, components, or the thin Supabase-wrapper services (`catalog.service`, `checkout.service`, `addresses.service`, `orders.service`) — same judgment Phase 1 already applied to `auth.store.ts`'s `signIn`/`signUp`/`fetchProfile`.
- None of the three ported test files need `// @vitest-environment jsdom` — verified against their current `fsp_web` versions, none have that pragma today (they test pure Pinia/composable logic, no DOM).
- Verification per task: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json` (must exit 0) after every task that adds/modifies `.vue`/`.ts` files, plus the task's own tests where it has them.

All file paths below are relative to `C:\Users\juanf\fs\fsparts-platform` unless stated otherwise. Source paths are relative to `C:\Users\juanf\fs\fsp_web` unless stated otherwise.

---

### Task 1: Workspace setup (`@` alias, dependencies) and auth forms/modal

**Files:**
- Modify: `apps/shop/package.json`
- Modify: `apps/shop/vite.config.ts`
- Modify: `apps/shop/tsconfig.json`
- Create: `apps/shop/src/modules/auth/composables/useAuthModal.ts` (from `src/modules/auth/composables/useAuthModal.ts`)
- Test: `apps/shop/src/modules/auth/composables/__tests__/useAuthModal.test.ts` (from `src/modules/auth/composables/__tests__/useAuthModal.test.ts`)
- Create: `apps/shop/src/modules/auth/components/AuthModal.vue` (from `src/modules/auth/components/AuthModal.vue`)
- Create: `apps/shop/src/modules/auth/components/LoginForm.vue` (from `src/modules/auth/components/LoginForm.vue`)
- Create: `apps/shop/src/modules/auth/components/RegisterForm.vue` (from `src/modules/auth/components/RegisterForm.vue`)
- Create: `apps/shop/src/modules/auth/components/OnboardingForm.vue` (from `src/modules/auth/components/OnboardingForm.vue`)
- Create: `apps/shop/src/modules/auth/components/EditProfileForm.vue` (from `src/modules/auth/components/EditProfileForm.vue`)

**Interfaces:**
- Consumes: `useAuthStore` from `@fsparts/core` (Phase 1).
- Produces: `useAuthModal(): { mode, open, close, switchTo }` from `./composables/useAuthModal`; `AuthModal` component (no props) from `./components/AuthModal.vue`, which internally renders `LoginForm`/`RegisterForm`/`OnboardingForm`/`EditProfileForm` based on `useAuthModal().mode`.

- [ ] **Step 1: Add the `@` alias and new dependencies**

Edit `apps/shop/package.json` — add two dependencies (alphabetical, matching how `packages/ui/package.json` already declares them):

```json
{
  "name": "shop",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "@lucide/vue": "^1.17.0",
    "@vueuse/core": "^14.3.0",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
}
```

Edit `apps/shop/vite.config.ts` — add a `@` alias pointing at this app's own `src/`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5173 },
})
```

Edit `apps/shop/tsconfig.json` — add `"@/*": ["./src/*"]` to `paths` (no `baseUrl`, consistent with how the rest of this repo's tsconfigs already avoid the TS 6→7 `baseUrl` deprecation):

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@fsparts/ui": ["../../packages/ui/src/index.ts"],
      "@fsparts/core": ["../../packages/core/src/index.ts"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 2: Install and verify the new dependencies resolve**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npm install`
Expected: exits 0. This updates `package-lock.json` — you MUST include it in this task's commit (`git status` will show it modified; a prior Phase 1 task's review specifically caught a missed lockfile commit — don't repeat that).

- [ ] **Step 3: Port `useAuthModal.ts` — write the test first**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\composables\__tests__"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\composables\__tests__\useAuthModal.test.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\composables\__tests__\useAuthModal.test.ts"
```

This test file needs no import edits (it only imports from `vitest` and the relative `../useAuthModal`).

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/shop/src/modules/auth/composables/__tests__/useAuthModal.test.ts`
Expected: FAIL — `Cannot find module '../useAuthModal'` (implementation doesn't exist yet).

- [ ] **Step 5: Port `useAuthModal.ts`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\composables\useAuthModal.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\composables\useAuthModal.ts"
```

No import edits needed — this file only imports `ref` from `vue`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run apps/shop/src/modules/auth/composables/__tests__/useAuthModal.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 7: Port `AuthModal.vue` and the four form components**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\AuthModal.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\AuthModal.vue"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\LoginForm.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\LoginForm.vue"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\RegisterForm.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\RegisterForm.vue"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\OnboardingForm.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\OnboardingForm.vue"
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\EditProfileForm.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\EditProfileForm.vue"
```

`AuthModal.vue` needs no import edits (only `vue`, `@lucide/vue`, and relative imports).

In each of `LoginForm.vue`, `RegisterForm.vue`, `OnboardingForm.vue`, `EditProfileForm.vue`, change this one line:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
+import { useAuthStore } from '@fsparts/core'
```

- [ ] **Step 8: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0, no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/shop/package.json apps/shop/vite.config.ts apps/shop/tsconfig.json apps/shop/src/modules/auth package-lock.json
git commit -m "feat(shop): add @ alias, port AuthModal and its four forms"
```

---

### Task 2: Wire real auth into the shared header

**Files:**
- Create: `apps/shop/src/modules/auth/components/ProfileDropdown.vue` (from `src/modules/auth/components/ProfileDropdown.vue`)
- Modify: `apps/shop/src/App.vue`

**Interfaces:**
- Consumes: `AuthModal`, `useAuthModal` (Task 1); `ProfileDropdown` (this task); `useAuthStore` from `@fsparts/core`.
- Produces: `apps/shop/src/App.vue` now renders real login/profile UI in the header instead of the static "Cuenta" placeholder, and mounts `AuthModal` at the app root.

- [ ] **Step 1: Port `ProfileDropdown.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\auth\components\ProfileDropdown.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\auth\components\ProfileDropdown.vue"
```

Change this one line:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
+import { useAuthStore } from '@fsparts/core'
```

(Its other import, `import { useAuthModal } from '../composables/useAuthModal'`, is unchanged.)

- [ ] **Step 2: Wire the header's `#actions` slot to real auth state**

Replace the full contents of `apps/shop/src/App.vue` with:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Shop" current-app-id="shop">
      <template #actions>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          @click="openAuthModal('login')"
        >
          Iniciar sesión
        </button>
        <ProfileDropdown v-else />
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
    <AuthModal />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AuthModal from './modules/auth/components/AuthModal.vue'
import ProfileDropdown from './modules/auth/components/ProfileDropdown.vue'
import { useAuthModal } from './modules/auth/composables/useAuthModal'

const authStore = useAuthStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => { authStore.init() })
</script>
```

- [ ] **Step 3: Type-check and build**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

Run: `npm run build --workspace=apps/shop`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/shop/src/modules/auth/components/ProfileDropdown.vue apps/shop/src/App.vue
git commit -m "feat(shop): wire real login/profile UI into the shared header"
```

---

### Task 3: Catalog foundation — pricing, mock data, service, store

**Files:**
- Create: `apps/shop/src/modules/catalog/composables/useProductPrice.ts` (from `src/modules/catalog/composables/useProductPrice.ts`)
- Test: `apps/shop/src/modules/catalog/composables/__tests__/useProductPrice.test.ts` (from `src/modules/catalog/composables/__tests__/useProductPrice.test.ts`)
- Create: `apps/shop/src/modules/catalog/data/mock.ts` (from `src/modules/catalog/data/mock.ts`)
- Create: `apps/shop/src/modules/catalog/services/catalog.service.ts` (from `src/core/supabase/catalog.service.ts`)
- Create: `apps/shop/src/modules/catalog/stores/catalog.store.ts` (from `src/modules/catalog/stores/catalog.store.ts`)

**Interfaces:**
- Consumes: `useAuthStore`, `Product`/`ProductLine`/`Brand`/`Category`/`FilterState`/`SortOption`/`UserRole` types, `supabase` — all from `@fsparts/core`.
- Produces: `useProductPrice()`, `resolveEffectivePrice(product, quantity, role)` from `./composables/useProductPrice`; `PRODUCTS`/`PRODUCT_LINES`/`BRANDS`/`CATEGORIES`/`REFRIGERANTS`/`MAX_PRICE` from `./data/mock`; `fetchProducts`/`fetchProductLines`/`fetchBrands`/`fetchCategories` from `./services/catalog.service`; `useCatalogStore()` Pinia store from `./stores/catalog.store`.

- [ ] **Step 1: Port `useProductPrice.ts` — write the test first**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\composables\__tests__"
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\composables\__tests__\useProductPrice.test.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\composables\__tests__\useProductPrice.test.ts"
```

Change these two lines:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
-import type { Product } from '@/shared/types'
+import { useAuthStore } from '@fsparts/core'
+import type { Product } from '@fsparts/core'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/shop/src/modules/catalog/composables/__tests__/useProductPrice.test.ts`
Expected: FAIL — `Cannot find module '../useProductPrice'`.

- [ ] **Step 3: Port `useProductPrice.ts`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\composables\useProductPrice.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\composables\useProductPrice.ts"
```

Change these two lines:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
-import type { Product, UserRole } from '@/shared/types'
+import { useAuthStore } from '@fsparts/core'
+import type { Product, UserRole } from '@fsparts/core'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/shop/src/modules/catalog/composables/__tests__/useProductPrice.test.ts`
Expected: PASS.

- [ ] **Step 5: Port `data/mock.ts`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\data"
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\data\mock.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\data\mock.ts"
```

Change this one line:

```diff
-import type { ProductLine, Brand, Category, Product } from '@/shared/types'
+import type { ProductLine, Brand, Category, Product } from '@fsparts/core'
```

- [ ] **Step 6: Port `catalog.service.ts`** (note: this file moves from `fsp_web`'s `src/core/supabase/` into this module's own `services/` folder — it's shop-only business logic, not shared platform code)

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\services"
cp "C:\Users\juanf\fs\fsp_web\src\core\supabase\catalog.service.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\services\catalog.service.ts"
```

Change these two lines:

```diff
-import { supabase } from './client'
+import { supabase } from '@fsparts/core'
```
```diff
-import type { Product, ProductLine, Brand, Category } from '@/shared/types'
+import type { Product, ProductLine, Brand, Category } from '@fsparts/core'
```

The remaining import, `import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES } from '@/modules/catalog/data/mock'`, is unchanged — the new `@` alias resolves it to the file ported in Step 5.

- [ ] **Step 7: Port `catalog.store.ts`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\stores"
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\stores\catalog.store.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\stores\catalog.store.ts"
```

Change these two lines:

```diff
-import type { Product, ProductLine, Brand, Category, FilterState, SortOption } from '@/shared/types'
+import type { Product, ProductLine, Brand, Category, FilterState, SortOption } from '@fsparts/core'
```
```diff
-import { fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from '@/core/supabase/catalog.service'
+import { fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from '@/modules/catalog/services/catalog.service'
```

The `import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES, REFRIGERANTS, MAX_PRICE } from '../data/mock'` line is unchanged (relative, and the target ported in Step 5).

- [ ] **Step 8: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add apps/shop/src/modules/catalog/composables apps/shop/src/modules/catalog/data apps/shop/src/modules/catalog/services apps/shop/src/modules/catalog/stores
git commit -m "feat(shop): port catalog pricing, mock data, Supabase service, and store"
```

---

### Task 4: Catalog views and components

**Files:**
- Create: `apps/shop/src/modules/catalog/views/CatalogView.vue` (from `src/modules/catalog/views/CatalogView.vue`)
- Create: `apps/shop/src/modules/catalog/views/ProductDetailView.vue` (from `src/modules/catalog/views/ProductDetailView.vue`)
- Create: `apps/shop/src/modules/catalog/components/FilterSidebar.vue` (from `src/modules/catalog/components/FilterSidebar.vue`)
- Create: `apps/shop/src/modules/catalog/components/FilterSection.vue` (from `src/modules/catalog/components/FilterSection.vue`)
- Create: `apps/shop/src/modules/catalog/components/ProductCard.vue` (from `src/modules/catalog/components/ProductCard.vue`)

**Interfaces:**
- Consumes: `useCatalogStore` (Task 3); `useProductPrice` (Task 3); `useCartStore` from `@/modules/cart/stores/cart.store` (ports in Task 5 — these views won't type-check clean until Task 5 lands `cart.store.ts`, which is expected and resolved by then); `AppBadge` from `@fsparts/ui`; `formatCurrency` from `@fsparts/core`.
- Produces: the `/catalog` and `/product/:id` views, wired into the router in Task 10.

- [ ] **Step 1: Port `CatalogView.vue` and `FilterSection.vue` (no import edits needed)**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\views"
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\components"
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\views\CatalogView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\views\CatalogView.vue"
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\components\FilterSection.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\components\FilterSection.vue"
```

- [ ] **Step 2: Port `ProductDetailView.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\views\ProductDetailView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\views\ProductDetailView.vue"
```

Change these two lines:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
-import { formatCurrency } from '@/shared/utils/currency'
+import { useAuthStore } from '@fsparts/core'
+import { formatCurrency } from '@fsparts/core'
```

Change this line:

```diff
-import AppBadge from '@/shared/components/ui/AppBadge.vue'
+import { AppBadge } from '@fsparts/ui'
```

The `import { useCartStore } from '@/modules/cart/stores/cart.store'` and `import { useProductPrice } from '@/modules/catalog/composables/useProductPrice'` lines are unchanged.

- [ ] **Step 3: Port `FilterSidebar.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\components\FilterSidebar.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\components\FilterSidebar.vue"
```

Change this line:

```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```

(Its `import { useCatalogStore } from '../stores/catalog.store'` and `import FilterSection from './FilterSection.vue'` lines are unchanged.)

- [ ] **Step 4: Port `ProductCard.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\catalog\components\ProductCard.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\catalog\components\ProductCard.vue"
```

Change these lines:

```diff
-import type { Product } from '@/shared/types'
-import { formatCurrency } from '@/shared/utils/currency'
+import type { Product } from '@fsparts/core'
+import { formatCurrency } from '@fsparts/core'
```
```diff
-import AppBadge from '@/shared/components/ui/AppBadge.vue'
+import { AppBadge } from '@fsparts/ui'
```

The `import { useCartStore } from '@/modules/cart/stores/cart.store'` and `import { useProductPrice } from '@/modules/catalog/composables/useProductPrice'` lines are unchanged.

- [ ] **Step 5: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0. (`useCartStore` resolves because `cart.store.ts` doesn't exist yet — if this errors on the missing module, that confirms it's correctly wired to fail until Task 5; proceed to Task 5 immediately after this task's commit so the app isn't left broken for long. If your workflow requires every task to leave `vue-tsc` green, do Task 5's store-only work — Step 1 there — before this task's Step 5, then continue this task's remaining steps.)

- [ ] **Step 6: Commit**

```bash
git add apps/shop/src/modules/catalog/views apps/shop/src/modules/catalog/components
git commit -m "feat(shop): port catalog views and components"
```

---

### Task 5: Cart store and drawer

**Files:**
- Create: `apps/shop/src/modules/cart/stores/cart.store.ts` (from `src/modules/cart/stores/cart.store.ts`)
- Test: `apps/shop/src/modules/cart/stores/__tests__/cart.store.test.ts` (from `src/modules/cart/stores/__tests__/cart.store.test.ts`)
- Create: `apps/shop/src/modules/cart/components/CartDrawer.vue` (from `src/modules/cart/components/CartDrawer.vue`)
- Modify: `apps/shop/src/App.vue`

**Interfaces:**
- Consumes: `useAuthStore`, `Product`/`CartItem` types, `formatCurrency` — all from `@fsparts/core`; `resolveEffectivePrice` from `../catalog/composables/useProductPrice` (Task 3); `AppButton` from `@fsparts/ui`.
- Produces: `useCartStore()` Pinia store (id `'cart'`) exposing `items`, `isDrawerOpen`, `totalItems`, `subtotal`, `lineUnitPrice`, `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `openDrawer`, `closeDrawer` — this resolves the `useCartStore` imports left pending by Task 4. `CartDrawer` component (no props), mounted at the app root.

- [ ] **Step 1: Port `cart.store.ts` — write the test first**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\stores\__tests__"
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\stores\__tests__\cart.store.test.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\stores\__tests__\cart.store.test.ts"
```

Change these two lines:

```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
-import type { Product } from '@/shared/types'
+import { useAuthStore } from '@fsparts/core'
+import type { Product } from '@fsparts/core'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/shop/src/modules/cart/stores/__tests__/cart.store.test.ts`
Expected: FAIL — `Cannot find module '../cart.store'`.

- [ ] **Step 3: Port `cart.store.ts`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\stores\cart.store.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\stores\cart.store.ts"
```

Change these two lines:

```diff
-import type { CartItem, Product } from '@/shared/types'
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
+import type { CartItem, Product } from '@fsparts/core'
+import { useAuthStore } from '@fsparts/core'
```

(`import { resolveEffectivePrice } from '@/modules/catalog/composables/useProductPrice'` is unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/shop/src/modules/cart/stores/__tests__/cart.store.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Port `CartDrawer.vue`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\components"
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\components\CartDrawer.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\components\CartDrawer.vue"
```

Change these lines:

```diff
-import AppButton from '@/shared/components/ui/AppButton.vue'
+import { AppButton } from '@fsparts/ui'
```
```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```

(`import { useCartStore } from '../stores/cart.store'` is unchanged.)

- [ ] **Step 6: Mount `CartDrawer` in `App.vue`**

Replace the full contents of `apps/shop/src/App.vue` with:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Shop" current-app-id="shop">
      <template #actions>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          @click="openAuthModal('login')"
        >
          Iniciar sesión
        </button>
        <ProfileDropdown v-else />
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
    <AuthModal />
    <CartDrawer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AuthModal from './modules/auth/components/AuthModal.vue'
import ProfileDropdown from './modules/auth/components/ProfileDropdown.vue'
import { useAuthModal } from './modules/auth/composables/useAuthModal'
import CartDrawer from './modules/cart/components/CartDrawer.vue'

const authStore = useAuthStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => { authStore.init() })
</script>
```

- [ ] **Step 7: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0 (this also resolves the `useCartStore` imports left pending by Task 4).

- [ ] **Step 8: Commit**

```bash
git add apps/shop/src/modules/cart/stores apps/shop/src/modules/cart/components apps/shop/src/App.vue
git commit -m "feat(shop): port cart store and drawer, mount drawer in App.vue"
```

---

### Task 6: Cart view

**Files:**
- Create: `apps/shop/src/modules/cart/views/CartView.vue` (from `src/modules/cart/views/CartView.vue`)

**Interfaces:**
- Consumes: `useCartStore` (Task 5); `formatCurrency` from `@fsparts/core`; `AppButton` from `@fsparts/ui`.
- Produces: the `/cart` view, wired into the router in Task 10.

- [ ] **Step 1: Port `CartView.vue`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\views"
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\views\CartView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\views\CartView.vue"
```

Change these lines:

```diff
-import AppButton from '@/shared/components/ui/AppButton.vue'
+import { AppButton } from '@fsparts/ui'
```
```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```

(`import { useCartStore } from '../stores/cart.store'` is unchanged.)

- [ ] **Step 2: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/modules/cart/views
git commit -m "feat(shop): port CartView"
```

---

### Task 7: Checkout

**Files:**
- Create: `apps/shop/src/modules/cart/services/addresses.service.ts` (from `src/modules/cart/services/addresses.service.ts`)
- Create: `apps/shop/src/modules/cart/services/checkout.service.ts` (from `src/modules/cart/services/checkout.service.ts`)
- Create: `apps/shop/src/modules/cart/views/CheckoutView.vue` (from `src/modules/cart/views/CheckoutView.vue`)

**Interfaces:**
- Consumes: `supabase`, `CartItem`/`ShippingAddress` types, `useAuthStore`, `formatCurrency` — from `@fsparts/core`; `useCartStore` (Task 5); `AppButton`, `useToast` from `@fsparts/ui`.
- Produces: `createCheckoutSession(items, shipping)` from `./services/checkout.service`; `listAddresses()`/`createAddress(...)` from `./services/addresses.service`; the `/checkout` view, wired into the router in Task 10.

- [ ] **Step 1: Port `addresses.service.ts`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\services"
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\services\addresses.service.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\services\addresses.service.ts"
```

Change these two lines:

```diff
-import { supabase } from '@/core/supabase/client'
-import type { ShippingAddress } from '@/shared/types'
+import { supabase } from '@fsparts/core'
+import type { ShippingAddress } from '@fsparts/core'
```

- [ ] **Step 2: Port `checkout.service.ts`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\services\checkout.service.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\services\checkout.service.ts"
```

Change these two lines:

```diff
-import { supabase } from '@/core/supabase/client'
-import type { CartItem } from '@/shared/types'
+import { supabase } from '@fsparts/core'
+import type { CartItem } from '@fsparts/core'
```

- [ ] **Step 3: Port `CheckoutView.vue`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\views"
cp "C:\Users\juanf\fs\fsp_web\src\modules\cart\views\CheckoutView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\cart\views\CheckoutView.vue"
```

Change these lines:

```diff
-import AppButton from '@/shared/components/ui/AppButton.vue'
+import { AppButton } from '@fsparts/ui'
```
```diff
-import { useAuthStore } from '@/modules/auth/stores/auth.store'
-import { formatCurrency } from '@/shared/utils/currency'
+import { useAuthStore } from '@fsparts/core'
+import { formatCurrency } from '@fsparts/core'
```
```diff
-import { useToast } from '@/shared/composables/useToast'
-import type { ShippingAddress } from '@/shared/types'
+import { useToast } from '@fsparts/ui'
+import type { ShippingAddress } from '@fsparts/core'
```

(`import { useCartStore } from '../stores/cart.store'`, `import { createCheckoutSession } from '../services/checkout.service'`, and `import { listAddresses, createAddress } from '../services/addresses.service'` are unchanged.)

- [ ] **Step 4: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/shop/src/modules/cart/services apps/shop/src/modules/cart/views/CheckoutView.vue
git commit -m "feat(shop): port checkout flow (addresses, Stripe session, CheckoutView)"
```

---

### Task 8: Orders

**Files:**
- Create: `apps/shop/src/modules/orders/services/orders.service.ts` (from `src/modules/orders/services/orders.service.ts`)
- Create: `apps/shop/src/modules/orders/views/OrdersView.vue` (from `src/modules/orders/views/OrdersView.vue`)
- Create: `apps/shop/src/modules/orders/views/OrderDetailView.vue` (from `src/modules/orders/views/OrderDetailView.vue`)
- Create: `apps/shop/src/modules/orders/views/OrderConfirmationView.vue` (from `src/modules/orders/views/OrderConfirmationView.vue`)

**Interfaces:**
- Consumes: `supabase`, `Order` type, `formatCurrency` — from `@fsparts/core`; `AppSpinner`, `OrderStatusBadge` from `@fsparts/ui`; `useCartStore` (Task 5, used by `OrderConfirmationView` to clear the cart after a successful payment).
- Produces: `fetchOrderBySessionId(id)`, `listMyOrders()`, `fetchOrderById(id)` from `./services/orders.service`; the `/orders`, `/orders/:id`, `/pedido-confirmado` views, wired into the router in Task 10.

- [ ] **Step 1: Port `orders.service.ts`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\services"
cp "C:\Users\juanf\fs\fsp_web\src\modules\orders\services\orders.service.ts" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\services\orders.service.ts"
```

Change these two lines:

```diff
-import { supabase } from '@/core/supabase/client'
-import type { Order } from '@/shared/types'
+import { supabase } from '@fsparts/core'
+import type { Order } from '@fsparts/core'
```

- [ ] **Step 2: Port `OrdersView.vue`**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\views"
cp "C:\Users\juanf\fs\fsp_web\src\modules\orders\views\OrdersView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\views\OrdersView.vue"
```

Change these lines:

```diff
-import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
-import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
+import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
```
```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```
```diff
-import type { Order } from '@/shared/types'
+import type { Order } from '@fsparts/core'
```

(`import { listMyOrders } from '../services/orders.service'` is unchanged.)

- [ ] **Step 3: Port `OrderDetailView.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\orders\views\OrderDetailView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\views\OrderDetailView.vue"
```

Change these lines:

```diff
-import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
-import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
+import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
```
```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```
```diff
-import type { Order } from '@/shared/types'
+import type { Order } from '@fsparts/core'
```

(`import { fetchOrderById } from '../services/orders.service'` is unchanged.)

- [ ] **Step 4: Port `OrderConfirmationView.vue`**

```bash
cp "C:\Users\juanf\fs\fsp_web\src\modules\orders\views\OrderConfirmationView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\orders\views\OrderConfirmationView.vue"
```

Change these lines:

```diff
-import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
+import { AppSpinner } from '@fsparts/ui'
```
```diff
-import { formatCurrency } from '@/shared/utils/currency'
+import { formatCurrency } from '@fsparts/core'
```
```diff
-import type { Order } from '@/shared/types'
+import type { Order } from '@fsparts/core'
```

(`import { fetchOrderBySessionId } from '../services/orders.service'` and `import { useCartStore } from '@/modules/cart/stores/cart.store'` are unchanged.)

- [ ] **Step 5: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/shop/src/modules/orders
git commit -m "feat(shop): port orders service and views"
```

---

### Task 9: Landing

**Files:**
- Create: `apps/shop/src/modules/landing/views/LandingView.vue` (from `src/modules/landing/views/LandingView.vue`)

**Interfaces:**
- Consumes: `useCatalogStore` (Task 3).
- Produces: the `/` (landing) view, wired into the router in Task 10.

- [ ] **Step 1: Port `LandingView.vue` (no import edits needed)**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\landing\views"
cp "C:\Users\juanf\fs\fsp_web\src\modules\landing\views\LandingView.vue" "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\modules\landing\views\LandingView.vue"
```

- [ ] **Step 2: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/modules/landing
git commit -m "feat(shop): port LandingView"
```

---

### Task 10: Wire the real router, retire the placeholder home view

**Files:**
- Modify: `apps/shop/src/router/index.ts`
- Delete: `apps/shop/src/views/HomeView.vue`

**Interfaces:**
- Consumes: every view ported in Tasks 4, 6, 7, 8, 9; `useAuthStore`, `useAuthModal` (Task 1).
- Produces: `apps/shop`'s router now serves the full shop route table instead of the Phase 1 placeholder.

- [ ] **Step 1: Replace the router**

Replace the full contents of `apps/shop/src/router/index.ts` with:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '../modules/auth/composables/useAuthModal'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                  name: 'landing',            component: () => import('../modules/landing/views/LandingView.vue') },
    { path: '/catalog',           name: 'catalog',             component: () => import('../modules/catalog/views/CatalogView.vue') },
    { path: '/product/:id',       name: 'product-detail',      component: () => import('../modules/catalog/views/ProductDetailView.vue') },
    { path: '/cart',              name: 'cart',                component: () => import('../modules/cart/views/CartView.vue') },
    { path: '/checkout',          name: 'checkout',            component: () => import('../modules/cart/views/CheckoutView.vue'), meta: { requiresUser: true } },
    { path: '/pedido-confirmado', name: 'order-confirmation',  component: () => import('../modules/orders/views/OrderConfirmationView.vue'), meta: { requiresUser: true } },
    { path: '/orders',            name: 'orders',              component: () => import('../modules/orders/views/OrdersView.vue'), meta: { requiresUser: true } },
    { path: '/orders/:id',        name: 'order-detail',        component: () => import('../modules/orders/views/OrderDetailView.vue'), meta: { requiresUser: true } },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.isReady) await authStore.init()

  if (to.meta.requiresUser) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
  }

  return true
})

export default router
```

This is `fsp_web`'s route table minus `/hvac-calculator` (Phase 3) and the `/admin/*` block and its `requiresAuth`/admin-redirect guard branch (Phase 4) — only the `requiresUser` branch is needed here.

- [ ] **Step 2: Remove the Phase 1 placeholder view**

```bash
rm "C:\Users\juanf\fs\fsparts-platform\apps\shop\src\views\HomeView.vue"
```

- [ ] **Step 3: Type-check the app**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/shop/src/router/index.ts
git rm apps/shop/src/views/HomeView.vue
git commit -m "feat(shop): wire full shop route table, retire placeholder HomeView"
```

---

### Task 11: Update the App.vue smoke test

**Files:**
- Modify: `apps/shop/src/App.test.ts`

**Interfaces:**
- Consumes: `App.vue` (Tasks 2/5), `LandingView.vue` (Task 9), the router (Task 10).

- [ ] **Step 1: Replace the smoke test**

The Phase 1 version of this test imports the now-deleted `HomeView.vue` and builds its own throwaway router. Replace the full contents of `apps/shop/src/App.test.ts` with:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('fsparts Shop')
  })
})
```

This now imports the app's real router (Task 10) instead of building a one-route throwaway, since `App.vue` no longer has a standalone placeholder view to mount against.

- [ ] **Step 2: Run the test**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/shop/src/App.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/shop/src/App.test.ts
git commit -m "test(shop): update App smoke test for the real router"
```

---

### Task 12: Full workspace verification

**Files:** none (verification only).

- [ ] **Step 1: Run the entire test suite from the root**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npm test`
Expected: PASS — every test from Phase 1 plus this phase's `useAuthModal.test.ts` (5 tests), `useProductPrice.test.ts` (check count when run), and `cart.store.test.ts` (6 tests) now running from `apps/shop` instead of not existing at all, plus the updated `App.test.ts`. 0 failures.

- [ ] **Step 2: Type-check and build**

Run:
```bash
npx vue-tsc --noEmit -p apps/shop/tsconfig.json
npm run build:shop
```
Expected: both exit 0.

- [ ] **Step 3: Manual verification on the real deployment (not automated)**

After this branch is pushed and Vercel redeploys `shop.fsparts.org`:
1. Visit `https://shop.fsparts.org`, confirm the landing page renders (replacing the old placeholder).
2. Click "Iniciar sesión", log in with a real account.
3. Confirm the header now shows the profile avatar/dropdown instead of the login button.
4. Open browser dev tools → Application → Cookies → confirm a cookie is set with `Domain=.fsparts.org`.
5. Visit `https://calculator.fsparts.org` (still a placeholder shell per Phase 1) and check whether `useAuthStore().isAuthenticated` reflects the same session — this is the SSO check that motivated this phase. If it doesn't, that's a bug to investigate (likely a `Secure`/`SameSite` cookie policy issue), not something this plan's automated tests can catch.
6. Add a product to cart, go through checkout to the Stripe-hosted page (no need to complete a real payment — confirm the redirect itself works).
7. Visit `/orders` while logged in, confirm it loads (empty state is fine if no completed orders exist).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify Phase 2 shop migration builds and tests pass end to end" --allow-empty
```

---

## Follow-Ups (not part of this plan)

- Phase 3: migrate the thermal load calculator (`fsp_web/src/modules/hvac`) into `apps/calculator`.
- Phase 4: migrate the admin panel (`fsp_web/src/modules/admin`) into `apps/dashboard`.
- Once `apps/shop` reaches parity and is verified stable in production, consider decommissioning `fsp_web`'s shop routes or the `fsp_web` deployment entirely (not decided — a separate conversation).
