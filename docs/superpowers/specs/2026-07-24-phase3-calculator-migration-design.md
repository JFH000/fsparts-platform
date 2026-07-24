# Phase 3: Migrate the HVAC Calculator to `apps/calculator`

**Status:** Approved design, pending spec review by user.

## Context

Phase 2 (`docs/superpowers/specs/2026-07-24-phase2-shop-migration-design.md`, executed and merged) brought `apps/shop` to functional parity with `fsp_web`'s shop experience, including real auth, and unblocked cross-subdomain SSO. Two bugs were found and fixed after that phase's own final review: `App.vue` never called `catalogStore.initialize()` (so the catalog silently served mock data instead of the real Supabase-backed products), and the landing page's calculator CTA pointed at a non-existent internal route instead of the `calculator.fsparts.org` subdomain.

`apps/calculator` is still Phase 1's placeholder: a static "Plantilla base funcionando" home view and a header with a static "Cuenta" label (no auth wiring — this app doesn't need any, see below).

**Goal:** Migrate `fsp_web`'s HVAC load-calculation wizard (`src/modules/hvac`) into `apps/calculator`, and — going beyond a pure port — implement the "Sugerencia de equipos" (equipment suggestion) panel that exists in `fsp_web` only as a "Próximamente" placeholder, wiring it to real catalog data from the shared Supabase backend.

**Explicitly out of scope for this phase:**
- `/admin/*` (→ Phase 4, migrates into `apps/dashboard`)
- Any Supabase schema change. The `products.specs` JSONB column already carries capacity data as free-form `{ key: 'Capacidad', value, unit }` entries (confirmed against `fsp_web/docs/backend/database.md` and the live seed data) — this phase reads that as-is, it does not restructure it.
- Adding capacity data to products that don't already have a `Capacidad` spec entered — that's a catalog data-entry / admin-tooling concern (Phase 4).
- Auth or cart integration in `apps/calculator` — the calculator is a standalone tool (`fsp_web`'s `hvac` module has zero dependency on auth, cart, or catalog beyond this new suggestion feature), and stays that way.

## Architecture

`fsp_web/src/modules/hvac/*` (15 files: `ModeSelector.vue`, `WizardProgress.vue`, `ac/{AcStep1Dimensions,AcStep2Conditions,AcStep3InternalLoads,AcResults}.vue`, `cold/{ColdStep1Type,ColdStep2Dimensions,ColdStep3Product,ColdStep4InternalLoads,ColdResults}.vue`, `views/HvacCalculatorView.vue`, `utils/{ac-calculator,cold-calculator}.ts` + their tests) ports to `apps/calculator/src/modules/hvac/*`, preserving structure. This module has no `@/shared`, `@/core`, or `@/modules/{auth,catalog,cart}` imports in `fsp_web` — only `vue` and `@lucide/vue` — so the port needs **no import-mapping table**, unlike Phase 2. `apps/calculator/package.json` gains `@lucide/vue` (not yet a dependency). No `@` alias is needed.

**Catalog-fetch relocation:** `apps/shop/src/modules/catalog/services/catalog.service.ts` (added in Phase 2) moves to `packages/core/src/catalog.ts`, re-exported from `@fsparts/core`'s `index.ts`. This is the only way `apps/calculator` can query the same `products`/`brands`/`categories`/`product_lines` tables without duplicating the `DbProduct` type and `toProduct` mapper. `apps/shop/src/modules/catalog/stores/catalog.store.ts` updates its import from `../services/catalog.service` to `@fsparts/core`; the now-empty `apps/shop/src/modules/catalog/services/` directory is removed. No behavioral change to `apps/shop` — this is a pure relocation, verified by the existing test suite continuing to pass unchanged.

Two new files, local to `apps/calculator` (this logic has no reason to live in `@fsparts/core` — it's specific to interpreting HVAC capacity, not general catalog data):

- `apps/calculator/src/modules/hvac/utils/capacity-parser.ts` — pure function `parseCapacityToTons(specs: ProductSpec[]): number | null`.
- `apps/calculator/src/modules/hvac/composables/useEquipmentSuggestions.ts` — fetches, filters, ranks.
- `apps/calculator/src/modules/hvac/components/EquipmentSuggestions.vue` — presentational.

## Routing

`apps/calculator/src/router/index.ts` replaces its single placeholder route:

```
/  → hvac-calculator  (HvacCalculatorView)
```

`apps/calculator/src/views/HomeView.vue` is deleted (placeholder retired, same pattern as Phase 2's Task 10 retiring `apps/shop`'s `HomeView.vue`). `apps/calculator/src/App.vue` is unchanged — it already wraps `RouterView` in `AppHeader`/`AppFooter`/`AppToast` and calls `authStore.init()` (Phase 1), which stays only so the shared header can reflect an existing cross-subdomain session; the calculator itself never reads `authStore` beyond that.

## Equipment Suggestion Feature

This is new functionality — `fsp_web` never built past the "Próximamente" placeholder in `AcResults.vue`/`ColdResults.vue`.

**`parseCapacityToTons(specs)`:**
1. Find the spec entry where `key.toLowerCase() === 'capacidad'` (exact match only — this deliberately excludes other capacity-shaped specs like `'Capacidad de secado'` on filter products, which are not cooling capacity).
2. If none found, return `null`.
3. Parse `value` as either a single number (`"5"`) or a range (`"2–5"`, en-dash separated) — strip thousands separators (`"30,000"` → `30000`) either way. A range resolves to its midpoint.
4. Convert to tons of refrigeration (TR) based on `unit`: `'TR'` passes through; `'BTU/h'` divides by `12000` (the standard engineering conversion). Any other/missing unit → `null` (unparseable, not guessed at).

**`useEquipmentSuggestions(targetTons: Ref<number>)`:**
1. Calls `fetchProducts()` (from `@fsparts/core`) once and filters client-side to `p.productLine.code === 'L06'` (Compresores) — at the catalog's current size (~170 products) a full fetch-then-filter is simpler and cheap enough to not warrant a new server-side query.
2. Maps each candidate through `parseCapacityToTons`, dropping `null`s.
3. Applies a sanity bound: keeps only candidates where `0.5 * targetTons <= candidateTons <= 2 * targetTons` — this prevents suggesting, e.g., a 30 TR industrial compressor for a 0.3 TR room just because it's the "closest" match in a sparse catalog. Matches the project's existing design principle (`fsp_web/CLAUDE.md`: "Earn trust through precision").
4. Sorts the survivors by `Math.abs(candidateTons - targetTons)` ascending, returns the top 3.
5. Exposes `{ suggestions: Ref<Product[]>, loading: Ref<boolean>, error: Ref<string | null> }`. On fetch failure, `fetchProducts()` already falls back to mock data (existing behavior, unchanged by the relocation) — so `error` only surfaces for something *else* going wrong, not a normal offline/unconfigured-Supabase case.

**`EquipmentSuggestions.vue`:** takes `:target-tons="result.tons"`, renders the top 3 as compact rows — name, formatted capacity (`"2–5 TR"` etc., shown verbatim from the spec, not the parsed midpoint), price via `formatCurrency(product.priceCop ?? product.priceUsd)` (from `@fsparts/core`; role-aware wholesale pricing is intentionally not applied here — this is a pointer to the catalog, not a purchase flow, and the linked product page already resolves the correct tier), and a "Ver producto →" link. Replaces the "Próximamente" block in both `AcResults.vue` and `ColdResults.vue`. If `suggestions` is empty (nothing parsed, or nothing passed the sanity bound), shows a quiet "No encontramos equipos con esa capacidad en el catálogo" message instead of an empty section — never blocks or delays display of the calculation result itself, which renders independently.

The "Ver producto →" link is a plain `<a :href>` (not `RouterLink` — cross-subdomain), built as `` `${shopUrl}/product/${product.slug}` `` where `shopUrl` comes from `import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org'`, mirroring the pattern just fixed on the shop→calculator link.

## Error Handling

- `fetchProducts()` failure/unconfigured-Supabase: already handled by the existing fallback-to-mock behavior (relocated unchanged from Phase 2). The suggestion panel functions against mock data in that case, same as shop's catalog does today.
- Capacity parsing failure (malformed spec, unexpected unit): silently excluded per-product, never surfaced as an error — this is expected/routine given specs are free-text admin input, not a fault condition.
- Zero qualifying suggestions: quiet empty state, not an error state (see above).
- The calculator's own math (`calculateAcLoad`/`calculateColdLoad`) is unchanged, pure, and has no failure mode to handle — ported as-is.

## Testing

- `capacity-parser.test.ts` (new, TDD): single value, range, `BTU/h` conversion, thousands separator, wrong/missing unit → `null`, missing `Capacidad` key → `null`, case-insensitive key match.
- `useEquipmentSuggestions.test.ts` (new): mocks `fetchProducts` to return fixture products; verifies filtering to `L06`, ranking order, the 0.5×–2× sanity bound (both a too-small and too-large candidate excluded), and top-3 truncation.
- `ac-calculator.test.ts` / `cold-calculator.test.ts` port verbatim — already-passing pure-function tests, no changes needed.
- `apps/calculator/src/App.test.ts` updated to the real router (same pattern as Phase 2's Task 11): mounts `App.vue` at `/`, asserts the mode-selector screen (`ModeSelector.vue`'s "Aire Acondicionado" / "Cuarto Frío" options) renders inside the shared header/footer.
- No test for `EquipmentSuggestions.vue` or the wizard step components themselves — presentational `.vue` components are not unit-tested, per the convention already established in Phase 1/2 (only business logic — stores, composables, pure functions — gets tests).

**Final verification:** `npm test` (full monorepo suite), `vue-tsc --noEmit -p apps/calculator/tsconfig.json`, `npm run build:calculator`.
