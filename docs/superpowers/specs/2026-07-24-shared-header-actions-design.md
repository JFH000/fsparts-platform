# Shared Header Actions & Auth Shell — Design

**Date:** 2026-07-24
**Status:** Approved (pending spec review)

## Goal

Each app (`shop`, `calculator`, `dashboard`) needs to put app-specific content into the shared `AppHeader`'s `#actions` slot (menu, button, badge, text). Auditing today's header content surfaced two real gaps and one duplication problem to fix at the same time:

1. **Shop's cart is unreachable.** `cartStore.openDrawer()` is defined but never called from any button — the cart button that existed in `fsp_web`'s `TheNavbar` was never ported into the new `AppHeader`-based shell.
2. **Calculator's header is a dead placeholder.** The `#actions` slot shows static text `"Cuenta"` with no auth wiring, even though `useAuthStore().init()` already runs in `calculator/App.vue`.
3. **`ProfileDropdown` and the login form/modal are duplicated** between `shop` and `dashboard` (near-identical avatar circle, dropdown chrome, and login fields), and `calculator` has neither. The user wants the profile circle and the login portal shared by all apps, not re-implemented per app.

## Architecture

**Decision (confirmed with user):** keep `AppHeader`'s existing generic `#center`/`#actions` slots — no new structured props API. This design adds new *shared components* apps plug into those slots, rather than changing the slot mechanism itself.

**Scoping decision:** only the pieces common to all apps are shared. `RegisterForm`, `OnboardingForm`, and `EditProfileForm` are customer-account flows that only make sense in `shop` (registration, first-login onboarding, profile editing) — they stay in `shop` unchanged. What's shared is:

- The **login form** — but shop's existing `LoginForm.vue` has shop-specific business logic bolted on (redirects to `/admin/products` on admin login, switches to `onboarding` mode, has a "Regístrate" link). That's not a generic login form. Dashboard's existing `LoginForm.vue`, by contrast, is already the pure, minimal version (email/password + `signIn`, no extra branching) — **that one becomes the shared component**. Shop keeps its own richer `LoginForm.vue` untouched.
- The **modal shell** (`AuthModal.vue`'s overlay/backdrop/transition/scroll-lock chrome) and the **`useAuthModal` composable** (`mode`/`open`/`close`/`switchTo`) — pure UI chrome and state, no business logic. Shared as-is.
- The **profile dropdown shell** (avatar circle, name/email header, sign-out) — shared, with a named slot for app-specific extra menu items (shop's "Mis pedidos" / "Editar perfil").

## New shared components — `packages/ui/src/auth/`

| File | Purpose | Consumed by |
|---|---|---|
| `useAuthModal.ts` (+ `useAuthModal.test.ts`) | Singleton `mode` ref + `open`/`close`/`switchTo`. Identical to shop's current one, moved as-is. | shop (via its own `AuthModal`/`LoginForm`/`RegisterForm`/`OnboardingForm`/`EditProfileForm`/`ProfileDropdown`/router guard), calculator (directly) |
| `AuthModal.vue` | Teleported overlay: backdrop, close button, transition, body-scroll-lock. Renders `<slot :mode="mode" />` — the consumer decides what to show per mode. | shop (wrapped by its own thin `AuthModal.vue` that adds Register/Onboarding/EditProfile branches), calculator (directly, login-only) |
| `LoginForm.vue` | Pure email/password form: `signIn` + `fetchProfile`, loading/error state, calls the shared `useAuthModal().close()` on success (a no-op outside a modal). No register link, no onboarding/admin redirect. | calculator (inside `AuthModal`), dashboard (full-page, no modal) |
| `ProfileDropdown.vue` | Avatar circle with initials, dropdown header (name/email), `#extra-items` slot, "Cerrar sesión". | calculator (directly, no extra items), dashboard admin (directly, no extra items), shop (wrapped by its own thin `ProfileDropdown.vue` that fills `#extra-items` with "Mis pedidos"/"Editar perfil") |

Barrel: `packages/ui/src/index.ts` exports all four.

## Per-app changes

### Shop (`apps/shop/src`)
- `App.vue` `#actions` slot: add a cart icon button before the auth control — `ShoppingCart` icon, badge showing `cartStore.totalItems` (capped display `99+`) when > 0, `@click="cartStore.openDrawer()"`. Sized like `AppSwitcher`'s icon button (`h-9 w-9`) for visual consistency.
- `modules/auth/composables/useAuthModal.ts` + its test: **deleted** — every local import switches to `@fsparts/ui`.
- `modules/auth/components/LoginForm.vue`, `RegisterForm.vue`, `OnboardingForm.vue`, `EditProfileForm.vue`: **unchanged behavior**, only their `useAuthModal` import path changes to `@fsparts/ui`.
- `modules/auth/components/AuthModal.vue`: rewritten as a thin wrapper — renders the shared `AuthModal` from `@fsparts/ui`, and inside its default slot branches on `mode` to render shop's own `LoginForm`/`RegisterForm`/`OnboardingForm`/`EditProfileForm`. Drops its own overlay/backdrop/transition CSS (now owned by the shared component).
- `modules/auth/components/ProfileDropdown.vue`: rewritten as a thin wrapper — renders the shared `ProfileDropdown`, fills `#extra-items` with its existing "Mis pedidos" (`router.push('/orders')`) and "Editar perfil" (`open('editProfile')`) buttons.
- `router/index.ts`: only its `useAuthModal` import path changes to `@fsparts/ui`.
- `App.vue`'s own imports of local `AuthModal`/`ProfileDropdown` wrapper components are unchanged (still `./modules/auth/components/...`) — from `App.vue`'s point of view almost nothing changes except the new cart button markup.

### Calculator (`apps/calculator/src`)
- `App.vue` `#actions` slot: replace the static `"Cuenta"` text with — `authStore.isAuthenticated ? <ProfileDropdown /> : <button @click="openAuthModal('login')">Iniciar sesión</button>` (both imported directly from `@fsparts/ui`, no local wrapper needed since there are no extra items/modes).
- `App.vue`: add `<AuthModal><template #default="{ mode }"><LoginForm v-if="mode === 'login'" /></template></AuthModal>` as a sibling of `AppToast`, and `const { open: openAuthModal } = useAuthModal()` from `@fsparts/ui`.

### Dashboard — public/gate view (`apps/dashboard/src/App.vue`)
- No structural change beyond the import: its full-page `<LoginForm />` (shown when unauthenticated) now comes from `@fsparts/ui` instead of the local `modules/auth/components/LoginForm.vue`, which is **deleted**. UX stays full-page (not a modal) — this view's whole purpose is already the login gate.
- `#actions` slot stays empty, as previously agreed (a login/account control doesn't add anything on top of a screen that's already the login gate).

### Dashboard — admin (`apps/dashboard/src/modules/admin/layouts/AdminLayout.vue`)
- `modules/auth/components/ProfileDropdown.vue` is **deleted**; `AdminLayout.vue` imports `ProfileDropdown` from `@fsparts/ui` instead (no extra items — same behavior as today, avatar + sign out only).
- `#actions` slot: add an `AppBadge` (existing component, `variant="purple"`) reading "Admin" next to `ProfileDropdown`, to reinforce the privileged context.

## Non-goals (explicitly out of scope)
- Moving `RegisterForm`/`OnboardingForm`/`EditProfileForm` into `@fsparts/ui` — customer-account flows, `shop`-only.
- Redesigning `AdminLayout`'s floating sidebar navigation or moving it into `AppHeader`'s `#center` slot.
- A search bar in `shop`'s `#center` slot (raised as a stretch idea earlier, deferred).
- Cross-app synchronization of `useAuthModal`'s `mode` state — each app bundles its own independent instance of the composable, exactly like today.

## Testing
- New: `packages/ui/src/auth/useAuthModal.test.ts` (moved from shop, import path updated) — same 1:1 behavior assertions.
- New: a mount-level test for the shared `ProfileDropdown.vue` (renders avatar, opens dropdown, calls `signOut`) and for `AuthModal.vue` (renders slot content only when `mode` is set, calls `close` on backdrop click) — following the existing `AppHeader.test.ts` pattern (jsdom, Pinia active).
- Updated: `apps/shop/src/App.test.ts`, `apps/dashboard/src/App.test.ts` continue to pass unchanged in behavior (same rendered text/components), just sourced from different import paths.
- New assertion in `apps/shop/src/App.test.ts` (or a dedicated test): cart button renders and calls `cartStore.openDrawer()` on click.
- Full suite (`npx vitest run`) and production builds of all three apps must stay green, per the existing project convention.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Breaking shop's existing register/onboarding/admin-redirect flow while rewiring `useAuthModal` imports | Medium | Behavior of those components is untouched — only the import path changes. Shop's existing tests (and a manual smoke pass) catch regressions. |
| Two independent `useAuthModal` singletons (shop's deleted local one vs. the shared one) briefly coexisting mid-refactor and desyncing `mode` | Medium if done partially | Do the shop import-path swap as one atomic change across all 8 call sites (`router/index.ts`, `App.vue`, `AuthModal.vue`, `LoginForm.vue`, `RegisterForm.vue`, `OnboardingForm.vue`, `EditProfileForm.vue`, `ProfileDropdown.vue`) before deleting the local file. |
| Calculator's shared `LoginForm` calling `useAuthModal().close()` on success has no visible effect if calculator doesn't wire `AuthModal` correctly | Low | Covered by the `AuthModal`+`LoginForm` integration in calculator's `App.vue`; smoke-test login flow. |
