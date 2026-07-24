# Phase 4: Migrate the Admin Panel to `apps/dashboard`

**Status:** Approved design, pending spec review by user.

## Context

Phase 2 (shop) and Phase 3 (calculator) are executed and merged; both `apps/shop` and `apps/calculator` are at functional parity with their `fsp_web` counterparts. `apps/dashboard` is still Phase 1's placeholder: a static "Plantilla base funcionando" home view, with `App.vue` already calling `authStore.init()` on mount but nothing gating access.

`fsp_web`'s admin panel (`src/modules/admin/*`: `AdminLayout.vue`, `AdminProductsView.vue`, `AdminProductFormView.vue`, `AdminCatalogView.vue`, `AdminCustomersView.vue`, `AdminSalesView.vue`, plus `admin.service.ts`, `customers.service.ts`, `sales.service.ts`) lives behind a router-level guard: `/admin` has `meta: { requiresAuth: true }`, and a global `beforeEach` opens a login modal for unauthenticated visitors or redirects authenticated non-admins to `landing`. That pattern assumes the admin section is a few routes inside one larger, always-public SPA — which is no longer true once it's its own subdomain.

**Goal:** Migrate the admin panel into `apps/dashboard`, replacing the old per-route guard with an app-wide auth gate (since 100% of this app's routes are admin-only), including a login UI local to `apps/dashboard` — the cross-subdomain SSO cookie that lets a shop login carry over is a no-op on `localhost` (each dev port is a separate storage origin), so without its own login this app would be untestable in local dev.

**Explicitly out of scope for this phase:**
- Profile editing — `fsp_web`'s `EditProfileForm`/"Editar perfil" is not ported; `apps/dashboard`'s `ProfileDropdown` exposes only "Cerrar sesión".
- Self-registration inside `apps/dashboard` — admins are provisioned by setting `user_profiles.role = 'admin'` directly (existing out-of-band process), not through a signup flow in this app. No `RegisterForm`/`OnboardingForm`/`AuthModal` are ported.
- Any Supabase schema, RLS policy, or Edge Function change.
- Any change to `apps/shop`'s or `apps/calculator`'s auth UI or routing.

## Architecture

`fsp_web/src/modules/admin/*` ports to `apps/dashboard/src/modules/admin/*`, preserving structure (`layouts/AdminLayout.vue`, `views/Admin{Products,ProductForm,Catalog,Customers,Sales}View.vue`, `services/{admin,customers,sales}.service.ts`). Import swaps applied during the port:

| `fsp_web` import | `apps/dashboard` replacement |
|---|---|
| `@/core/supabase/client` (`supabase`) | `@fsparts/core` (`supabase`) |
| `@/shared/types` (`UserRole`, `Order`, `OrderStatus`) | `@fsparts/core` |
| `@/shared/components/ui/AppSpinner.vue` | `@fsparts/ui` (`AppSpinner`) |
| `@/shared/components/ui/OrderStatusBadge.vue` | `@fsparts/ui` (`OrderStatusBadge`) |
| `@/shared/composables/useToast` | `@fsparts/ui` (`useToast`) |
| `@/shared/utils/currency` (`formatCurrency`) | `@fsparts/core` (`formatCurrency`) |
| `@/modules/auth/components/ProfileDropdown.vue` | local `apps/dashboard/src/modules/auth/components/ProfileDropdown.vue` (new, trimmed — see Auth Module) |

`admin.service.ts`, `customers.service.ts`, and `sales.service.ts` stay local to `apps/dashboard` — unlike Phase 3's catalog-fetch relocation (needed because *two* apps read the same product data), these are admin-only mutations with no other consumer, so there's no shared-package case for them.

`apps/dashboard/package.json` gains `@lucide/vue` (not yet a dependency — needed by `AdminLayout`'s sidebar icons and the icon usage throughout the five admin views). No `@vueuse/core` dependency is needed: the admin module's only outside-click handling (`ProfileDropdown`) is ported using the same manual `document.addEventListener` pattern shop's `ProfileDropdown` already uses, not `onClickOutside`.

**Targeted improvement while porting:** `AdminProductFormView.vue` currently reads `catalogStore.productLines` / `.brands` / `.categories` from `apps/shop`'s Pinia catalog store (a full store with search/filter/pagination state the form doesn't need). `apps/dashboard` has no reason to depend on shop's store, and Phase 3 already relocated `fetchProductLines` / `fetchBrands` / `fetchCategories` into `@fsparts/core`'s `catalog.ts`. The ported form calls those three functions directly on mount into local `ref`s instead.

## Auth Module (new, local to `apps/dashboard`)

`apps/dashboard/src/modules/auth/`:
- **`components/LoginForm.vue`** — email/password fields, calls `useAuthStore().signIn(email, password)` from `@fsparts/core`. Ported and trimmed from `apps/shop`'s `LoginForm.vue` (drops the "¿No tienes cuenta?" register affordance — there is no register flow here).
- **`components/ProfileDropdown.vue`** — avatar with initials (same visual pattern as shop's), dropdown with a single "Cerrar sesión" action calling `authStore.signOut()`. No "Mis pedidos" (no order-taking role in this app) and no "Editar perfil" (out of scope this phase).

No `AuthModal` and no `useAuthModal` composable — the login form is not a dismissible overlay triggered by a route guard; it's one of four states the app-wide gate renders directly in place of the admin UI (see Routing & Gating).

## Routing & Gating

`apps/dashboard/src/router/index.ts` replaces its single placeholder route. Paths drop the `/admin` prefix `fsp_web` used, since this whole app is the admin app now (same pattern as Phase 3 dropping `/hvac-calculator` down to `/`):

```
/                    → redirect → /products
/products            → admin-products     (AdminProductsView)
/products/new        → admin-product-new  (AdminProductFormView)
/products/:id/edit   → admin-product-edit (AdminProductFormView)
/catalog              → admin-catalog      (AdminCatalogView)
/customers            → admin-customers    (AdminCustomersView)
/sales                → admin-sales        (AdminSalesView)
```

No route `meta` and no `router.beforeEach` guard — every route in this app requires the same admin access, so gating moves out of the router entirely and into `App.vue`, which renders exactly one of four states based on `useAuthStore()`:

1. **Not ready** (`!authStore.isReady`) → `AppSpinner`, centered, full height.
2. **Not authenticated** (`isReady && !isAuthenticated`) → `LoginForm`, centered, no `AdminLayout` chrome.
3. **Authenticated, not admin** (`isAuthenticated && !isAdmin`) → a quiet "Acceso restringido" message (this section is for administradores de FSP Parts) with a "Cerrar sesión" action, no `AdminLayout` chrome.
4. **Admin** (`isAdmin`) → `AdminLayout` wrapping `RouterView`, exactly as today.

This sidesteps the `fsp_web` router guard's initial-navigation quirk (returning `false` on first load cancels navigation without mounting anything) — the gate always renders *something* for every state.

`AdminLayout.vue`'s "Ver tienda" link changes from an in-SPA `RouterLink` to `/` into a plain cross-origin `<a :href>` pointing at `` `${shopUrl}` `` where `shopUrl` is `import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org'` — the same pattern Phase 3 used for the calculator's "Ver producto" links into shop.

## Error Handling

Unchanged from `fsp_web`: every service function's `getSb()` throws `'Supabase no configurado'` when the client is null, and CRUD calls surface Supabase errors via `throw new Error(error.message)`, caught and surfaced as toasts at the view layer — ported as-is, no behavior change.

One case `fsp_web` didn't have to handle: an unconfigured Supabase project (`isSupabaseConfigured === false`) still resolves `authStore.isReady` to `true` with no user (existing `auth.store.ts` behavior, ported unchanged in Phase 1) — the gate correctly falls through to the login-form state rather than hanging on the spinner.

## Testing

Same convention established in Phases 1–3: unit tests for services and composables (Supabase mocked), no unit tests for presentational `.vue` views (`AdminLayout`, the five admin views, `LoginForm`, `ProfileDropdown` are not tested individually).

- **New:** `App.test.ts` — mounts `App.vue` with a mocked `useAuthStore` and asserts each of the four gate states renders the right thing: spinner while `!isReady`, `LoginForm` when unauthenticated, the "Acceso restringido" message for an authenticated non-admin, and `AdminLayout` content for an admin.
- `admin.service.ts`, `customers.service.ts`, `sales.service.ts` port unchanged — `fsp_web` has no existing unit tests for these to carry over (confirmed: none exist in `fsp_web/src/modules/admin`), and this phase does not add new ones, matching the file's existing convention of business logic there being thin passthroughs to Supabase rather than logic worth isolating in tests. (Contrast with Phase 3's `capacity-parser`/`useEquipmentSuggestions`, which had real branching logic worth testing.)

**Final verification:** `npm test` (full monorepo suite), `vue-tsc --noEmit -p apps/dashboard/tsconfig.json`, `npm run build:dashboard`.

## Open Follow-Ups (future work, not this phase)

- Cutting over `fsp_web`'s production traffic to the three new apps and retiring the monolith (the last item from the original platform-foundation design's follow-up list).
- Profile editing and admin self-registration/invite flows, if ever needed.
