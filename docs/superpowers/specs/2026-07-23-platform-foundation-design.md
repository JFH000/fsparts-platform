# Platform Foundation — Shared Template for Shop/Calculator/Dashboard Split — Design

## Context

`fsp_web` currently serves the FSP Parts shop, the thermal load calculator (`hvac` module), and the admin panel (`admin` module) as one Vite + Vue 3 SPA on a single Vercel deployment. `shop.fsparts.org` already exists as the staging domain for this monolith (see `src/main.ts`'s noindex check).

The business goal is to split this into three independently deployed apps on three subdomains — `shop.fsparts.org`, `calculator.fsparts.org`, `dashboard.fsparts.org` — all built with Vue and reading from the same Supabase backend, while visibly remaining "the same business" to a user who moves between them.

The codebase is already well-suited to this split: `src/modules/{landing,catalog,cart,orders,auth}` map to Shop, `src/modules/hvac` maps to Calculator, `src/modules/admin` maps to Dashboard, and `src/shared` / `src/core` are the seed of what becomes shared infrastructure. The visual design system itself does not need to be invented — `DESIGN.md` and `PRODUCT.md` already fully specify the palette, typography, and component rules.

This design covers **only the first phase**: a new monorepo containing the shared foundation (design tokens, UI kit, cross-app "brand shell", and shared Supabase/auth infrastructure) plus minimal placeholder shells for the three apps, proving the foundation works end-to-end before any real feature code is migrated.

## Goals

- A new monorepo, `fsparts-platform`, using npm workspaces, containing `packages/ui`, `packages/core`, and `apps/{shop,calculator,dashboard}`.
- `packages/ui` carries the FSP Parts visual identity (tokens ported from `DESIGN.md`) and a shared "brand shell" (`AppHeader`, `AppSwitcher`, `AppFooter`) plus the existing presentational UI kit (`AppButton`, `AppBadge`, `AppSpinner`, `AppToast`, `OrderStatusBadge`).
- `packages/core` carries a shared Supabase client and auth store, configured so a login on one subdomain is recognized on the other two (cross-subdomain SSO via cookie-backed session storage).
- `AppSwitcher` lets a user jump between the three apps, and shows "Dashboard" only to authenticated admins.
- Each `apps/*` is a minimal, independently deployable Vite+Vue shell that proves the above works live on its subdomain.
- Each `apps/*` is deployable to its own Vercel project (`Root Directory` per app) without depending on the others' build.

## Non-Goals (explicitly out of scope for this iteration)

- Migrating real feature code — catalog, cart, checkout, orders, landing (→ Shop), thermal load calculator logic (→ Calculator), admin CRUD views (→ Dashboard). Each is a separate design + plan, done after this foundation exists.
- Retiring or modifying the existing `fsp_web` repo/deployment. It keeps running unchanged until a later phase cuts it over.
- Creating the actual Vercel projects and attaching the `*.fsparts.org` domains — that's a manual dashboard step for the user; this design only produces code that's ready to be deployed that way.
- Any change to the Supabase schema, RLS policies, or Edge Functions.
- Turborepo or any build-caching layer — npm workspaces alone is sufficient at this scale (3 apps, 2 packages); can be added later without restructuring if build times become a problem.

## A. Repository Layout

```
fsparts-platform/
├── package.json                 # "workspaces": ["apps/*", "packages/*"]
├── packages/
│   ├── ui/                      # @fsparts/ui
│   │   └── src/
│   │       ├── tokens.css       # DESIGN.md palette/type scale as Tailwind v4 @theme
│   │       ├── components/      # AppButton, AppBadge, AppSpinner, AppToast, OrderStatusBadge
│   │       └── shell/
│   │           ├── AppHeader.vue
│   │           ├── AppSwitcher.vue
│   │           ├── AppFooter.vue
│   │           └── apps.config.ts   # single source of truth for the 3-app list
│   └── core/                    # @fsparts/core
│       └── src/
│           ├── supabase.ts      # createSupabaseClient() factory, cookie storage adapter
│           ├── auth.store.ts    # useAuthStore (Pinia) — ported from fsp_web
│           ├── types.ts
│           └── currency.ts
└── apps/
    ├── shop/                    # → shop.fsparts.org
    ├── calculator/               # → calculator.fsparts.org
    └── dashboard/                # → dashboard.fsparts.org
```

Each `apps/*` is a standalone Vite+Vue+Router+Pinia project that depends on `@fsparts/ui` and `@fsparts/core` as workspace packages. There is no separate build step for the packages — Vite compiles their source directly as part of each app's build, same as any other local module. This keeps the dev loop simple: editing a component in `packages/ui` is reflected instantly in all three apps.

**Local development:** each app runs on its own Vite dev server port (e.g. shop `5173`, calculator `5174`, dashboard `5175`) so all three can run concurrently.

## B. Design Tokens & UI Kit (`packages/ui`)

`tokens.css` ports the existing palette (Blueprint Indigo `#1d4ed8`, Thermal Orange `#f97316`, Datasheet Black `#0f172a`, etc.), type scale, radii, and spacing from `DESIGN.md` into Tailwind v4's `@theme` block. Each app imports this one file in its CSS entrypoint — the three apps share the literal same token values, not independently maintained copies.

The presentational components (`AppButton`, `AppBadge`, `AppSpinner`, `AppToast`, `OrderStatusBadge`) are ported from `src/shared/components/ui` with no logic changes. They have no dependency on `@fsparts/core` or Supabase.

**Tailwind v4 content scanning:** since shared components live outside each app's own `src/`, each app's CSS entrypoint must add `packages/ui/src` as an additional `@source`, or classes used only inside shared components won't be generated in that app's build.

## C. Brand Shell (`packages/ui/src/shell`)

- **`AppHeader`** — logo + a dynamic brand name (`appName` prop: `"Shop"`, `"Calculadora"`, `"Dashboard"`, rendered as "fsparts Shop" etc.), a center slot (used by Shop for its search bar, left empty elsewhere), a right-side actions slot (cart icon in Shop, account button everywhere), and the `AppSwitcher` trigger.
- **`AppSwitcher`** — a grid-icon button that opens a panel listing the apps from `apps.config.ts` (name, short description, URL), highlighting the currently active app. Reads `useAuthStore().isAdmin` from `@fsparts/core` to decide whether to include the Dashboard entry — non-admins and signed-out users see only Shop and Calculator.
- **`AppFooter`** — shared footer (business name, contact/legal info), identical across all three apps.

`apps.config.ts` is the single list of `{ id, name, description, url, requiresAdmin }` entries the switcher renders — it exists once, so adding/renaming an app never requires touching three separate copies. Each app's URL is read from an env var (`VITE_APP_URL_SHOP`, `VITE_APP_URL_CALCULATOR`, `VITE_APP_URL_DASHBOARD`) defaulting to the production subdomain, so the switcher can point at `localhost:517x` URLs in local dev instead.

```
[⣿ Apps]  fsparts Shop            [search.......]      [🛒][account]
   └─ click opens:
        ▢ fsparts Shop          (active)
        ▢ fsparts Calculadora
        ▢ fsparts Dashboard     (admin only)
```

## D. Shared Core (`packages/core`)

**`createSupabaseClient()`** (`supabase.ts`) wraps `@supabase/supabase-js`'s `createClient`, overriding `auth.storage` with a cookie-backed adapter:

- On `*.fsparts.org` (checked via `window.location.hostname.endsWith('.fsparts.org')` or equal to `fsparts.org`): session tokens are stored in a cookie with `Domain=.fsparts.org; Secure; SameSite=Lax; Path=/`, readable by all three subdomains — this is what makes cross-subdomain SSO work.
- On any other hostname (local dev, preview deployments not on the apex domain): falls back to plain `localStorage`, since a `.fsparts.org`-scoped cookie is meaningless there and would silently break local auth.

This factory is the single place this logic lives — no app configures Supabase storage itself, so it can't be misconfigured in just one of the three.

**`useAuthStore`** (Pinia) is ported from `fsp_web`'s `src/modules/auth/stores/auth.store.ts` with no behavior change: `user`/`profile`/`isAdmin` (`profile.role === 'admin'`, resolved from the `user_profiles` table), `isAuthenticated`, `signIn`/`signUp`/`signOut`. It lives in `@fsparts/core` instead of being duplicated per app, and is what `AppSwitcher` reads to decide Dashboard visibility.

**Error handling:** if Supabase env vars are missing or session resolution fails, `isReady`/`isAdmin` resolve to `false` (matching today's behavior) — `AppSwitcher` simply omits Dashboard and the rest of the app continues in guest mode rather than crashing.

**`types.ts`** and **`currency.ts`** are ported unchanged.

## E. Deployment

Three Vercel projects on the same GitHub repo:

| Project | Root Directory | Domain |
|---|---|---|
| shop | `apps/shop` | `shop.fsparts.org` |
| calculator | `apps/calculator` | `calculator.fsparts.org` |
| dashboard | `apps/dashboard` | `dashboard.fsparts.org` |

Each project has its own `vercel.json` (SPA rewrite, same pattern as today's `fsp_web/vercel.json`) and its own Supabase env vars (same project/keys across all three). Creating the Vercel projects and attaching domains is a manual step in the Vercel dashboard — this design produces code ready to be connected that way, but does not create the projects itself.

## F. Testing

- `packages/core`: unit tests (Vitest) for the storage adapter's hostname-based branching (cookie vs. localStorage) and for `isAdmin` resolution.
- `packages/ui`: unit test for `AppSwitcher` — shows/hides the Dashboard entry based on mocked auth state.
- `apps/*`: a smoke test per app confirming it mounts with the shared header/footer without errors.
- Manual, post-deploy: log in on `shop.fsparts.org`, navigate to `calculator.fsparts.org`, confirm the session persists. Cross-subdomain cookie behavior can't be faithfully simulated in jsdom, so this step stays manual.

## Open Follow-Ups (future specs, not this one)

- Phase 2: migrate Shop (landing, catalog, cart, checkout, orders, auth UI) into `apps/shop`.
- Phase 3: migrate the thermal load calculator into `apps/calculator`.
- Phase 4: migrate the admin panel into `apps/dashboard`.
- Cutting over `fsp_web`'s production traffic once the three new apps are live, and retiring the monolith.
