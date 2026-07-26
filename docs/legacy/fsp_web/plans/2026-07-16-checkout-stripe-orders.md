# Checkout, Stripe Payments & Order Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in customer pay for their cart via Stripe Checkout, record the order permanently, let the admin manage fulfillment status from a new "Ventas" view, and let the customer see their own order history in "Mis pedidos".

**Architecture:** Stripe Checkout (hosted page) triggered by a Supabase Edge Function that recomputes prices server-side from the database (never trusts the client); a second Edge Function verifies Stripe's webhook and flips the order to `paid`; a new `orders` table (RLS-protected, client never writes it directly) backs both the customer-facing and admin-facing views, which follow this codebase's existing list/detail UI patterns.

**Tech Stack:** Vue 3 (`<script setup>`), Pinia, Vue Router 4, TypeScript (`noUnusedLocals`/`noUnusedParameters` enabled), Vitest, Supabase (Postgres, Edge Functions on Deno), Stripe (Checkout + Webhooks via the `stripe` npm package imported through `esm.sh`).

**Full design spec:** `docs/superpowers/specs/2026-07-16-checkout-stripe-orders-design.md` — read it before starting if anything below is ambiguous; this plan implements it in full.

## Global Constraints

- Every frontend task (1, 2, 6, 7, 8, 9) must end with both of these passing exactly as shown, run from the repo root `C:/Users/juanf/fsp_web`:
  - `npm run test -- --run` — baseline before this plan starts is **4 test files, 29 tests**, all passing. Tasks that add tests should only ever increase this count.
  - `npx vue-tsc --noEmit -p tsconfig.json` — must exit with **zero output, zero errors**. `noUnusedLocals`/`noUnusedParameters` are on, so this is the authoritative check for orphaned imports.
- This codebase has **no Vue component-mounting tests** — `vitest.config.ts` sets `test: { environment: 'node' }` (no DOM), and the only 4 existing test files test pure logic (composables, calculator utils), never `.vue` files with `@vue/test-utils`. Follow this convention: write real unit tests for store/composable/service logic (pure functions, Pinia stores), and rely on `vue-tsc` + manual verification for template-only `.vue` changes — do not introduce a new component-testing setup as part of this plan.
- **Tasks 3, 4, and 5 are executed directly by the plan's controller, not dispatched to an implementer subagent.** They require the Supabase MCP tools (`execute_sql`, `deploy_edge_function`) that a fresh subagent will not have loaded, and Task 3 changes live backend schema — same reasoning and precedent as the controller-executed backend task in the prior removal plan (`docs/superpowers/plans/2026-07-15-remove-favorites-stock-settings-csv-random.md`). They are still logged in the progress ledger and still get a task-reviewer pass.
- **Required Edge Function secrets** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SITE_URL` are not yet set anywhere in this project. Deploying the functions (Tasks 4-5) does not require them to exist yet, but the functions will error at *invocation* time until they're set. Setting secrets is very likely a manual step for the user (Supabase Dashboard → Edge Functions → Secrets) — the controller should attempt it via any available MCP tool first (none was found in this session's tool catalog as of the design phase; re-check at Task 4 time in case that's changed) and clearly flag it to the user if not, exactly as the `sync-sheets` Edge Function's pending manual deletion was flagged in the prior plan.
- **Currency:** COP is a standard 2-decimal currency in Stripe (**not** zero-decimal — this plan's first draft incorrectly assumed it was, matching JPY/KRW-style currencies; corrected during Task 4's review after independent verification against Stripe's own currency docs). `unit_amount` in a Checkout Session line item must be the whole-peso price **×100** (centavos), same convention as USD cents. `formatCurrency`'s display-only `minimumFractionDigits: 0` is unrelated to this — it only controls UI rendering, not what Stripe's API expects.
- **Pricing tier logic is intentionally duplicated once:** `src/modules/catalog/composables/useProductPrice.ts` exports a pure `resolveEffectivePrice(product, qty, role)` function (Task 1). The `create-checkout-session` Edge Function (Task 4, Deno) cannot import that file across the frontend/edge-function boundary, so it reimplements the identical rules inline. Task 4's brief below contains the exact code to write — if the tier rules ever change, both copies must change together.
- **Stripe + Deno import pattern (verified against Supabase's official docs during design):** `import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'` — the `?target=deno` suffix is required or the import throws (documented Supabase troubleshooting gotcha). The Stripe client must be constructed with `httpClient: Stripe.createFetchHttpClient()` (Node's default HTTP client doesn't work via this import path). Webhook signature verification must use `stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider)` (the async, Web-Crypto-based variant — the sync `constructEvent` uses Node's `crypto` module and does not work in Deno), with `const cryptoProvider = Stripe.createSubtleCryptoProvider()`.
- Follow `src/modules/admin/views/AdminCustomersView.vue`'s list + slide-over-panel pattern for the new admin Ventas view (Task 9) — same table structure, same `Teleport`-based panel, same global `fade`/`slide-right` CSS transition classes already defined in `src/style.css` (no new `<style>` block needed for them).

---

## Task 1: Extract `resolveEffectivePrice` and fix cart's tiered pricing

**Files:**
- Modify: `src/modules/catalog/composables/useProductPrice.ts`
- Modify: `src/modules/catalog/composables/__tests__/useProductPrice.test.ts`
- Modify: `src/modules/cart/stores/cart.store.ts`
- Modify: `src/modules/cart/views/CartView.vue`
- Create: `src/modules/cart/stores/__tests__/cart.store.test.ts`

**Interfaces:**
- Produces: `resolveEffectivePrice(product: Product, qty: number, role: UserRole | null | undefined): ResolvedPrice` and `export const BULK_THRESHOLD = 10`, both exported from `src/modules/catalog/composables/useProductPrice.ts`. `ResolvedPrice = { effectivePrice: number | null; basePrice: number | null; isDiscounted: boolean; tierLabel: string | null; bulkPrice: number | null }`.
- Produces: `cart.store.ts` exposes a new `lineUnitPrice(item: CartItem): number` action (returns the role-tiered unit price, or `0` if unresolvable), used by `CartView.vue` and later by the checkout view (Task 6).
- Consumes: nothing from other tasks — this is the foundation everything else in this plan builds on.

- [ ] **Step 1: Read the current file, then extract the pure function**

Read `src/modules/catalog/composables/useProductPrice.ts` first. Replace its entire contents with:

```ts
import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import type { Product, UserRole } from '@/shared/types'

export interface PriceResult {
  effectivePrice: ComputedRef<number | null>
  basePrice:      ComputedRef<number | null>
  isDiscounted:   ComputedRef<boolean>
  tierLabel:      ComputedRef<string | null>
  bulkPrice:      ComputedRef<number | null>
  bulkThreshold:  ComputedRef<number>
}

export interface ResolvedPrice {
  effectivePrice: number | null
  basePrice:      number | null
  isDiscounted:   boolean
  tierLabel:      string | null
  bulkPrice:      number | null
}

export const BULK_THRESHOLD = 10

/**
 * Pure tier-pricing calculation, no Vue reactivity — safe to call from
 * plain code (Pinia stores) as well as from the reactive `useProductPrice`
 * wrapper below. Single source of truth for how a product's price resolves
 * for a given role/quantity. The Stripe `create-checkout-session` Edge
 * Function re-implements these exact same rules server-side in Deno (it
 * cannot import this file) — keep both in sync if the rules change.
 */
export function resolveEffectivePrice(
  product: Product,
  qty: number,
  role: UserRole | null | undefined,
): ResolvedPrice {
  const base = product.priceCop ?? product.priceUsd ?? null

  if (role === 'customer_ws1') {
    const ws1       = product.priceWs1 ?? base
    const ws2       = product.priceWs2 ?? null
    const effective = qty >= BULK_THRESHOLD ? (ws2 ?? ws1) : ws1
    return {
      effectivePrice: effective,
      basePrice:      effective !== null && base !== null && effective < base ? base : null,
      isDiscounted:   effective !== null && base !== null && effective < base,
      tierLabel:      product.priceWs1 != null ? (qty >= BULK_THRESHOLD ? 'WS2 ×10' : 'WS1') : null,
      bulkPrice:      qty < BULK_THRESHOLD ? ws2 : null,
    }
  }

  if (role === 'customer_ws3') {
    const ws3       = product.priceWs3 ?? base
    const ws4       = product.priceWs4 ?? null
    const effective = qty >= BULK_THRESHOLD ? (ws4 ?? ws3) : ws3
    return {
      effectivePrice: effective,
      basePrice:      effective !== null && base !== null && effective < base ? base : null,
      isDiscounted:   effective !== null && base !== null && effective < base,
      tierLabel:      product.priceWs3 != null ? (qty >= BULK_THRESHOLD ? 'OEM ×10' : 'OEM') : null,
      bulkPrice:      qty < BULK_THRESHOLD ? ws4 : null,
    }
  }

  return { effectivePrice: base, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
}

export function useProductPrice(
  product: Ref<Product | null | undefined>,
  qty: Ref<number> = ref(1),
): PriceResult {
  const auth = useAuthStore()

  const resolved = computed<ResolvedPrice>(() => {
    const p = product.value
    if (!p) {
      return { effectivePrice: null, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
    }
    return resolveEffectivePrice(p, qty.value, auth.profile?.role)
  })

  return {
    effectivePrice: computed(() => resolved.value.effectivePrice),
    basePrice:      computed(() => resolved.value.basePrice),
    isDiscounted:   computed(() => resolved.value.isDiscounted),
    tierLabel:      computed(() => resolved.value.tierLabel),
    bulkPrice:      computed(() => resolved.value.bulkPrice),
    bulkThreshold:  computed(() => BULK_THRESHOLD),
  }
}
```

This preserves the exact prior behavior — it's a pure refactor (parameterize `role`/`qty` instead of reading them from `auth`/the `qty` ref directly inside the computed). The existing 8 tests in `useProductPrice.test.ts` should keep passing unchanged since they exercise `useProductPrice` the same way as before.

- [ ] **Step 2: Run the existing tests to confirm the refactor didn't change behavior**

Run: `npm run test -- --run src/modules/catalog/composables/__tests__/useProductPrice.test.ts`
Expected: `9 passed (9)`, no failures (the file has 9 `it(...)` blocks today).

- [ ] **Step 3: Add direct tests for the new pure `resolveEffectivePrice` export**

Append to the end of `src/modules/catalog/composables/__tests__/useProductPrice.test.ts`, as a new sibling `describe` block placed *after* the file's existing `describe('useProductPrice', () => { ... })` block's closing `})` (not nested inside it) — reusing the same `BASE` fixture already defined at the top of the file:

```ts
describe('resolveEffectivePrice (pure)', () => {
  it('returns base price with no role, no Vue context required', () => {
    const result = resolveEffectivePrice(BASE, 1, null)
    expect(result.effectivePrice).toBe(100_000)
    expect(result.isDiscounted).toBe(false)
  })

  it('customer_ws1 qty 1 resolves WS1 tier directly', () => {
    const result = resolveEffectivePrice(BASE, 1, 'customer_ws1')
    expect(result.effectivePrice).toBe(80_000)
    expect(result.tierLabel).toBe('WS1')
  })

  it('customer_ws3 qty 10 resolves WS4 bulk tier directly', () => {
    const result = resolveEffectivePrice(BASE, 10, 'customer_ws3')
    expect(result.effectivePrice).toBe(65_000)
    expect(result.tierLabel).toBe('OEM ×10')
  })
})
```

Add `resolveEffectivePrice` to the existing top-of-file import: change `import { useProductPrice } from '../useProductPrice'` to `import { useProductPrice, resolveEffectivePrice } from '../useProductPrice'`.

- [ ] **Step 4: Run the new tests to confirm they pass**

Run: `npm run test -- --run src/modules/catalog/composables/__tests__/useProductPrice.test.ts`
Expected: `12 passed (12)` (9 existing + 3 new).

- [ ] **Step 5: Fix `cart.store.ts` to use tiered pricing instead of flat `priceCop`**

Read `src/modules/cart/stores/cart.store.ts` first. Replace its entire contents with:

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { CartItem, Product } from '@/shared/types'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { resolveEffectivePrice } from '@/modules/catalog/composables/useProductPrice'

export const useCartStore = defineStore('cart', () => {
  const items = useLocalStorage<CartItem[]>('fsp-cart', [])
  const isDrawerOpen = ref(false)

  function lineUnitPrice(item: CartItem): number {
    const auth = useAuthStore()
    return resolveEffectivePrice(item.product, item.quantity, auth.profile?.role).effectivePrice ?? 0
  }

  const totalItems = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  const subtotal   = computed(() => items.value.reduce((s, i) => s + lineUnitPrice(i) * i.quantity, 0))

  function addToCart(product: Product, quantity = 1) {
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      items.value.push({ product, quantity })
    }
    isDrawerOpen.value = true
  }

  function removeFromCart(productId: string) {
    items.value = items.value.filter(i => i.product.id !== productId)
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) { removeFromCart(productId); return }
    const item = items.value.find(i => i.product.id === productId)
    if (item) item.quantity = quantity
  }

  function clearCart() {
    items.value = []
  }

  function openDrawer()  { isDrawerOpen.value = true }
  function closeDrawer() { isDrawerOpen.value = false }

  return {
    items, isDrawerOpen,
    totalItems, subtotal,
    lineUnitPrice,
    addToCart, removeFromCart, updateQuantity, clearCart,
    openDrawer, closeDrawer,
  }
})
```

- [ ] **Step 6: Write the failing test for cart's tiered subtotal**

Create `src/modules/cart/stores/__tests__/cart.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '../cart.store'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import type { Product } from '@/shared/types'

const PRODUCT: Product = {
  id: 'p1', sku: 'T001', name: 'Test', slug: 'test', description: '',
  brand:       { id: 1, name: 'B', slug: 'b' },
  category:    { id: 1, name: 'C', slug: 'c', productLineId: 1 },
  productLine: { id: 1, code: 'L01', name: 'Line', description: '', icon: '', slug: 'l01' },
  priceCop: 100_000, priceUsd: undefined,
  priceWs1: 80_000, priceWs2: 70_000,
  priceWs3: 75_000, priceWs4: 65_000,
  stock: 10, isFeatured: false, isNew: false,
  images: [], specs: [], refrigerants: [],
}

function setRole(role: string | null) {
  const auth = useAuthStore()
  auth.profile = role
    ? { id: 'u1', full_name: null, email: 'u@test.co', phone: null,
        role: role as any, company: null, notes: null }
    : null
}

describe('cart.store subtotal (tiered pricing)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('regular customer pays base priceCop', () => {
    setRole('customer')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(100_000)
  })

  it('customer_ws1 qty 1 pays WS1 tier, not base price', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(80_000)
  })

  it('customer_ws1 qty 10 pays WS2 bulk tier', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 10)
    expect(cart.subtotal).toBe(700_000)
  })

  it('customer_ws3 qty 1 pays OEM (WS3) tier', () => {
    setRole('customer_ws3')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(75_000)
  })

  it('sums multiple lines, each at its own tiered price', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    const second: Product = { ...PRODUCT, id: 'p2', priceWs1: 40_000 }
    cart.addToCart(PRODUCT, 1)
    cart.addToCart(second, 1)
    expect(cart.subtotal).toBe(80_000 + 40_000)
  })

  it('lineUnitPrice matches subtotal / quantity for a single line', () => {
    setRole('customer_ws3')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.lineUnitPrice(cart.items[0])).toBe(75_000)
  })
})
```

Note: `cart.store.ts` uses `useLocalStorage` from `@vueuse/core`, which is SSR/Node-safe and works fine under this project's `environment: 'node'` vitest config (verified during planning — `useCartStore()` constructs and `addToCart` works without a browser `localStorage` global present). `clearCart()` is called at the start of each test because `useLocalStorage` state can otherwise leak between tests within the same run.

- [ ] **Step 7: Run the test to verify it fails first, matching TDD (temporarily), then passes after Step 5's fix**

Since Step 5 (the store fix) was written before this test file per the step ordering above, this test should already pass. Run it to confirm:

Run: `npm run test -- --run src/modules/cart/stores/__tests__/cart.store.test.ts`
Expected: `6 passed (6)`.

If any test fails, re-check Step 5's `lineUnitPrice` implementation against the fixture's WS1/WS3 values before proceeding — do not proceed with a failing test.

- [ ] **Step 8: Fix `CartView.vue`'s displayed per-item price to match**

Read `src/modules/cart/views/CartView.vue` first. It has two occurrences of the same flat-price expression — replace both.

Change (inside the items list, the price shown per cart row):
```html
          <p class="font-extrabold text-slate-900 w-24 text-right">{{ formatCurrency((item.product.priceCop ?? item.product.priceUsd ?? 0) * item.quantity) }}</p>
```
to:
```html
          <p class="font-extrabold text-slate-900 w-24 text-right">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</p>
```

Change (inside the "Resumen del pedido" summary list):
```html
              <span class="font-medium flex-shrink-0">{{ formatCurrency((item.product.priceCop ?? item.product.priceUsd ?? 0) * item.quantity) }}</span>
```
to:
```html
              <span class="font-medium flex-shrink-0">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</span>
```

No script changes needed — `cart` is already `const cart = useCartStore()` in this file.

- [ ] **Step 9: Full verification**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: `5 test files, 38 tests` — baseline 29 tests, minus the 9 in `useProductPrice.test.ts` counted once, plus its new total of 12 (net +3), plus the new `cart.store.test.ts` file's 6 tests (29 + 3 + 6 = 38). `useAuthModal.test.ts` and the two calculator test files are untouched. Run the full suite and confirm 0 failures.

- [ ] **Step 10: Commit**

```bash
git add src/modules/catalog/composables/useProductPrice.ts src/modules/catalog/composables/__tests__/useProductPrice.test.ts src/modules/cart/stores/cart.store.ts src/modules/cart/stores/__tests__/cart.store.test.ts src/modules/cart/views/CartView.vue
git commit -m "fix: cart and checkout now use role-tiered pricing instead of flat price_cop"
```

---

## Task 2: Disable "Agregar al carrito" for products with no resolvable price

**Files:**
- Modify: `src/modules/catalog/components/ProductCard.vue`
- Modify: `src/modules/catalog/views/ProductDetailView.vue`

**Interfaces:**
- Consumes: `effectivePrice` from `useProductPrice` (Task 1, unchanged signature) — both files already call this composable.
- No test file (template-only conditional change — matches this codebase's convention of not testing `.vue` templates directly, per Global Constraints).

- [ ] **Step 1: `ProductCard.vue` — disable the button when price is null**

Read the file first. Change:
```html
        <button
          @click.prevent="handleAdd"
          :disabled="adding"
          class="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <component :is="adding ? Check : ShoppingCart" class="h-3.5 w-3.5" />
          {{ adding ? 'Agregado' : 'Agregar' }}
        </button>
```
to:
```html
        <button
          @click.prevent="handleAdd"
          :disabled="adding || effectivePrice == null"
          :title="effectivePrice == null ? 'Este producto requiere cotización' : undefined"
          class="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <component :is="adding ? Check : ShoppingCart" class="h-3.5 w-3.5" />
          {{ adding ? 'Agregado' : 'Agregar' }}
        </button>
```

`effectivePrice` is already destructured from `useProductPrice(...)` in this file's `<script setup>` — no import changes needed.

- [ ] **Step 2: `ProductDetailView.vue` — disable the button when price is null**

Read the file first. Change:
```html
              <button
                @click="handleAdd"
                class="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 px-6 rounded-xl transition-colors text-base focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
```
to:
```html
              <button
                @click="handleAdd"
                :disabled="effectivePrice == null"
                :title="effectivePrice == null ? 'Este producto requiere cotización' : undefined"
                class="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-xl transition-colors text-base focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
```

`effectivePrice` is already destructured from `useProductPrice(...)` in this file's `<script setup>` — no import changes needed.

- [ ] **Step 3: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: same counts as the end of Task 1, all passing, zero typecheck errors.

Manually confirm (read-through, no automated test exists for this): a product whose `price_cop`, `price_usd`, and relevant WS tier are all `null` shows "Consultar precio" (existing behavior, untouched) AND the add-to-cart button is now visibly disabled with a tooltip, in both `ProductCard.vue` and `ProductDetailView.vue`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/catalog/components/ProductCard.vue src/modules/catalog/views/ProductDetailView.vue
git commit -m "fix: disable add-to-cart for products with no resolvable price"
```

---

## Task 3 [Controller-executed]: `orders` table + RLS

**Files:**
- Create (local mirror): `supabase/migrations/20260716_orders.sql`
- Remote: applied live to Supabase project `jcugmeuvwqjvrlrdlyyh` via `mcp__supabase__execute_sql`

**Interfaces:**
- Produces: the `orders` table with columns `id, user_id, status, items, subtotal, currency, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_notes, stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at` — Tasks 4, 5, 7, 8, 9 all read/write this table by exact column name.
- `status` check constraint values: `'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'` — Task 7's frontend `OrderStatus` TypeScript type (added in that task) must match these exactly.

- [ ] **Step 1: Confirm current backend state before adding**

Run via `mcp__supabase__list_tables` (schemas: `["public"]`) and confirm no `orders` table already exists (it shouldn't — this project's tables are currently `product_lines, brands, categories, products, user_profiles`, per the audit at the end of the prior removal plan).

- [ ] **Step 2: Apply the SQL live**

Run via `mcp__supabase__execute_sql`:

```sql
CREATE TABLE IF NOT EXISTS orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id),
  status                      TEXT NOT NULL DEFAULT 'pending_payment'
                               CHECK (status IN (
                                 'pending_payment', 'paid', 'preparing',
                                 'shipped', 'delivered', 'cancelled'
                               )),
  items                       JSONB NOT NULL,
  subtotal                    NUMERIC NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'COP',
  shipping_name               TEXT NOT NULL,
  shipping_phone              TEXT NOT NULL,
  shipping_address            TEXT NOT NULL,
  shipping_city               TEXT NOT NULL,
  shipping_notes              TEXT,
  stripe_checkout_session_id  TEXT UNIQUE,
  stripe_payment_intent_id    TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers can read own orders" ON orders
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "admins can update orders" ON orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON orders TO authenticated;
REVOKE ALL ON orders FROM anon;
```

No `INSERT` policy is created for `anon`/`authenticated` at all, and no `INSERT`/`DELETE` grant to `authenticated` — this is deliberate. Only the `create-checkout-session` Edge Function (using the `service_role` key, which bypasses RLS and table grants entirely) creates rows. Orders are never deleted; "cancelled" is a status.

- [ ] **Step 3: Verify**

Run via `mcp__supabase__list_tables` (schemas: `["public"]`, verbose: `true`) and confirm `orders` now appears with all 15 columns, `rls_enabled: true`, and the FK to `auth.users`.

Run via `mcp__supabase__get_advisors` (type: `security`) and confirm no new warning specific to the `orders` table appeared (e.g. missing RLS, which would be a real regression — the table must show as RLS-protected).

- [ ] **Step 4: Write the mirrored local migration file**

Create `supabase/migrations/20260716_orders.sql` with exactly the SQL from Step 2 (same content, for this repo's hand-maintained migration history — see the equivalent step in the prior removal plan's Task 5 for why this mirroring convention exists in this environment).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716_orders.sql
git commit -m "feat: add orders table with RLS for checkout/Stripe flow"
```

---

## Task 4 [Controller-executed]: `create-checkout-session` Edge Function

**Files:**
- Remote: deployed to Supabase project `jcugmeuvwqjvrlrdlyyh` via `mcp__supabase__deploy_edge_function`, function name `create-checkout-session`, `verify_jwt: true`

**Interfaces:**
- Consumes: the `orders` table (Task 3).
- Produces: `POST /functions/v1/create-checkout-session` — request body `{ items: [{product_id: string, quantity: number}], shipping: {name, phone, address, city, notes?} }`, response `{ url: string, dropped: string[] }` on success or `{ error: string }` on failure. Task 6's `checkout.service.ts` calls this via `supabase.functions.invoke('create-checkout-session', { body: {...} })`.
- Sets `orders.stripe_checkout_session_id` on the row it creates, which Task 5's webhook and Task 7's confirmation page both look up by.

- [ ] **Step 1: Deploy the function**

Run via `mcp__supabase__deploy_edge_function` with `name: "create-checkout-session"`, `verify_jwt: true`, `entrypoint_path: "index.ts"`, and this file content:

```ts
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BULK_THRESHOLD = 10

type Role = 'admin' | 'customer' | 'customer_ws1' | 'customer_ws3'

interface ProductRow {
  id: string
  sku: string
  name: string
  images: string[]
  price_cop: number | null
  price_usd: number | null
  price_ws1: number | null
  price_ws2: number | null
  price_ws3: number | null
  price_ws4: number | null
}

// Duplicated from src/modules/catalog/composables/useProductPrice.ts's
// resolveEffectivePrice — Deno can't import that file. Keep the tier rules
// identical if either copy changes; only the *unit price* is needed here
// (not basePrice/isDiscounted/tierLabel, which are UI-only concerns).
function resolveUnitPrice(product: ProductRow, qty: number, role: Role | null): number | null {
  const base = product.price_cop ?? product.price_usd ?? null

  if (role === 'customer_ws1') {
    const ws1 = product.price_ws1 ?? base
    const ws2 = product.price_ws2 ?? null
    return qty >= BULK_THRESHOLD ? (ws2 ?? ws1) : ws1
  }

  if (role === 'customer_ws3') {
    const ws3 = product.price_ws3 ?? base
    const ws4 = product.price_ws4 ?? null
    return qty >= BULK_THRESHOLD ? (ws4 ?? ws3) : ws3
  }

  return base
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl         = Deno.env.get('SITE_URL')
    if (!siteUrl) return json({ error: 'SITE_URL no configurado' }, 500)

    // Client scoped to the caller's JWT, used only to identify who's calling.
    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !userData.user) return json({ error: 'No autorizado' }, 401)
    const userId    = userData.user.id
    const userEmail = userData.user.email ?? undefined

    // Service-role client for trusted reads/writes (bypasses RLS).
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single()
    const role = (profile?.role ?? 'customer') as Role

    const body = await req.json().catch(() => ({}))
    const items: Array<{ product_id: string; quantity: number }> = body.items ?? []
    const shipping = body.shipping ?? {}

    if (!items.length) return json({ error: 'El carrito está vacío' }, 400)
    for (const field of ['name', 'phone', 'address', 'city'] as const) {
      if (!String(shipping[field] ?? '').trim()) {
        return json({ error: `Falta el campo de envío: ${field}` }, 400)
      }
    }

    const productIds = items.map(i => i.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, images, price_cop, price_usd, price_ws1, price_ws2, price_ws3, price_ws4')
      .in('id', productIds)
    const productById = new Map<string, ProductRow>((products ?? []).map((p: ProductRow) => [p.id, p]))

    const orderItems: Array<{
      product_id: string; sku: string; name: string; image: string | null
      unit_price: number; quantity: number; line_total: number
    }> = []
    const droppedItems: string[] = []
    const lineItems: Array<{
      price_data: { currency: string; product_data: { name: string; metadata: { sku: string } }; unit_amount: number }
      quantity: number
    }> = []

    for (const { product_id, quantity } of items) {
      const product = productById.get(product_id)
      const qty = Math.max(1, Math.floor(quantity))
      if (!product) { droppedItems.push(product_id); continue }

      const unitPriceRaw = resolveUnitPrice(product, qty, role)
      if (unitPriceRaw == null) { droppedItems.push(product.name); continue }
      const unitPrice = Math.round(unitPriceRaw)

      orderItems.push({
        product_id: product.id, sku: product.sku, name: product.name,
        image: product.images?.[0] ?? null,
        unit_price: unitPrice, quantity: qty, line_total: unitPrice * qty,
      })
      lineItems.push({
        price_data: {
          currency: 'cop',
          product_data: { name: product.name, metadata: { sku: product.sku } },
          unit_amount: unitPrice,
        },
        quantity: qty,
      })
    }

    if (!orderItems.length) {
      return json({ error: 'Ningún producto del carrito está disponible para compra', dropped: droppedItems }, 400)
    }

    const subtotal = orderItems.reduce((s, i) => s + i.line_total, 0)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        items: orderItems,
        subtotal,
        shipping_name: shipping.name,
        shipping_phone: shipping.phone,
        shipping_address: shipping.address,
        shipping_city: shipping.city,
        shipping_notes: shipping.notes ?? null,
      })
      .select('id')
      .single()
    if (orderError || !order) return json({ error: orderError?.message ?? 'No se pudo crear la orden' }, 500)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: userEmail,
      metadata: { order_id: order.id },
      success_url: `${siteUrl}/pedido-confirmado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout`,
    })

    await supabase
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id)

    return json({ url: session.url, dropped: droppedItems })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
```

> **Correction applied after this task's review (deployed as version 2, superseding the code above):** the code block above states COP is zero-decimal in Stripe and sends `unit_amount: unitPrice`. This was independently verified as **wrong** against Stripe's own currency docs during review — COP is a standard 2-decimal currency, same as USD. The deployed line was corrected to `unit_amount: unitPrice * 100` (a `COP_MINOR_UNIT_MULTIPLIER` constant), or every real charge would have been 1% of the intended price. Three further Minor polish items from the same review were folded into the same redeploy: the `SITE_URL` env-check now runs after `getUser()` (so an unauthenticated caller can't probe deployment config), `quantity` is guarded against `NaN`/non-finite input before use, and the `dropped[]` array entries are now self-describing Spanish strings (`"Producto no encontrado: <id>"` / `"<name>: sin precio disponible"`) instead of a bare id/name mix. See the live deployed function (`mcp__supabase__get_edge_function` with `function_slug: "create-checkout-session"`) for the authoritative current source — do not redeploy from the block above as-is.

- [ ] **Step 2: Verify deployment**

Run via `mcp__supabase__list_edge_functions` and confirm `create-checkout-session` appears with `status: "ACTIVE"` and `verify_jwt: true`.

Run via `mcp__supabase__get_edge_function` with `function_slug: "create-checkout-session"` and confirm the returned file content matches Step 1 exactly (catches upload corruption/truncation).

- [ ] **Step 3: Check for the required secrets and flag the gap if missing**

Re-check whether any Supabase MCP tool in the currently loaded toolset can set Edge Function secrets (search the tool catalog again — this may have changed since the design phase). If one exists, use it to set `STRIPE_SECRET_KEY` and `SITE_URL` (ask the user for the actual Stripe secret key value and the production site URL — never invent placeholder values for real secrets). If no such tool exists, clearly tell the user: this function is deployed but will return errors on every call until `STRIPE_SECRET_KEY` and `SITE_URL` are set as Edge Function secrets, and that this requires the Supabase Dashboard (Edge Functions → Secrets) or the Supabase CLI (`supabase secrets set`), neither of which is available to automate from this environment.

- [ ] **Step 4: Commit**

No local files changed by this task (the function source lives only in Supabase, deployed directly) — nothing to commit. Note the deployed function slug and status in the task report instead.

---

## Task 5 [Controller-executed]: `stripe-webhook` Edge Function

**Files:**
- Remote: deployed to Supabase project `jcugmeuvwqjvrlrdlyyh` via `mcp__supabase__deploy_edge_function`, function name `stripe-webhook`, `verify_jwt: false`

**Interfaces:**
- Consumes: the `orders` table (Task 3), specifically rows created by Task 4 with `stripe_checkout_session_id` set and `status = 'pending_payment'`.
- Produces: on `checkout.session.completed`, updates the matching order to `status = 'paid'`, `paid_at = now()`, `stripe_payment_intent_id = <payment intent id>`. Task 7's confirmation page and Task 8/9's order lists all depend on this transition having happened.

- [ ] **Step 1: Deploy the function**

Run via `mcp__supabase__deploy_edge_function` with `name: "stripe-webhook"`, `verify_jwt: false` (Stripe calls this directly with no Supabase user JWT — authenticity comes from the signature check below, not `verify_jwt`), `entrypoint_path: "index.ts"`, and this file content:

```ts
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// Required to use the Web Crypto API for signature verification in Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // Must use .text() — verification relies on the raw body, not parsed JSON.
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id

    if (orderId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      // .eq('status', 'pending_payment') makes this idempotent: a redelivered
      // event matches zero rows the second time and is a harmless no-op.
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        .eq('id', orderId)
        .eq('status', 'pending_payment')
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Verify deployment**

Run via `mcp__supabase__list_edge_functions` and confirm `stripe-webhook` appears with `status: "ACTIVE"` and `verify_jwt: false`.

Run via `mcp__supabase__get_edge_function` with `function_slug: "stripe-webhook"` and confirm the returned file content matches Step 1 exactly.

- [ ] **Step 3: Flag remaining manual configuration**

Same secrets gap as Task 4 for `STRIPE_SECRET_KEY` (shared) plus this function's own `STRIPE_WEBHOOK_SECRET`. Additionally, this function's URL (`https://jcugmeuvwqjvrlrdlyyh.supabase.co/functions/v1/stripe-webhook`) must be registered as a webhook endpoint in the Stripe Dashboard (Developers → Webhooks → Add endpoint), subscribed to at least the `checkout.session.completed` event — this registration step itself is only possible from the Stripe Dashboard, no API/tool in this environment can do it. Tell the user this explicitly, the same way the `sync-sheets` function's pending manual deletion was flagged in the prior plan.

- [ ] **Step 4: Commit**

No local files changed by this task — nothing to commit. Note the deployed function slug/status in the task report.

---

## Task 6: `/checkout` page (replaces the placeholder)

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/modules/cart/services/checkout.service.ts`
- Create: `src/modules/cart/views/CheckoutView.vue`

**Interfaces:**
- Consumes: `cart.store.ts`'s `items`, `subtotal`, `lineUnitPrice` (Task 1); the `create-checkout-session` Edge Function (Task 4).
- Produces: the `meta: { requiresUser: true }` route flag and its `router.beforeEach` guard branch — Tasks 7 and 8's routes reuse this same flag without needing to touch the guard again.

- [ ] **Step 1: Create the checkout service**

Create `src/modules/cart/services/checkout.service.ts`:

```ts
import { supabase } from '@/core/supabase/client'
import type { CartItem } from '@/shared/types'

export type ShippingInfo = {
  name: string
  phone: string
  address: string
  city: string
  notes?: string
}

export async function createCheckoutSession(
  items: CartItem[],
  shipping: ShippingInfo,
): Promise<{ url: string }> {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      shipping,
    },
  })
  if (error) throw new Error(error.message)
  if (!data?.url) throw new Error(data?.error ?? 'No se pudo iniciar el pago')
  return data
}
```

- [ ] **Step 2: Create the checkout view**

Create `src/modules/cart/views/CheckoutView.vue`:

```vue
<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6">
      <RouterLink to="/" class="hover:text-brand-600">Inicio</RouterLink>
      <ChevronRight class="h-3 w-3" />
      <RouterLink to="/cart" class="hover:text-brand-600">Carrito</RouterLink>
      <ChevronRight class="h-3 w-3" />
      <span class="text-slate-700 font-medium">Checkout</span>
    </nav>

    <h1 class="text-2xl font-bold text-slate-900 mb-8">Finalizar compra</h1>

    <div v-if="!cart.items.length" class="text-center py-20">
      <p class="text-slate-400 mb-4">Tu carrito está vacío.</p>
      <RouterLink to="/catalog" class="text-brand-700 font-semibold hover:text-brand-800">Ver catálogo</RouterLink>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 class="font-bold text-slate-900 text-lg mb-5">Dirección de envío</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="field-label">Nombre completo *</label>
            <input v-model="form.name" type="text" class="field-input" placeholder="Nombre y apellido" />
          </div>
          <div>
            <label class="field-label">Teléfono *</label>
            <input v-model="form.phone" type="tel" class="field-input" placeholder="+57 300 000 0000" />
          </div>
          <div>
            <label class="field-label">Ciudad *</label>
            <input v-model="form.city" type="text" class="field-input" placeholder="Bogotá" />
          </div>
          <div class="col-span-2">
            <label class="field-label">Dirección *</label>
            <input v-model="form.address" type="text" class="field-input" placeholder="Calle 00 # 00-00" />
          </div>
          <div class="col-span-2">
            <label class="field-label">Notas (opcional)</label>
            <textarea v-model="form.notes" rows="2" class="field-input resize-none" placeholder="Referencias adicionales…" />
          </div>
        </div>
        <p v-if="formError" class="text-xs text-red-500 mt-4">{{ formError }}</p>
      </div>

      <div class="lg:col-span-1">
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-32">
          <h2 class="font-bold text-slate-900 text-lg mb-5">Resumen del pedido</h2>
          <div class="space-y-3 mb-5 pb-5 border-b border-slate-100">
            <div v-for="item in cart.items" :key="item.product.id" class="flex justify-between text-sm text-slate-600">
              <span class="truncate max-w-[160px]">{{ item.product.name }} <span class="text-slate-400">×{{ item.quantity }}</span></span>
              <span class="font-medium flex-shrink-0">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</span>
            </div>
          </div>
          <div class="flex justify-between items-center font-extrabold text-slate-900 text-xl pt-1 mb-6">
            <span>Total</span>
            <span>{{ formatCurrency(cart.subtotal) }}</span>
          </div>
          <button
            @click="handlePay"
            :disabled="paying"
            class="w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            <Loader2 v-if="paying" class="h-4 w-4 animate-spin" />
            {{ paying ? 'Redirigiendo a Stripe…' : 'Pagar con Stripe →' }}
          </button>
          <p class="text-xs text-slate-400 text-center mt-3">Envío por cotizar, te contactaremos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ChevronRight, Loader2 } from '@lucide/vue'
import { useCartStore } from '../stores/cart.store'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { formatCurrency } from '@/shared/utils/currency'
import { createCheckoutSession } from '../services/checkout.service'

const cart = useCartStore()
const auth = useAuthStore()

const form = reactive({ name: '', phone: '', address: '', city: '', notes: '' })
const paying    = ref(false)
const formError = ref('')

onMounted(() => {
  if (auth.profile) {
    form.name  = auth.profile.full_name ?? ''
    form.phone = auth.profile.phone ?? ''
  }
})

async function handlePay() {
  formError.value = ''
  if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim()) {
    formError.value = 'Completa todos los campos obligatorios de envío.'
    return
  }
  paying.value = true
  try {
    const { url } = await createCheckoutSession(cart.items, {
      name: form.name, phone: form.phone, address: form.address,
      city: form.city, notes: form.notes || undefined,
    })
    window.location.href = url
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Error al iniciar el pago'
    paying.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";

.field-label {
  @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5;
}
.field-input {
  @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-300
         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all;
}
</style>
```

Login is not checked inside this component — the router guard (Step 3 below) blocks navigation to this route entirely when unauthenticated, so this component only ever mounts for a logged-in user, matching how `/admin` routes already rely solely on the router guard rather than duplicating the check in each view.

- [ ] **Step 3: Wire the route and reintroduce the `requiresUser` guard**

Read `src/router/index.ts` first. Change:
```ts
        { path: 'checkout',        name: 'checkout',       component: () => import('@/modules/cart/views/CartView.vue') },
```
to:
```ts
        { path: 'checkout',        name: 'checkout',       component: () => import('@/modules/cart/views/CheckoutView.vue'), meta: { requiresUser: true } },
```

Then, inside `router.beforeEach`, add a new branch. Change:
```ts
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
    if (!authStore.isAdmin) return { name: 'landing' }
  }

  return true
```
to:
```ts
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
    if (!authStore.isAdmin) return { name: 'landing' }
  }

  if (to.meta.requiresUser) {
    if (!authStore.isAuthenticated) {
      const { open } = useAuthModal()
      open('login')
      return false
    }
  }

  return true
```

This is the exact same flag name and guard branch a prior cleanup pass on this codebase removed as dead code (nothing set it at the time). This route is its first real consumer, so it's reintroduced verbatim rather than invented anew — Tasks 7 and 8 add more routes using the same `meta: { requiresUser: true }` flag without touching this guard branch again.

- [ ] **Step 4: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: same test counts as end of Task 2, all passing, zero typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts src/modules/cart/services/checkout.service.ts src/modules/cart/views/CheckoutView.vue
git commit -m "feat: add /checkout page wired to Stripe Checkout"
```

---

## Task 7: Order type, `/pedido-confirmado` confirmation page

**Files:**
- Modify: `src/shared/types/index.ts`
- Modify: `src/router/index.ts`
- Create: `src/shared/components/ui/OrderStatusBadge.vue`
- Create: `src/modules/orders/services/orders.service.ts`
- Create: `src/modules/orders/views/OrderConfirmationView.vue`

**Interfaces:**
- Produces: `OrderStatus`, `OrderItemSnapshot`, `Order` types in `src/shared/types/index.ts`, replacing the stale placeholder `Order` interface that predates this feature. Tasks 8 and 9 both import these types.
- Produces: `fetchOrderBySessionId(sessionId: string): Promise<Order | null>` in `orders.service.ts` — Task 8 adds two more functions to this same file.
- Produces: `<OrderStatusBadge :status="order.status" />` component — reused by Tasks 8 and 9.
- Consumes: the `orders` table (Task 3), `cart.store.ts`'s `clearCart()` (Task 1, unchanged).

- [ ] **Step 1: Replace the stale `Order` type**

Read `src/shared/types/index.ts` first. Replace this block (the file's final interface):
```ts
export interface Order {
  id: string
  userId?: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  items: CartItem[]
  total: number
  createdAt: Date
}
```
with:
```ts
export type OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderItemSnapshot {
  product_id: string
  sku: string
  name: string
  image: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  items: OrderItemSnapshot[]
  subtotal: number
  currency: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_city: string
  shipping_notes: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  paid_at: string | null
}
```

This old placeholder type was never used anywhere in the codebase (verify with `grep -rn "\bOrder\b" src/ --include=*.ts --include=*.vue` before this change — every hit should be this type's own declaration or unrelated words like "ordered"), so no other file needs updating for this step alone.

- [ ] **Step 2: Create the shared status badge**

Create `src/shared/components/ui/OrderStatusBadge.vue`:

```vue
<template>
  <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full', classes]">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@/shared/types'

const props = defineProps<{ status: OrderStatus }>()

const LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pendiente de pago',
  paid:            'Pagado',
  preparing:       'Preparando',
  shipped:         'Enviado',
  delivered:       'Entregado',
  cancelled:       'Cancelado',
}

const CLASSES: Record<OrderStatus, string> = {
  pending_payment: 'bg-slate-100 text-slate-500',
  paid:            'bg-blue-50 text-blue-700',
  preparing:       'bg-amber-50 text-amber-700',
  shipped:         'bg-teal-50 text-teal-700',
  delivered:       'bg-emerald-50 text-emerald-700',
  cancelled:       'bg-red-50 text-red-600',
}

const label   = computed(() => LABELS[props.status])
const classes = computed(() => CLASSES[props.status])
</script>
```

- [ ] **Step 3: Create the orders service (first function)**

Create `src/modules/orders/services/orders.service.ts`:

```ts
import { supabase } from '@/core/supabase/client'
import type { Order } from '@/shared/types'

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function fetchOrderBySessionId(sessionId: string): Promise<Order | null> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Order | null
}
```

- [ ] **Step 4: Create the confirmation view**

Create `src/modules/orders/views/OrderConfirmationView.vue`:

```vue
<template>
  <div class="max-w-2xl mx-auto px-4 py-16 text-center">
    <div v-if="loading" class="py-20">
      <AppSpinner size="lg" class="text-brand-600 mx-auto mb-4" />
      <p class="text-slate-500">Confirmando tu pago…</p>
    </div>

    <div v-else-if="order">
      <div class="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Check class="h-8 w-8 text-emerald-600" />
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-2">¡Gracias por tu compra!</h1>
      <p v-if="order.status === 'pending_payment'" class="text-slate-500 mb-8">
        Tu pago está siendo procesado. Te notificaremos apenas se confirme.
      </p>
      <p v-else class="text-slate-500 mb-8">
        Pedido confirmado. Puedes ver el detalle en tus pedidos.
      </p>

      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left mb-8">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-slate-500">Total</span>
          <span class="font-extrabold text-slate-900 text-lg">{{ formatCurrency(order.subtotal) }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="item in order.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
            <span>{{ item.name }} ×{{ item.quantity }}</span>
            <span>{{ formatCurrency(item.line_total) }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-4">
        <RouterLink to="/orders" class="bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          Ver mis pedidos
        </RouterLink>
        <RouterLink to="/catalog" class="text-brand-700 hover:text-brand-800 font-medium">
          Seguir comprando
        </RouterLink>
      </div>
    </div>

    <div v-else class="py-20">
      <p class="text-slate-500 mb-4">No encontramos información de este pedido.</p>
      <RouterLink to="/catalog" class="text-brand-700 font-semibold hover:text-brand-800">Ver catálogo</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Check } from '@lucide/vue'
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import { fetchOrderBySessionId } from '../services/orders.service'
import { formatCurrency } from '@/shared/utils/currency'
import type { Order } from '@/shared/types'
import { useCartStore } from '@/modules/cart/stores/cart.store'

const route   = useRoute()
const order   = ref<Order | null>(null)
const loading = ref(true)

const MAX_POLLS      = 5
const POLL_INTERVAL  = 2000
let pollTimer: ReturnType<typeof setTimeout> | null = null
let polls = 0

async function poll() {
  const sessionId = route.query.session_id as string | undefined
  if (!sessionId) { loading.value = false; return }
  try {
    const result = await fetchOrderBySessionId(sessionId)
    order.value = result
    if (result && result.status !== 'pending_payment') {
      loading.value = false
      useCartStore().clearCart()
      return
    }
    polls++
    if (polls >= MAX_POLLS) { loading.value = false; return }
    pollTimer = setTimeout(poll, POLL_INTERVAL)
  } catch {
    loading.value = false
  }
}

onMounted(poll)
onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>
```

The cart only clears once the order is confirmed `paid` (not merely created) — if the customer cancels on Stripe's page and returns via `cancel_url`, they land back on `/checkout` with the cart untouched, exactly as designed.

- [ ] **Step 5: Wire the route**

Read `src/router/index.ts` first (state from the end of Task 6). Add this line to the `/` route's `children` array, after `checkout`:
```ts
        { path: 'pedido-confirmado', name: 'order-confirmation', component: () => import('@/modules/orders/views/OrderConfirmationView.vue'), meta: { requiresUser: true } },
```

- [ ] **Step 6: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: same test counts as end of Task 6 (this task adds no tests — the polling/DOM logic in `OrderConfirmationView.vue` is template-driven UI, consistent with this codebase's testing convention), zero typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/index.ts src/shared/components/ui/OrderStatusBadge.vue src/modules/orders/services/orders.service.ts src/modules/orders/views/OrderConfirmationView.vue src/router/index.ts
git commit -m "feat: add order confirmation page and Order data types"
```

---

## Task 8: `/orders` — "Mis pedidos" (customer order history)

**Files:**
- Modify: `src/modules/orders/services/orders.service.ts`
- Modify: `src/router/index.ts`
- Modify: `src/modules/auth/components/ProfileDropdown.vue`
- Create: `src/modules/orders/views/OrdersView.vue`
- Create: `src/modules/orders/views/OrderDetailView.vue`

**Interfaces:**
- Consumes: `Order`/`OrderStatus` types and `OrderStatusBadge.vue` (Task 7).
- Produces: `listMyOrders()` and `fetchOrderById(id)` added to `orders.service.ts`, alongside Task 7's `fetchOrderBySessionId`.

- [ ] **Step 1: Add the remaining orders-service functions**

Read `src/modules/orders/services/orders.service.ts` first (state from Task 7). Append these two functions after `fetchOrderBySessionId`:

```ts
export async function listMyOrders(): Promise<Order[]> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Order | null
}
```

`listMyOrders` excludes `pending_payment` rows (abandoned/never-completed checkouts) so the customer never sees a confusing orphaned entry for a payment they didn't finish. RLS (`user_id = auth.uid() OR is_admin()`) already restricts both functions to the caller's own orders — no client-side `user_id` filter is added, matching how `listAdminProducts` and other services in this codebase rely on RLS rather than duplicating the filter.

- [ ] **Step 2: Create the orders list view**

Create `src/modules/orders/views/OrdersView.vue`:

```vue
<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-8">Mis pedidos</h1>

    <div v-if="loading" class="py-20 text-center">
      <AppSpinner size="lg" class="text-brand-600 mx-auto" />
    </div>

    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="load" class="text-xs text-brand-600 underline hover:text-brand-700">Reintentar</button>
    </div>

    <div v-else-if="!orders.length" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
        <PackageSearch class="h-10 w-10 text-slate-300" />
      </div>
      <h2 class="text-xl font-bold text-slate-700 mb-2">Aún no tienes pedidos</h2>
      <p class="text-slate-400 mb-8">Explora nuestro catálogo y realiza tu primera compra</p>
      <RouterLink to="/catalog" class="bg-brand-700 hover:bg-brand-800 text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
        Ver catálogo
      </RouterLink>
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="order in orders"
        :key="order.id"
        :to="`/orders/${order.id}`"
        class="block bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-brand-200 transition-colors"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-slate-900">Pedido del {{ formatDate(order.created_at) }}</span>
          <OrderStatusBadge :status="order.status" />
        </div>
        <div class="flex items-center justify-between text-sm text-slate-500">
          <span>{{ order.items.length }} producto{{ order.items.length === 1 ? '' : 's' }}</span>
          <span class="font-bold text-slate-900">{{ formatCurrency(order.subtotal) }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PackageSearch } from '@lucide/vue'
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
import { listMyOrders } from '../services/orders.service'
import { formatCurrency } from '@/shared/utils/currency'
import type { Order } from '@/shared/types'

const orders    = ref<Order[]>([])
const loading   = ref(true)
const loadError = ref<string | null>(null)

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    orders.value = await listMyOrders()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>
```

- [ ] **Step 3: Create the order detail view**

Create `src/modules/orders/views/OrderDetailView.vue`:

```vue
<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <RouterLink to="/orders" class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 mb-6">
      <ArrowLeft class="h-4 w-4" /> Volver a mis pedidos
    </RouterLink>

    <div v-if="loading" class="py-20 text-center">
      <AppSpinner size="lg" class="text-brand-600 mx-auto" />
    </div>

    <div v-else-if="!order" class="text-center py-20">
      <p class="text-slate-500">No encontramos este pedido.</p>
    </div>

    <div v-else class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-slate-900">Pedido del {{ formatDate(order.created_at) }}</h1>
          <p class="text-xs text-slate-400 font-mono mt-0.5">{{ order.id }}</p>
        </div>
        <OrderStatusBadge :status="order.status" />
      </div>

      <div class="space-y-2 mb-6 pb-6 border-b border-slate-100">
        <div v-for="item in order.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
          <span>{{ item.name }} <span class="text-slate-400">×{{ item.quantity }}</span></span>
          <span class="font-medium">{{ formatCurrency(item.line_total) }}</span>
        </div>
      </div>

      <div class="flex justify-between items-center font-extrabold text-slate-900 text-lg mb-6">
        <span>Total</span>
        <span>{{ formatCurrency(order.subtotal) }}</span>
      </div>

      <div class="text-sm text-slate-600 space-y-1">
        <p class="font-semibold text-slate-900 mb-1">Envío</p>
        <p>{{ order.shipping_name }} · {{ order.shipping_phone }}</p>
        <p>{{ order.shipping_address }}, {{ order.shipping_city }}</p>
        <p v-if="order.shipping_notes" class="text-slate-400">{{ order.shipping_notes }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
import { fetchOrderById } from '../services/orders.service'
import { formatCurrency } from '@/shared/utils/currency'
import type { Order } from '@/shared/types'

const route   = useRoute()
const order   = ref<Order | null>(null)
const loading = ref(true)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(async () => {
  try {
    order.value = await fetchOrderById(route.params.id as string)
  } finally {
    loading.value = false
  }
})
</script>
```

- [ ] **Step 4: Wire the routes**

Read `src/router/index.ts` first (state from the end of Task 7). Add these two lines to the `/` route's `children` array, after `pedido-confirmado`:
```ts
        { path: 'orders',            name: 'orders',            component: () => import('@/modules/orders/views/OrdersView.vue'), meta: { requiresUser: true } },
        { path: 'orders/:id',        name: 'order-detail',      component: () => import('@/modules/orders/views/OrderDetailView.vue'), meta: { requiresUser: true } },
```

- [ ] **Step 5: Add "Mis pedidos" to `ProfileDropdown.vue`**

Read `src/modules/auth/components/ProfileDropdown.vue` first (state from the earlier removal-plan cleanup, which removed `useRouter`/`router` as dead code — this task is their first real consumer again, reintroduced verbatim for the same reason Task 6 reintroduced `requiresUser`).

Change:
```ts
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Pencil, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore = useAuthStore()
const { open }  = useAuthModal()
```
to:
```ts
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, LogOut, Package } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore = useAuthStore()
const { open }  = useAuthModal()
const router    = useRouter()
```

Add this function near `onEditProfile`:
```ts
function onOrders() {
  isOpen.value = false
  router.push('/orders')
}
```

In the template, add a new menu item before the existing "Editar perfil" button:
```html
          <button class="dropdown-item" @click="onOrders">
            <Package class="h-3.5 w-3.5 flex-shrink-0" />
            Mis pedidos
          </button>
          <button class="dropdown-item" @click="onEditProfile">
```

- [ ] **Step 6: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: same test counts as end of Task 7 (no new tests — list/detail views are template-driven UI), zero typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/orders/services/orders.service.ts src/router/index.ts src/modules/auth/components/ProfileDropdown.vue src/modules/orders/views/OrdersView.vue src/modules/orders/views/OrderDetailView.vue
git commit -m "feat: add /orders 'Mis pedidos' customer order history"
```

---

## Task 9: `/admin/sales` — "Ventas" (admin order management)

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/modules/admin/layouts/AdminLayout.vue`
- Create: `src/modules/admin/services/sales.service.ts`
- Create: `src/modules/admin/views/AdminSalesView.vue`

**Interfaces:**
- Consumes: `Order`/`OrderStatus` types and `OrderStatusBadge.vue` (Task 7).
- Follows the exact list + slide-over-panel structure of `src/modules/admin/views/AdminCustomersView.vue` (read that file for the concrete pattern being mirrored, per Global Constraints).

- [ ] **Step 1: Create the admin sales service**

Create `src/modules/admin/services/sales.service.ts`:

```ts
import { supabase } from '@/core/supabase/client'
import type { Order, OrderStatus } from '@/shared/types'

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function listAllOrders(): Promise<Order[]> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await getSb().from('orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}
```

`listAllOrders` intentionally does not filter out `pending_payment` at the query level (unlike the customer-facing `listMyOrders` in Task 8) — the view itself filters them out for the default display (Step 3 below), keeping the raw fetch simple and RLS (`is_admin()`) already restricts this to admins only.

- [ ] **Step 2: Create the admin sales view**

Create `src/modules/admin/views/AdminSalesView.vue`:

```vue
<template>
  <div class="p-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Ventas</h1>
      <p class="text-sm text-slate-500 mt-0.5">{{ filtered.length }} pedidos</p>
    </div>

    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          v-model="searchQuery"
          placeholder="Buscar por cliente o teléfono..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>
      <div class="flex flex-wrap gap-1.5" role="list" aria-label="Filtrar por estado">
        <button
          v-for="f in statusFilters"
          :key="f.value"
          @click="activeStatus = f.value"
          :aria-pressed="activeStatus === f.value"
          :class="[
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            activeStatus === f.value
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700',
          ]"
        >
          {{ f.label }}
          <span class="ml-1 font-normal opacity-60">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <AppSpinner size="lg" class="text-brand-600" />
    </div>

    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="loadOrders" class="text-xs text-brand-600 underline hover:text-brand-700">Reintentar</button>
    </div>

    <div v-else class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Cliente</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Fecha</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden md:table-cell">Items</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Total</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Estado</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr
            v-for="o in filtered"
            :key="o.id"
            @click="openPanel(o)"
            class="hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <td class="px-5 py-3.5">
              <p class="font-semibold text-slate-900">{{ o.shipping_name }}</p>
              <p class="text-xs text-slate-400">{{ o.shipping_phone }}</p>
            </td>
            <td class="px-5 py-3.5 text-slate-600 text-sm">{{ formatDate(o.created_at) }}</td>
            <td class="px-5 py-3.5 text-slate-600 text-sm hidden md:table-cell">{{ o.items.length }}</td>
            <td class="px-5 py-3.5 font-bold text-slate-900">{{ formatCurrency(o.subtotal) }}</td>
            <td class="px-5 py-3.5"><OrderStatusBadge :status="o.status" /></td>
            <td class="px-5 py-3.5"><ChevronRight class="h-4 w-4 text-slate-300" /></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length && !loading" class="py-16 text-center text-slate-400 text-sm">
        No se encontraron pedidos
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selected" class="fixed inset-0 bg-black/30 z-50" @click="closePanel" aria-hidden="true" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="selected"
          role="dialog"
          aria-modal="true"
          class="fixed top-0 right-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col"
        >
          <div class="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
            <div>
              <p class="font-bold text-slate-900">{{ selected.shipping_name }}</p>
              <p class="text-xs text-slate-400 font-mono">{{ selected.id }}</p>
            </div>
            <button @click="closePanel" aria-label="Cerrar panel" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <div class="space-y-2 pb-5 border-b border-slate-100">
              <div v-for="item in selected.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
                <span>{{ item.name }} ×{{ item.quantity }}</span>
                <span class="font-medium">{{ formatCurrency(item.line_total) }}</span>
              </div>
              <div class="flex justify-between font-bold text-slate-900 pt-2">
                <span>Total</span>
                <span>{{ formatCurrency(selected.subtotal) }}</span>
              </div>
            </div>

            <dl class="space-y-2 text-sm">
              <div>
                <dt class="text-slate-400 text-xs">Envío</dt>
                <dd class="font-medium text-slate-900">{{ selected.shipping_address }}, {{ selected.shipping_city }}</dd>
              </div>
              <div v-if="selected.shipping_notes">
                <dt class="text-slate-400 text-xs">Notas</dt>
                <dd class="text-slate-700">{{ selected.shipping_notes }}</dd>
              </div>
              <div>
                <dt class="text-slate-400 text-xs">Teléfono</dt>
                <dd class="text-slate-900">{{ selected.shipping_phone }}</dd>
              </div>
              <div v-if="selected.stripe_payment_intent_id">
                <dt class="text-slate-400 text-xs">Stripe</dt>
                <dd class="font-mono text-xs text-slate-500">{{ selected.stripe_payment_intent_id }}</dd>
              </div>
            </dl>

            <div class="border-t border-slate-100 pt-5">
              <label for="panel-status" class="block text-xs font-semibold text-slate-500 mb-1.5">Estado</label>
              <select
                id="panel-status"
                v-model="panelStatus"
                class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="paid">Pagado</option>
                <option value="preparing">Preparando</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div class="p-6 border-t border-slate-100 flex-shrink-0">
            <p v-if="saveError" class="text-xs text-red-500 mb-3">{{ saveError }}</p>
            <button
              @click="saveStatus"
              :disabled="saving || panelStatus === selected.status"
              class="w-full bg-brand-700 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Guardando...' : 'Actualizar estado' }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, ChevronRight, X } from '@lucide/vue'
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import OrderStatusBadge from '@/shared/components/ui/OrderStatusBadge.vue'
import { listAllOrders, updateOrderStatus } from '../services/sales.service'
import { formatCurrency } from '@/shared/utils/currency'
import type { Order, OrderStatus } from '@/shared/types'

const orders       = ref<Order[]>([])
const loading      = ref(true)
const loadError    = ref<string | null>(null)
const searchQuery  = ref('')
const activeStatus = ref<OrderStatus | 'all'>('all')

const selected    = ref<Order | null>(null)
const panelStatus = ref<OrderStatus>('paid')
const saving      = ref(false)
const saveError   = ref<string | null>(null)

const VISIBLE_STATUSES: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered', 'cancelled']

const statusFilters = computed(() => {
  const visible = orders.value.filter(o => VISIBLE_STATUSES.includes(o.status))
  const count = (s: OrderStatus) => visible.filter(o => o.status === s).length
  return [
    { value: 'all'       as const, label: 'Todas',      count: visible.length },
    { value: 'paid'      as const, label: 'Pagado',     count: count('paid') },
    { value: 'preparing' as const, label: 'Preparando', count: count('preparing') },
    { value: 'shipped'   as const, label: 'Enviado',    count: count('shipped') },
    { value: 'delivered' as const, label: 'Entregado',  count: count('delivered') },
    { value: 'cancelled' as const, label: 'Cancelado',  count: count('cancelled') },
  ]
})

const filtered = computed(() => {
  let list = orders.value.filter(o => VISIBLE_STATUSES.includes(o.status))
  if (activeStatus.value !== 'all') {
    list = list.filter(o => o.status === activeStatus.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(o =>
      o.shipping_name.toLowerCase().includes(q) ||
      o.shipping_phone.toLowerCase().includes(q)
    )
  }
  return list
})

async function loadOrders() {
  loading.value   = true
  loadError.value = null
  try {
    orders.value = await listAllOrders()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openPanel(o: Order) {
  selected.value    = o
  panelStatus.value = o.status
  saveError.value   = null
}

function closePanel() {
  selected.value = null
}

async function saveStatus() {
  if (!selected.value) return
  saving.value    = true
  saveError.value = null
  try {
    await updateOrderStatus(selected.value.id, panelStatus.value)
    const idx = orders.value.findIndex(o => o.id === selected.value!.id)
    if (idx !== -1) orders.value[idx] = { ...orders.value[idx], status: panelStatus.value }
    closePanel()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(loadOrders)
</script>
```

No `<style>` block is needed — `fade`/`slide-right` transitions come from the global `src/style.css` definitions (see Global Constraints).

- [ ] **Step 3: Wire the route**

Read `src/router/index.ts` first (state from the end of Task 8). Add this line to the `/admin` route's `children` array, after `customers`:
```ts
        { path: 'sales',             name: 'admin-sales',       component: () => import('@/modules/admin/views/AdminSalesView.vue') },
```

No `meta` needed here beyond what the parent `/admin` route already sets (`meta: { requiresAuth: true }`, which enforces `isAdmin`) — same as every other admin child route.

- [ ] **Step 4: Add the sidebar item**

Read `src/modules/admin/layouts/AdminLayout.vue` first (state from the removal-plan cleanup — currently `Package, Layers, Users, ExternalLink` icons, 3 nav items).

Change:
```ts
import { Package, Layers, Users, ExternalLink } from '@lucide/vue'
```
to:
```ts
import { Package, Layers, Users, ExternalLink, ShoppingBag } from '@lucide/vue'
```

Change:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
]
```
to:
```ts
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package     },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers      },
  { to: '/admin/customers', label: 'Clientes',  icon: Users       },
  { to: '/admin/sales',     label: 'Ventas',    icon: ShoppingBag },
]
```

- [ ] **Step 5: Verify**

```bash
npm run test -- --run
npx vue-tsc --noEmit -p tsconfig.json
```
Expected: same test counts as end of Task 8 (no new tests — matches `AdminCustomersView.vue`'s own untested-template precedent), zero typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add src/router/index.ts src/modules/admin/layouts/AdminLayout.vue src/modules/admin/services/sales.service.ts src/modules/admin/views/AdminSalesView.vue
git commit -m "feat: add /admin/sales 'Ventas' order management view"
```
