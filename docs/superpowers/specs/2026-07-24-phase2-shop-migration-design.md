# Phase 2: Migrate the Shop Vertical to `apps/shop`

**Status:** Approved design, pending spec review by user.

## Context

Phase 1 (`docs/superpowers/plans/2026-07-23-platform-foundation.md`, executed and merged) stood up the `fsparts-platform` monorepo: `@fsparts/core` (shared Supabase client with cross-subdomain cookie session storage, auth store, types), `@fsparts/ui` (design tokens, component kit, shared brand shell), and three placeholder app shells (`apps/shop`, `apps/calculator`, `apps/dashboard`), all now deployed to `shop.fsparts.org`, `calculator.fsparts.org`, `dashboard.fsparts.org` on Vercel, pointed at the same Supabase project `fsp_web` already uses.

`apps/shop` currently has no real functionality — just a placeholder home view and a static "Cuenta" label in the header. This blocks the one thing Phase 1 couldn't verify locally: real cross-subdomain SSO (logging in on `shop.fsparts.org` and having the session persist on `calculator.fsparts.org`), because there is no login UI anywhere in `fsparts-platform` yet.

**Goal:** Migrate the entire shop vertical — landing, catalog, cart, checkout, orders, and auth — from `fsp_web` into `apps/shop`, so `apps/shop` reaches functional parity with `fsp_web`'s shop experience and real auth becomes testable end-to-end.

**Explicitly out of scope for this phase:**
- `/hvac-calculator` (→ Phase 3, migrates into `apps/calculator`)
- `/admin/*` (→ Phase 4, migrates into `apps/dashboard`)
- Any backend/Supabase schema or Edge Function changes — Phase 2 confirmed the Vercel deployments already point at the same Supabase project `fsp_web` uses (same tables, same data, same `create-checkout-session` Edge Function), so this is a pure frontend port.
- Creating or reorganizing the `fsp_web` repo itself, or decommissioning it.

## Architecture

`src/modules/{landing,catalog,cart,orders,auth}` from `fsp_web` are ported to `apps/shop/src/modules/*`, preserving each module's internal structure (`components/`, `composables/`, `stores/`, `services/`, `views/`). Only import paths change:

| `fsp_web` import | `apps/shop` import |
|---|---|
| `@/shared/types` | `@fsparts/core` |
| `@/core/supabase/client` | `@fsparts/core` |
| `@/shared/utils/currency` | `@fsparts/core` |
| `@/modules/auth/stores/auth.store` | `@fsparts/core` (`useAuthStore`) |
| `@/shared/components/ui/{AppButton,AppBadge,AppSpinner,OrderStatusBadge}` | `@fsparts/ui` |
| `@/shared/composables/useToast` | `@fsparts/ui` |

`apps/shop` does **not** get its own local auth store — `useAuthStore` already lives in `@fsparts/core` (Phase 1) and is reused as-is; the `fsp_web` copy is not duplicated.

Shop-specific Supabase services (`catalog.service.ts`, `checkout.service.ts`, `addresses.service.ts`, `orders.service.ts`) port to `apps/shop/src/modules/{catalog,cart,orders}/services/` unchanged in behavior — these are shop-only business queries (products, orders, checkout) and do not belong in `@fsparts/core`, which stays generic across all three apps.

`fsp_web`'s `TheNavbar.vue`/`TheFooter.vue` (`src/modules/shop/components/`) are **not** ported — they're already superseded by `@fsparts/ui`'s `AppHeader`/`AppFooter` (Phase 1).

## Routing

`apps/shop/src/router/index.ts` replaces its single placeholder route with:

```
/                    → landing              (LandingView)
/catalog              → catalog              (CatalogView)
/product/:id          → product-detail       (ProductDetailView)
/cart                  → cart                 (CartView)
/checkout              → checkout             (CheckoutView)             [requiresUser]
/pedido-confirmado     → order-confirmation   (OrderConfirmationView)     [requiresUser]
/orders                → orders               (OrdersView)                [requiresUser]
/orders/:id            → order-detail         (OrderDetailView)           [requiresUser]
```

No `ShopLayout` wrapper is needed — `AppHeader`/`AppFooter`/`AppToast` already live in `apps/shop/src/App.vue` (Phase 1).

The `router.beforeEach` guard ports as-is: awaits `authStore.init()` if not ready; for `meta.requiresUser` routes, if unauthenticated it opens `AuthModal` in login mode via `useAuthModal()` and blocks navigation (`return false`). Since `authStore` now comes from the shared `@fsparts/core`, this works identically to `fsp_web`.

## Auth Integration in the Shared Header

`apps/shop/src/App.vue`'s static `<span>Cuenta</span>` (in `AppHeader`'s `#actions` slot) is replaced with real, `authStore.isAuthenticated`-driven UI:

- **Unauthenticated:** a "Iniciar sesión" button calling `useAuthModal().open('login')`.
- **Authenticated:** `ProfileDropdown.vue` (ported as-is from `fsp_web`) — shows user initials, and a menu with "Mis pedidos" / "Editar perfil" / "Cerrar sesión".

`AuthModal.vue` (with its four sub-forms — `LoginForm`, `RegisterForm`, `OnboardingForm`, `EditProfileForm`) and `useAuthModal.ts` port as-is into `apps/shop/src/modules/auth/`. `AuthModal` mounts once at the root of `App.vue`, alongside `AppToast`, matching `fsp_web/src/App.vue`'s pattern.

This is the piece that actually unblocks the SSO verification that motivated this phase: logging in on `shop.fsparts.org` writes the session cookie scoped to `.fsparts.org` (the mechanism Phase 1 already built), so `calculator.fsparts.org`/`dashboard.fsparts.org` should observe the same session on reload.

## Catalog, Cart, Checkout, and Orders

Ported verbatim, per the import-path table above:

- **Catalog:** `catalog.store.ts` (filtering, sorting, tiered pricing), `useProductPrice.ts` (resolves effective price by user `role` — WS1/WS2/WS3/regular), `CatalogView`, `ProductDetailView`, `FilterSidebar`, `FilterSection`, `ProductCard`, `catalog.service.ts` (real Supabase fetch: products, product lines, brands, categories). `data/mock.ts` ports unchanged — it remains the initial/fallback state while the real Supabase fetch resolves, exactly as in `fsp_web` today.
- **Cart:** `cart.store.ts` ports unchanged, including its `localStorage` persistence (`useLocalStorage('fsp-cart', ...)`) — this is per-app, not cross-subdomain; only the auth session travels across `*.fsparts.org`, not the cart. `CartDrawer`, `CartView`.
- **Checkout:** `CheckoutView`, `checkout.service.ts` (invokes the already-deployed `create-checkout-session` Edge Function, redirects to Stripe-hosted checkout), `addresses.service.ts`. No backend changes required.
- **Orders:** `OrdersView`, `OrderDetailView`, `OrderConfirmationView`, `orders.service.ts` (fetch by `stripe_checkout_session_id` for confirmation, by user for the list/detail views).

## Error Handling

Inherited as-is from `fsp_web` — no new design, just preserved through the port:

- Services already throw descriptive errors (`"Supabase no configurado"`, `"No autenticado"`, Postgres/Supabase error messages) — unchanged.
- Views catch these and surface them via `useToast()`, now imported from `@fsparts/ui` instead of the local `@/shared/composables/useToast`.
- The `requiresUser` route guard already prevents reaching `/checkout` or `/orders*` without a session (opens `AuthModal` instead) — no view needs to handle that case itself.
- Out of scope (per Phase 1's spec): verifying that the session cookie actually survives real-world third-party/first-party cookie policies across subdomains is a manual post-deploy check, not an automated test.

## Testing

Follows the `fsp_web`/Phase 1 convention: only business logic (stores/composables) is unit-tested; presentational `.vue` components are not mounted in tests. Three existing test files port with updated imports:

- `cart.store.test.ts` — tiered pricing (WS1/WS2/WS3/regular)
- `useAuthModal.test.ts` — modal state machine
- `useProductPrice.test.ts` — effective-price resolution

The Supabase-backed services (`checkout.service`, `orders.service`, `catalog.service`, `addresses.service`) get **no** new tests — they're thin guard-clause wrappers over Supabase calls, the same judgment already applied in Phase 1 to `auth.store.ts`'s `signIn`/`signUp`/`fetchProfile` (untested there for the same reason: testing them would mostly test the mock, not real logic).

`apps/shop/src/App.test.ts` (Phase 1's smoke test) is updated: since the placeholder `HomeView.vue` is removed (`/` now serves `LandingView`), the test mounts `App.vue` with the real router pointed at `/`, still asserting "fsparts Shop" appears in the shared header.

**Final verification:** `npm test` (full monorepo suite), `npm run build:shop`, and a manual check on the real deployment — log in on `shop.fsparts.org`, confirm the session cookie is scoped to `.fsparts.org`, confirm the session is visible on `calculator.fsparts.org`.
