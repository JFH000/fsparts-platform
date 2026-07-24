# Phase 3: Calculator Vertical Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `fsp_web`'s HVAC load-calculation wizard into `apps/calculator`, and add a new "equipment suggestion" feature that matches the calculated cooling load against real catalog products.

**Architecture:** `fsp_web/src/modules/hvac/*` has zero dependency on shared/core/auth/catalog/cart — it ports verbatim, file for file, with no import rewrites. To let the new suggestion feature query the same products shop uses, `apps/shop`'s `catalog.service.ts` (and its mock-data fallback) relocates from `apps/shop` into `@fsparts/core`, where both apps can reach it. The suggestion feature itself is two small new modules local to `apps/calculator`: a pure spec-string parser and a composable that fetches, filters, and ranks.

**Tech Stack:** Vue 3.5 Composition API, Vite, Vitest 4, `@fsparts/core` (Supabase client, types, now also catalog fetch), `@lucide/vue` icons.

## Global Constraints

- Every file ported from `fsp_web/src/modules/hvac/*` is byte-identical to its source — this module has no `@/shared`, `@/core`, or `@/modules/{auth,catalog,cart}` imports in `fsp_web`, only `vue` and `@lucide/vue`. Use `cp` (not Read+Write) to preserve line endings, exactly as Phase 2 did.
- `apps/calculator` has no `@` alias (unlike `apps/shop`) and none is added — all new code in `apps/calculator` uses relative imports, matching the ported `hvac` module's own convention.
- BTU/h ↔ TR (tons of refrigeration) conversion uses `12000 BTU/h = 1 TR` — the standard engineering rounding, used consistently everywhere this conversion appears in this phase.
- `@fsparts/core`'s existing flat file convention (`packages/core/src/*.ts`, co-located `*.test.ts`, no subdirectories) is preserved for the two relocated files — they land at `packages/core/src/catalog.ts` and `packages/core/src/mockCatalog.ts`, not in a `data/` subfolder.

---

### Task 1: Relocate catalog fetch and mock data into `@fsparts/core`

**Files:**
- Create: `packages/core/src/mockCatalog.ts` (relocated from `apps/shop/src/modules/catalog/data/mock.ts`)
- Create: `packages/core/src/catalog.ts` (relocated from `apps/shop/src/modules/catalog/services/catalog.service.ts`)
- Modify: `packages/core/src/index.ts`
- Modify: `apps/shop/src/modules/catalog/stores/catalog.store.ts`
- Delete: `apps/shop/src/modules/catalog/data/mock.ts`
- Delete: `apps/shop/src/modules/catalog/services/catalog.service.ts`

**Interfaces:**
- Produces: `@fsparts/core` now exports `fetchProducts(): Promise<Product[]>`, `fetchProductLines(): Promise<ProductLine[]>`, `fetchBrands(): Promise<Brand[]>`, `fetchCategories(): Promise<Category[]>`, and the mock fixtures `PRODUCTS`, `PRODUCT_LINES`, `BRANDS`, `CATEGORIES`, `REFRIGERANTS`, `MAX_PRICE`. Task 6 consumes `fetchProducts`.

- [ ] **Step 1: Copy the mock catalog data into `@fsparts/core`**

```bash
cp apps/shop/src/modules/catalog/data/mock.ts packages/core/src/mockCatalog.ts
```

- [ ] **Step 2: Fix the copied file's only import (it now lives inside the package it used to import from)**

In `packages/core/src/mockCatalog.ts`:

```
- import type { ProductLine, Brand, Category, Product } from '@fsparts/core'
+ import type { ProductLine, Brand, Category, Product } from './types'
```

- [ ] **Step 3: Copy the catalog service into `@fsparts/core`**

```bash
cp apps/shop/src/modules/catalog/services/catalog.service.ts packages/core/src/catalog.ts
```

- [ ] **Step 4: Fix the copied file's imports**

In `packages/core/src/catalog.ts`, the first three lines change:

```
- import { supabase } from '@fsparts/core'
- import type { Product, ProductLine, Brand, Category } from '@fsparts/core'
- import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES } from '@/modules/catalog/data/mock'
+ import { supabase } from './client'
+ import type { Product, ProductLine, Brand, Category } from './types'
+ import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES } from './mockCatalog'
```

Nothing else in the file changes — the `DbProduct` type, all four mappers, and all four fetchers (`fetchProductLines`, `fetchBrands`, `fetchCategories`, `fetchProducts`) are copied unchanged.

- [ ] **Step 5: Export the new members from `@fsparts/core`'s index**

In `packages/core/src/index.ts`, append after the existing `export type { ... } from './types'` block:

```typescript
export { fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from './catalog'
export { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES, REFRIGERANTS, MAX_PRICE } from './mockCatalog'
```

- [ ] **Step 6: Update `apps/shop`'s catalog store to import from `@fsparts/core`**

In `apps/shop/src/modules/catalog/stores/catalog.store.ts`, lines 4-6 currently read:

```typescript
import type { Product, ProductLine, Brand, Category, FilterState, SortOption } from '@fsparts/core'
import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES, REFRIGERANTS, MAX_PRICE } from '../data/mock'
import { fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from '@/modules/catalog/services/catalog.service'
```

Replace with:

```typescript
import type { Product, ProductLine, Brand, Category, FilterState, SortOption } from '@fsparts/core'
import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES, REFRIGERANTS, MAX_PRICE, fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from '@fsparts/core'
```

Nothing else in `catalog.store.ts` changes — `initialize()` and every other function calls these same names, unchanged.

- [ ] **Step 7: Delete the now-redundant files in `apps/shop`**

```bash
git rm apps/shop/src/modules/catalog/data/mock.ts apps/shop/src/modules/catalog/services/catalog.service.ts
```

- [ ] **Step 8: Verify nothing broke**

Run: `npm test`
Expected: `Test Files 12 passed (12)`, `Tests 41 passed (41)` — same counts as before this task, since no test was added, removed, or changed, only relocated source.

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: no output (clean).

Run: `npm run build:shop`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/mockCatalog.ts packages/core/src/catalog.ts packages/core/src/index.ts apps/shop/src/modules/catalog/stores/catalog.store.ts
git commit -m "refactor(core): relocate catalog fetch and mock data from apps/shop into @fsparts/core"
```

(The deletions from Step 7 are already staged by `git rm` — no separate `git add` needed for them.)

---

### Task 2: Port the pure HVAC calculator functions

**Files:**
- Create: `apps/calculator/src/modules/hvac/utils/ac-calculator.ts`
- Create: `apps/calculator/src/modules/hvac/utils/ac-calculator.test.ts`
- Create: `apps/calculator/src/modules/hvac/utils/cold-calculator.ts`
- Create: `apps/calculator/src/modules/hvac/utils/cold-calculator.test.ts`

**Interfaces:**
- Produces: `calculateAcLoad(i: AcInputs): AcResult`, `defaultAcInputs(): AcInputs`, and types `AcInputs`/`AcResult`/`Orientation`/`WallInsulation`/`RoofType`/`WindowType`/`SolarExposure`/`LightingLevel`/`EquipmentLevel` from `ac-calculator.ts`. `calculateColdLoad(i: ColdInputs): ColdResult`, `defaultColdInputs(): ColdInputs`, and types `ColdInputs`/`ColdResult`/`ColdType`/`InsulationThickness`/`InsulationMaterial`/`ProductType`/`DoorFrequency` from `cold-calculator.ts`. Tasks 3 and 4 consume these.

- [ ] **Step 1: Create the utils directory and copy both calculators and their tests**

```bash
mkdir -p apps/calculator/src/modules/hvac/utils
cp fsp_web/src/modules/hvac/utils/ac-calculator.ts apps/calculator/src/modules/hvac/utils/ac-calculator.ts
cp fsp_web/src/modules/hvac/utils/ac-calculator.test.ts apps/calculator/src/modules/hvac/utils/ac-calculator.test.ts
cp fsp_web/src/modules/hvac/utils/cold-calculator.ts apps/calculator/src/modules/hvac/utils/cold-calculator.ts
cp fsp_web/src/modules/hvac/utils/cold-calculator.test.ts apps/calculator/src/modules/hvac/utils/cold-calculator.test.ts
```

(Run from the `fsparts-platform` repo root, with `fsp_web` checked out as a sibling directory — same layout Phase 2 used.)

No edits — both files import only from `vitest` and their sibling `.ts` file via a relative path that's identical in the new location.

- [ ] **Step 2: Verify the ported tests pass**

Run: `npx vitest run ac-calculator cold-calculator`
Expected: `Test Files 2 passed (2)`, `Tests 16 passed (16)` (7 in `ac-calculator.test.ts` + 9 in `cold-calculator.test.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/calculator/src/modules/hvac/utils
git commit -m "feat(calculator): port ac-calculator and cold-calculator pure functions from fsp_web"
```

---

### Task 3: Add `@lucide/vue` and port the wizard components

**Files:**
- Modify: `apps/calculator/package.json`
- Create: `apps/calculator/src/modules/hvac/components/ModeSelector.vue`
- Create: `apps/calculator/src/modules/hvac/components/WizardProgress.vue`
- Create: `apps/calculator/src/modules/hvac/components/ac/AcStep1Dimensions.vue`
- Create: `apps/calculator/src/modules/hvac/components/ac/AcStep2Conditions.vue`
- Create: `apps/calculator/src/modules/hvac/components/ac/AcStep3InternalLoads.vue`
- Create: `apps/calculator/src/modules/hvac/components/ac/AcResults.vue`
- Create: `apps/calculator/src/modules/hvac/components/cold/ColdStep1Type.vue`
- Create: `apps/calculator/src/modules/hvac/components/cold/ColdStep2Dimensions.vue`
- Create: `apps/calculator/src/modules/hvac/components/cold/ColdStep3Product.vue`
- Create: `apps/calculator/src/modules/hvac/components/cold/ColdStep4InternalLoads.vue`
- Create: `apps/calculator/src/modules/hvac/components/cold/ColdResults.vue`

**Interfaces:**
- Consumes: `AcInputs`/`AcResult`/`Orientation`/etc. from `../../utils/ac-calculator` and `ColdInputs`/`ColdResult`/etc. from `../../utils/cold-calculator` (Task 2).
- Produces: all 11 components, importable by path. `AcResults.vue` and `ColdResults.vue` each still contain the original "Sugerencia de equipos — Próximamente" placeholder block at this point — Task 7 replaces it. `ModeSelector.vue` emits `select: ['ac' | 'cold']`. Task 4 consumes all 11.

- [ ] **Step 1: Add `@lucide/vue` as a dependency**

In `apps/calculator/package.json`, the `dependencies` block currently reads:

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
Expected: exits 0, `apps/calculator/node_modules/@lucide/vue` (or the workspace-hoisted root `node_modules/@lucide/vue`) now exists.

- [ ] **Step 3: Create the component directories and copy all 11 files verbatim**

```bash
mkdir -p apps/calculator/src/modules/hvac/components/ac apps/calculator/src/modules/hvac/components/cold

cp fsp_web/src/modules/hvac/components/ModeSelector.vue apps/calculator/src/modules/hvac/components/ModeSelector.vue
cp fsp_web/src/modules/hvac/components/WizardProgress.vue apps/calculator/src/modules/hvac/components/WizardProgress.vue

cp fsp_web/src/modules/hvac/components/ac/AcStep1Dimensions.vue apps/calculator/src/modules/hvac/components/ac/AcStep1Dimensions.vue
cp fsp_web/src/modules/hvac/components/ac/AcStep2Conditions.vue apps/calculator/src/modules/hvac/components/ac/AcStep2Conditions.vue
cp fsp_web/src/modules/hvac/components/ac/AcStep3InternalLoads.vue apps/calculator/src/modules/hvac/components/ac/AcStep3InternalLoads.vue
cp fsp_web/src/modules/hvac/components/ac/AcResults.vue apps/calculator/src/modules/hvac/components/ac/AcResults.vue

cp fsp_web/src/modules/hvac/components/cold/ColdStep1Type.vue apps/calculator/src/modules/hvac/components/cold/ColdStep1Type.vue
cp fsp_web/src/modules/hvac/components/cold/ColdStep2Dimensions.vue apps/calculator/src/modules/hvac/components/cold/ColdStep2Dimensions.vue
cp fsp_web/src/modules/hvac/components/cold/ColdStep3Product.vue apps/calculator/src/modules/hvac/components/cold/ColdStep3Product.vue
cp fsp_web/src/modules/hvac/components/cold/ColdStep4InternalLoads.vue apps/calculator/src/modules/hvac/components/cold/ColdStep4InternalLoads.vue
cp fsp_web/src/modules/hvac/components/cold/ColdResults.vue apps/calculator/src/modules/hvac/components/cold/ColdResults.vue
```

No edits to any of these 11 files in this task — each one's imports (`vue`, `@lucide/vue`, and relative paths to `../../utils/{ac,cold}-calculator`) resolve identically in the new location. Each file's `<style scoped>` block (where present) references `@reference "../../../../style.css"`, which resolves to `apps/calculator/src/style.css` — same relative depth as in `fsp_web`.

- [ ] **Step 4: Verify it all compiles**

Run: `npx vue-tsc --noEmit -p apps/calculator/tsconfig.json`
Expected: no output (clean). (Nothing routes to these components yet, but they must still type-check standalone.)

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/package.json package-lock.json apps/calculator/src/modules/hvac/components
git commit -m "feat(calculator): port HVAC wizard components from fsp_web"
```

---

### Task 4: Port the calculator view and wire up routing

**Files:**
- Create: `apps/calculator/src/modules/hvac/views/HvacCalculatorView.vue`
- Modify: `apps/calculator/src/router/index.ts`
- Delete: `apps/calculator/src/views/HomeView.vue`

**Interfaces:**
- Consumes: all 11 components from Task 3, `calculateAcLoad`/`defaultAcInputs`/`calculateColdLoad`/`defaultColdInputs` from Task 2.
- Produces: `HvacCalculatorView.vue`, routed at `/`. Task 8's smoke test navigates to `/` and expects this view's content.

- [ ] **Step 1: Copy the view verbatim**

```bash
mkdir -p apps/calculator/src/modules/hvac/views
cp fsp_web/src/modules/hvac/views/HvacCalculatorView.vue apps/calculator/src/modules/hvac/views/HvacCalculatorView.vue
```

No edits — its imports are all relative (`../components/...`, `../utils/...`) and resolve identically in the new location.

- [ ] **Step 2: Replace the router's placeholder route**

Replace the full contents of `apps/calculator/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'hvac-calculator', component: () => import('../modules/hvac/views/HvacCalculatorView.vue') },
  ],
})

export default router
```

- [ ] **Step 3: Delete the placeholder home view**

```bash
git rm apps/calculator/src/views/HomeView.vue
```

- [ ] **Step 4: Verify**

Run: `npx vue-tsc --noEmit -p apps/calculator/tsconfig.json`
Expected: no output (clean).

Run: `npm run build:calculator`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/src/modules/hvac/views apps/calculator/src/router/index.ts
git commit -m "feat(calculator): wire full HVAC wizard, retire placeholder HomeView"
```

(The `HomeView.vue` deletion from Step 3 is already staged by `git rm`.)

---

### Task 5: `capacity-parser.ts` — parse a product's free-text capacity spec into tons

**Files:**
- Create: `apps/calculator/src/modules/hvac/utils/capacity-parser.ts`
- Test: `apps/calculator/src/modules/hvac/utils/capacity-parser.test.ts`

**Interfaces:**
- Consumes: `ProductSpec` type from `@fsparts/core` (`{ key: string; value: string; unit?: string; group?: string }`).
- Produces: `parseCapacityToTons(specs: ProductSpec[]): number | null`. Task 6 consumes this.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/calculator/src/modules/hvac/utils/capacity-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseCapacityToTons } from './capacity-parser'

describe('parseCapacityToTons', () => {
  it('parses a single value in TR', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '5', unit: 'TR' }])).toBe(5)
  })

  it('parses a range in TR as its midpoint', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '2–5', unit: 'TR' }])).toBe(3.5)
  })

  it('converts BTU/h to TR', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '30,000', unit: 'BTU/h' }])).toBeCloseTo(2.5, 5)
  })

  it('strips thousands separators before parsing', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '4,460', unit: 'BTU/h' }])).toBeCloseTo(4460 / 12000, 5)
  })

  it('returns null when no Capacidad spec is present', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad de secado', value: '15', unit: 'g H₂O' }])).toBeNull()
  })

  it('matches the Capacidad key case-insensitively', () => {
    expect(parseCapacityToTons([{ key: 'capacidad', value: '5', unit: 'TR' }])).toBe(5)
  })

  it('returns null for an unrecognized unit', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '5', unit: 'kg' }])).toBeNull()
  })

  it('returns null when the value has no parseable number', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: 'n/a', unit: 'TR' }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run capacity-parser`
Expected: FAIL — `Cannot find module './capacity-parser'` (the file doesn't exist yet).

- [ ] **Step 3: Implement**

```typescript
// apps/calculator/src/modules/hvac/utils/capacity-parser.ts
import type { ProductSpec } from '@fsparts/core'

const BTU_PER_TON = 12000

export function parseCapacityToTons(specs: ProductSpec[]): number | null {
  const spec = specs.find(s => s.key.toLowerCase() === 'capacidad')
  if (!spec) return null

  const numbers = spec.value
    .replace(/,/g, '')
    .split('–')
    .map(part => Number.parseFloat(part.trim()))
    .filter(n => !Number.isNaN(n))

  if (!numbers.length) return null

  const midpoint = numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  const unit = (spec.unit ?? '').trim().toUpperCase()

  if (unit === 'TR') return midpoint
  if (unit === 'BTU/H') return midpoint / BTU_PER_TON
  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run capacity-parser`
Expected: `Test Files 1 passed (1)`, `Tests 8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/src/modules/hvac/utils/capacity-parser.ts apps/calculator/src/modules/hvac/utils/capacity-parser.test.ts
git commit -m "feat(calculator): add capacity-parser for reading product Capacidad specs"
```

---

### Task 6: `useEquipmentSuggestions` — fetch, filter, and rank matching products

**Files:**
- Create: `apps/calculator/src/modules/hvac/composables/useEquipmentSuggestions.ts`
- Test: `apps/calculator/src/modules/hvac/composables/useEquipmentSuggestions.test.ts`

**Interfaces:**
- Consumes: `fetchProducts` and `Product`/`ProductSpec` types from `@fsparts/core` (Task 1); `parseCapacityToTons` from `../utils/capacity-parser` (Task 5).
- Produces: `useEquipmentSuggestions(targetTons: Ref<number>): { suggestions: Ref<Product[]>; loading: Ref<boolean>; error: Ref<string | null> }`. Task 7 consumes this.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/calculator/src/modules/hvac/composables/useEquipmentSuggestions.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { Product, ProductSpec } from '@fsparts/core'

const fetchProductsMock = vi.fn()

vi.mock('@fsparts/core', () => ({
  fetchProducts: (...args: unknown[]) => fetchProductsMock(...args),
}))

import { useEquipmentSuggestions } from './useEquipmentSuggestions'

function makeProduct(opts: { id: string; specs?: ProductSpec[]; lineCode?: string }): Product {
  return {
    id: opts.id,
    sku: opts.id,
    name: opts.id,
    slug: opts.id,
    description: '',
    brand: { id: 1, name: 'Brand', slug: 'brand' },
    category: { id: 1, name: 'Cat', slug: 'cat', productLineId: 2 },
    productLine: {
      id: 2,
      code: opts.lineCode ?? 'L06',
      name: 'Compresores',
      description: '',
      icon: 'Settings2',
      slug: 'compresores',
    },
    stock: 10,
    isFeatured: false,
    images: [],
    specs: opts.specs ?? [],
    refrigerants: [],
  }
}

describe('useEquipmentSuggestions', () => {
  it('filters to the Compresores product line (L06)', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'compressor', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
      makeProduct({ id: 'valve', lineCode: 'L10', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['compressor'])
  })

  it('excludes products without a parseable capacity spec', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'no-spec' }),
      makeProduct({ id: 'has-spec', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['has-spec'])
  })

  it('excludes candidates outside the 0.5x-2x sanity bound', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'too-small', specs: [{ key: 'Capacidad', value: '1',  unit: 'TR' }] }),
      makeProduct({ id: 'in-range',  specs: [{ key: 'Capacidad', value: '4',  unit: 'TR' }] }),
      makeProduct({ id: 'too-big',   specs: [{ key: 'Capacidad', value: '20', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['in-range'])
  })

  it('sorts by closeness to the target and caps at 3 results', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'far',     specs: [{ key: 'Capacidad', value: '8',   unit: 'TR' }] }),
      makeProduct({ id: 'closest', specs: [{ key: 'Capacidad', value: '5',   unit: 'TR' }] }),
      makeProduct({ id: 'near',    specs: [{ key: 'Capacidad', value: '6',   unit: 'TR' }] }),
      makeProduct({ id: 'nearer',  specs: [{ key: 'Capacidad', value: '4.5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['closest', 'nearer', 'near'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run useEquipmentSuggestions`
Expected: FAIL — `Cannot find module './useEquipmentSuggestions'` (the file doesn't exist yet).

- [ ] **Step 3: Implement**

```typescript
// apps/calculator/src/modules/hvac/composables/useEquipmentSuggestions.ts
import { ref, watch, type Ref } from 'vue'
import { fetchProducts, type Product } from '@fsparts/core'
import { parseCapacityToTons } from '../utils/capacity-parser'

const COMPRESSOR_LINE_CODE = 'L06'
const MIN_RATIO = 0.5
const MAX_RATIO = 2
const MAX_RESULTS = 3

export function useEquipmentSuggestions(targetTons: Ref<number>) {
  const suggestions = ref<Product[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const target = targetTons.value
      const products = await fetchProducts()

      const ranked = products
        .filter(p => p.productLine.code === COMPRESSOR_LINE_CODE)
        .map(p => ({ product: p, tons: parseCapacityToTons(p.specs) }))
        .filter((entry): entry is { product: Product; tons: number } => entry.tons !== null)
        .filter(entry => entry.tons >= target * MIN_RATIO && entry.tons <= target * MAX_RATIO)
        .sort((a, b) => Math.abs(a.tons - target) - Math.abs(b.tons - target))
        .slice(0, MAX_RESULTS)

      suggestions.value = ranked.map(entry => entry.product)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  watch(targetTons, load, { immediate: true })

  return { suggestions, loading, error }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run useEquipmentSuggestions`
Expected: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/src/modules/hvac/composables
git commit -m "feat(calculator): add useEquipmentSuggestions composable"
```

---

### Task 7: `EquipmentSuggestions.vue` — wire the suggestion panel into both result screens

**Files:**
- Create: `apps/calculator/src/modules/hvac/components/EquipmentSuggestions.vue`
- Modify: `apps/calculator/src/modules/hvac/components/ac/AcResults.vue`
- Modify: `apps/calculator/src/modules/hvac/components/cold/ColdResults.vue`

**Interfaces:**
- Consumes: `useEquipmentSuggestions` (Task 6), `formatCurrency` and `Product` type from `@fsparts/core`.
- Produces: `EquipmentSuggestions.vue`, taking a single prop `targetTons: number`.

- [ ] **Step 1: Create the component**

```vue
<!-- apps/calculator/src/modules/hvac/components/EquipmentSuggestions.vue -->
<template>
  <div v-if="loading" class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
    <p class="text-sm text-slate-400">Buscando equipos recomendados…</p>
  </div>

  <div v-else-if="suggestions.length" class="rounded-2xl border border-slate-200 overflow-hidden mb-6">
    <div class="px-5 py-3 border-b border-slate-100">
      <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipos recomendados</p>
    </div>
    <div class="divide-y divide-slate-50">
      <div v-for="product in suggestions" :key="product.id" class="flex items-center justify-between gap-3 px-5 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">{{ product.name }}</p>
          <p class="text-xs text-slate-400">{{ capacityLabel(product) }} · {{ formatCurrency(product.priceCop ?? product.priceUsd ?? 0) }}</p>
        </div>
        <a :href="productUrl(product)" class="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">Ver producto →</a>
      </div>
    </div>
  </div>

  <div v-else class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
    <Wrench class="h-6 w-6 text-slate-300 mx-auto mb-2" aria-hidden="true" />
    <p class="text-sm font-semibold text-slate-400">Equipos recomendados</p>
    <p class="text-xs text-slate-300 mt-1">No encontramos equipos con esa capacidad en el catálogo</p>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { Wrench } from '@lucide/vue'
import { formatCurrency, type Product } from '@fsparts/core'
import { useEquipmentSuggestions } from '../composables/useEquipmentSuggestions'

const props = defineProps<{ targetTons: number }>()
const targetTonsRef = toRef(props, 'targetTons')
const { suggestions, loading } = useEquipmentSuggestions(targetTonsRef)

const shopUrl = import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org'

function productUrl(product: Product): string {
  return `${shopUrl}/product/${product.slug}`
}

function capacityLabel(product: Product): string {
  const spec = product.specs.find(s => s.key.toLowerCase() === 'capacidad')
  return spec ? `${spec.value} ${spec.unit ?? ''}`.trim() : ''
}
</script>
```

- [ ] **Step 2: Wire it into `AcResults.vue`, replacing the placeholder**

In `apps/calculator/src/modules/hvac/components/ac/AcResults.vue`, the template's "Coming soon" block currently reads:

```html
    <!-- Coming soon -->
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
      <Lock class="h-6 w-6 text-slate-300 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-400">Sugerencia de equipos</p>
      <p class="text-xs text-slate-300 mt-1">Próximamente</p>
    </div>
```

Replace with:

```html
    <!-- Equipment suggestions -->
    <EquipmentSuggestions :target-tons="result.tons" />
```

In the same file's `<script setup>`, the import block currently reads:

```typescript
import { computed, defineComponent, h } from 'vue'
import { Lock } from '@lucide/vue'
import type { AcResult } from '../../utils/ac-calculator'
```

Replace with:

```typescript
import { computed, defineComponent, h } from 'vue'
import type { AcResult } from '../../utils/ac-calculator'
import EquipmentSuggestions from '../EquipmentSuggestions.vue'
```

(`Lock` is removed — it was only used in the block just deleted; `EquipmentSuggestions.vue` renders its own `Wrench` icon internally.)

- [ ] **Step 3: Wire it into `ColdResults.vue`, replacing the placeholder**

In `apps/calculator/src/modules/hvac/components/cold/ColdResults.vue`, the same "Coming soon" block:

```html
    <!-- Coming soon -->
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
      <Lock class="h-6 w-6 text-slate-300 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-400">Sugerencia de equipos</p>
      <p class="text-xs text-slate-300 mt-1">Próximamente</p>
    </div>
```

Replace with:

```html
    <!-- Equipment suggestions -->
    <EquipmentSuggestions :target-tons="result.tons" />
```

Its `<script setup>` import block currently reads:

```typescript
import { computed } from 'vue'
import { Lock } from '@lucide/vue'
import type { ColdResult } from '../../utils/cold-calculator'
```

Replace with:

```typescript
import { computed } from 'vue'
import type { ColdResult } from '../../utils/cold-calculator'
import EquipmentSuggestions from '../EquipmentSuggestions.vue'
```

- [ ] **Step 4: Verify**

Run: `npx vue-tsc --noEmit -p apps/calculator/tsconfig.json`
Expected: no output (clean).

Run: `npm test`
Expected: all previously-passing tests still pass (no test targets `AcResults.vue`/`ColdResults.vue`/`EquipmentSuggestions.vue` directly — these are presentational components, per the project's established testing convention).

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/src/modules/hvac/components/EquipmentSuggestions.vue apps/calculator/src/modules/hvac/components/ac/AcResults.vue apps/calculator/src/modules/hvac/components/cold/ColdResults.vue
git commit -m "feat(calculator): show real equipment suggestions in AC and cold-room results"
```

---

### Task 8: Update the App smoke test for the real router

**Files:**
- Modify: `apps/calculator/src/App.test.ts`

**Interfaces:**
- Consumes: the real router from `./router` (Task 4).

- [ ] **Step 1: Replace the test**

`apps/calculator/src/App.test.ts` currently mounts `App.vue` against a throwaway router pointed at the now-deleted `HomeView.vue`. Replace its full contents:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from './router'
import App from './App.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('Aire Acondicionado')
  })
})
```

(`setActivePinia(pinia)` is required before `mount()` — the router's navigation can trigger code that reads from Pinia before the plugin is installed on the component tree. This is the same fix Phase 2 needed for `apps/shop/src/App.test.ts`.)

- [ ] **Step 2: Run it**

Run: `npx vitest run apps/calculator/src/App.test.ts`
Expected: `Test Files 1 passed (1)`, `Tests 1 passed (1)`.

- [ ] **Step 3: Commit**

```bash
git add apps/calculator/src/App.test.ts
git commit -m "test(calculator): update App smoke test for the real router"
```

---

### Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full monorepo test suite**

Run: `npm test`
Expected: all test files pass. Compared to before this phase (12 files / 41 tests), this phase adds: `ac-calculator.test.ts` (7), `cold-calculator.test.ts` (9), `capacity-parser.test.ts` (8), `useEquipmentSuggestions.test.ts` (4), and the rewritten `apps/calculator/App.test.ts` (1, replacing the old 1) — so expect `Test Files 16 passed (16)`, `Tests 69 passed (69)`.

- [ ] **Step 2: Type-check both touched apps**

Run: `npx vue-tsc --noEmit -p apps/shop/tsconfig.json`
Expected: no output (clean).

Run: `npx vue-tsc --noEmit -p apps/calculator/tsconfig.json`
Expected: no output (clean).

- [ ] **Step 3: Build both touched apps**

Run: `npm run build:shop`
Expected: `✓ built in ...` with no errors.

Run: `npm run build:calculator`
Expected: `✓ built in ...` with no errors.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git commit --allow-empty -m "chore: verify Phase 3 calculator migration builds and tests pass end to end"
```
