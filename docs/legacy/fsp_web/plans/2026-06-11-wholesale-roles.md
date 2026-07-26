# Wholesale Pricing Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `customer_ws1` and `customer_ws3` roles with quantity-based wholesale pricing, fix RLS security gaps, and build an admin customer management view at `/admin/customers`.

**Architecture:** A pure-computed composable (`useProductPrice`) reads the auth store role + reactive qty and returns price display values; ProductCard and ProductDetailView consume it. A new `customers.service.ts` + `AdminCustomersView.vue` provide the admin UI, protected by existing `is_admin()` RLS policies.

**Tech Stack:** Vue 3 Composition API, Pinia, Supabase (Postgres + RLS), TypeScript, Tailwind CSS v4, Vitest + @vue/test-utils, Lucide Vue icons.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `supabase/schema.sql` | Keep local schema in sync with migration |
| Modify | `src/shared/types/index.ts` | `UserRole` + `notes` on `UserProfile` |
| **Create** | `src/modules/catalog/composables/useProductPrice.ts` | Price resolution by role + qty |
| **Create** | `src/modules/catalog/composables/__tests__/useProductPrice.test.ts` | Unit tests for composable |
| Modify | `src/modules/catalog/components/ProductCard.vue` | WS price display |
| Modify | `src/modules/catalog/views/ProductDetailView.vue` | WS price display (reactive qty) |
| **Create** | `src/modules/admin/services/customers.service.ts` | Admin CRUD for user profiles |
| **Create** | `src/modules/admin/views/AdminCustomersView.vue` | Customer list + role assignment |
| Modify | `src/router/index.ts` | Add `/admin/customers` route |
| Modify | `src/modules/admin/layouts/AdminLayout.vue` | Add Clientes nav item |

---

## Task 1: DB Migration

**Files:**
- Modify: `supabase/schema.sql` (local reference only — migration goes to live DB)

- [ ] **Step 1: Apply the migration via Supabase MCP `execute_sql` (or Supabase Dashboard → SQL Editor)**

Run this SQL in a single statement block:

```sql
-- 1. Extend role constraint
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'customer', 'customer_ws1', 'customer_ws3'));

-- 2. Add internal notes column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Admin can now read all profiles
DROP POLICY IF EXISTS "own_profile_select" ON user_profiles;
CREATE POLICY "own_profile_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

-- 4a. Non-admin: can edit own profile but NOT the role field
DROP POLICY IF EXISTS "own_profile_update" ON user_profiles;
CREATE POLICY "own_profile_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT is_admin())
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT up.role FROM user_profiles up WHERE up.id = auth.uid())
  );

-- 4b. Admin: can update any profile including role
CREATE POLICY "admin_profile_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

Expected: no errors. If "policy does not exist" error on the DROP, that's fine — it means the policy name differs slightly. Verify the exact name with `SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles';` and adjust the DROP accordingly.

- [ ] **Step 2: Verify migration**

Run:
```sql
-- Should show 4 allowed roles
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass AND contype = 'c';

-- Should show notes column
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'notes';

-- Should show 5 policies on user_profiles
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
```

Expected:
- Constraint definition contains `'customer_ws1'` and `'customer_ws3'`
- `notes` column exists
- 5 policies: `own_profile_select`, `own_profile_insert`, `own_profile_update`, `admin_profile_update`, and (from a prior migration) any favorites-related policy if present

- [ ] **Step 3: Update local `supabase/schema.sql` to reflect migration**

In `supabase/schema.sql`, find the `user_profiles` table definition and update the role constraint and add the notes column:

```sql
-- BEFORE (lines ~107-112):
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   VARCHAR(200),
  email       VARCHAR(200) UNIQUE,
  phone       VARCHAR(50),
  role        VARCHAR(20) DEFAULT 'customer'
                CHECK (role IN ('customer', 'technician', 'distributor', 'admin')),
  company     VARCHAR(200),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AFTER:
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   VARCHAR(200),
  email       VARCHAR(200) UNIQUE,
  phone       VARCHAR(50),
  role        VARCHAR(20) DEFAULT 'customer'
                CHECK (role IN ('admin', 'customer', 'customer_ws1', 'customer_ws3')),
  company     VARCHAR(200),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Also update the RLS section — replace the two existing `own_profile_select` and `own_profile_update` policies with the three new policies from Step 1. Find these lines in the schema:

```sql
-- REMOVE:
CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- ADD:
CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT is_admin())
  WITH CHECK (auth.uid() = id AND role = (SELECT up.role FROM user_profiles up WHERE up.id = auth.uid()));
CREATE POLICY "admin_profile_update" ON user_profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: extend user_profiles with ws roles, notes column, fix RLS update policy"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/shared/types/index.ts`

- [ ] **Step 1: Update `UserRole` and `UserProfile`**

In `src/shared/types/index.ts`, replace the `UserRole` type and update `UserProfile`:

```typescript
// Replace this:
export type UserRole = 'customer' | 'technician' | 'distributor' | 'admin'

// With this:
export type UserRole = 'admin' | 'customer' | 'customer_ws1' | 'customer_ws3'
```

Add `notes` to the `UserProfile` interface:

```typescript
// Replace this:
export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  company: string | null
}

// With this:
export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  company: string | null
  notes: string | null
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
npx vue-tsc --noEmit
```

Expected: zero errors. If errors appear about `UserRole` values that no longer exist (`technician`, `distributor`), trace them and remove those dead references.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/index.ts
git commit -m "feat: update UserRole to ws tiers, add notes to UserProfile"
```

---

## Task 3: `useProductPrice` Composable

**Files:**
- Create: `src/modules/catalog/composables/useProductPrice.ts`
- Create: `src/modules/catalog/composables/__tests__/useProductPrice.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/modules/catalog/composables/__tests__/useProductPrice.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useProductPrice } from '../useProductPrice'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import type { Product } from '@/shared/types'

const BASE: Product = {
  id: 'p1', sku: 'T001', name: 'Test', slug: 'test', description: '',
  brand:       { id: 1, name: 'B', slug: 'b' },
  category:    { id: 1, name: 'C', slug: 'c', productLineId: 1 },
  productLine: { id: 1, code: 'L01', name: 'Line', description: '', icon: '', slug: 'l01' },
  priceCop: 100_000, priceUsd: null,
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

describe('useProductPrice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns base price for unauthenticated user', () => {
    setRole(null)
    const { effectivePrice, isDiscounted, tierLabel } = useProductPrice(ref(BASE))
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
    expect(tierLabel.value).toBeNull()
  })

  it('returns base price for regular customer', () => {
    setRole('customer')
    const { effectivePrice, isDiscounted } = useProductPrice(ref(BASE))
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
  })

  it('customer_ws1 qty 1 → WS1 price, base crossed out, bulk hint', () => {
    setRole('customer_ws1')
    const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } =
      useProductPrice(ref(BASE), ref(1))
    expect(effectivePrice.value).toBe(80_000)
    expect(basePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(true)
    expect(tierLabel.value).toBe('WS1')
    expect(bulkPrice.value).toBe(70_000)
  })

  it('customer_ws1 qty 10 → WS2 price, bulkPrice null (already top tier)', () => {
    setRole('customer_ws1')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(10))
    expect(effectivePrice.value).toBe(70_000)
    expect(tierLabel.value).toBe('WS2 ×10')
    expect(bulkPrice.value).toBeNull()
  })

  it('customer_ws3 qty 1 → WS3 price', () => {
    setRole('customer_ws3')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(1))
    expect(effectivePrice.value).toBe(75_000)
    expect(tierLabel.value).toBe('OEM')
    expect(bulkPrice.value).toBe(65_000)
  })

  it('customer_ws3 qty 10 → WS4 price', () => {
    setRole('customer_ws3')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(10))
    expect(effectivePrice.value).toBe(65_000)
    expect(tierLabel.value).toBe('OEM ×10')
    expect(bulkPrice.value).toBeNull()
  })

  it('falls back to base price when WS columns are null', () => {
    setRole('customer_ws1')
    const p = ref({ ...BASE, priceWs1: null, priceWs2: null })
    const { effectivePrice, isDiscounted } = useProductPrice(p)
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
  })

  it('price updates reactively when qty changes across threshold', () => {
    setRole('customer_ws1')
    const qty = ref(1)
    const { effectivePrice, tierLabel } = useProductPrice(ref(BASE), qty)
    expect(effectivePrice.value).toBe(80_000)
    expect(tierLabel.value).toBe('WS1')
    qty.value = 10
    expect(effectivePrice.value).toBe(70_000)
    expect(tierLabel.value).toBe('WS2 ×10')
  })

  it('returns null effectivePrice when product is null', () => {
    setRole('customer_ws1')
    const { effectivePrice, isDiscounted } = useProductPrice(ref(null))
    expect(effectivePrice.value).toBeNull()
    expect(isDiscounted.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail with "Cannot find module"**

```bash
npm run test -- useProductPrice
```

Expected: FAIL — `Cannot find module '../useProductPrice'`

- [ ] **Step 3: Create the composable**

Create `src/modules/catalog/composables/useProductPrice.ts`:

```typescript
import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import type { Product } from '@/shared/types'

export interface PriceResult {
  effectivePrice: ComputedRef<number | null>
  basePrice:      ComputedRef<number | null>
  isDiscounted:   ComputedRef<boolean>
  tierLabel:      ComputedRef<string | null>
  bulkPrice:      ComputedRef<number | null>
  bulkThreshold:  ComputedRef<number>
}

export function useProductPrice(
  product: Ref<Product | null | undefined>,
  qty: Ref<number> = ref(1),
): PriceResult {
  const auth = useAuthStore()

  const resolved = computed(() => {
    const p = product.value
    if (!p) {
      return { effectivePrice: null, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
    }

    const base = p.priceCop ?? p.priceUsd ?? null
    const role = auth.profile?.role
    const q    = qty.value

    if (role === 'customer_ws1') {
      const ws1       = p.priceWs1 ?? base
      const ws2       = p.priceWs2 ?? null
      const effective = q >= 10 ? (ws2 ?? ws1) : ws1
      return {
        effectivePrice: effective,
        basePrice:      effective !== null && base !== null && effective < base ? base : null,
        isDiscounted:   effective !== null && base !== null && effective < base,
        tierLabel:      q >= 10 ? 'WS2 ×10' : 'WS1',
        bulkPrice:      q < 10 ? ws2 : null,
      }
    }

    if (role === 'customer_ws3') {
      const ws3       = p.priceWs3 ?? base
      const ws4       = p.priceWs4 ?? null
      const effective = q >= 10 ? (ws4 ?? ws3) : ws3
      return {
        effectivePrice: effective,
        basePrice:      effective !== null && base !== null && effective < base ? base : null,
        isDiscounted:   effective !== null && base !== null && effective < base,
        tierLabel:      q >= 10 ? 'OEM ×10' : 'OEM',
        bulkPrice:      q < 10 ? ws4 : null,
      }
    }

    return { effectivePrice: base, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
  })

  return {
    effectivePrice: computed(() => resolved.value.effectivePrice),
    basePrice:      computed(() => resolved.value.basePrice),
    isDiscounted:   computed(() => resolved.value.isDiscounted),
    tierLabel:      computed(() => resolved.value.tierLabel),
    bulkPrice:      computed(() => resolved.value.bulkPrice),
    bulkThreshold:  computed(() => 10),
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
npm run test -- useProductPrice
```

Expected: 9 tests PASS. If any fail, read the error output — the most likely issue is Pinia store setup in node environment. If you see "getActivePinia was called with no active Pinia", ensure `setActivePinia(createPinia())` runs in `beforeEach`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/composables/useProductPrice.ts \
        src/modules/catalog/composables/__tests__/useProductPrice.test.ts
git commit -m "feat: add useProductPrice composable with WS tier resolution"
```

---

## Task 4: ProductCard Price Display

**Files:**
- Modify: `src/modules/catalog/components/ProductCard.vue`

- [ ] **Step 1: Add imports**

In `ProductCard.vue`, in the `<script setup>` block, add `computed` to the Vue import and add the composable import:

```typescript
// Change:
import { ref } from 'vue'
// To:
import { ref, computed } from 'vue'

// Add after the existing imports:
import { useProductPrice } from '@/modules/catalog/composables/useProductPrice'
```

- [ ] **Step 2: Call the composable**

In the `<script setup>` block, after the existing store/composable calls, add:

```typescript
const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } = useProductPrice(
  computed(() => props.product)
)
```

- [ ] **Step 3: Replace the price display block in the template**

Find the `<!-- Price + Action -->` block (currently lines 88–110 of the original file). Replace the entire `<div>` inside `<!-- Price + Action -->` that contains the price templates:

```html
<!-- Price + Action -->
<div class="flex items-center justify-between pt-1 border-t border-slate-100 mt-1">
  <div>
    <!-- WS discounted price -->
    <template v-if="isDiscounted">
      <p class="text-[10px] text-slate-400 line-through leading-tight">{{ formatCurrency(basePrice!) }}</p>
      <div class="flex items-center gap-1.5 mt-0.5">
        <p class="text-xl font-extrabold text-slate-900">{{ formatCurrency(effectivePrice!) }}</p>
        <AppBadge :variant="tierLabel!.startsWith('OEM') ? 'orange' : 'blue'" size="xs">{{ tierLabel }}</AppBadge>
      </div>
      <p v-if="bulkPrice" class="text-[10px] text-slate-500 mt-0.5">+10 uds: {{ formatCurrency(bulkPrice) }}</p>
    </template>
    <!-- Regular price -->
    <template v-else-if="effectivePrice != null">
      <p class="text-xl font-extrabold text-slate-900">{{ formatCurrency(effectivePrice) }}</p>
      <p class="text-[10px] text-slate-400">{{ props.product.priceCop != null ? 'COP · IVA incluido' : 'USD' }}</p>
    </template>
    <template v-else>
      <p class="text-sm font-semibold text-slate-400">Consultar precio</p>
    </template>
  </div>
  <button
    @click.prevent="handleAdd"
    :disabled="adding"
    class="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
  >
    <component :is="adding ? Check : ShoppingCart" class="h-3.5 w-3.5" />
    {{ adding ? 'Agregado' : 'Agregar' }}
  </button>
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/components/ProductCard.vue
git commit -m "feat: show WS discounted price with tier badge in ProductCard"
```

---

## Task 5: ProductDetailView Price Display

**Files:**
- Modify: `src/modules/catalog/views/ProductDetailView.vue`

- [ ] **Step 1: Add imports**

In `ProductDetailView.vue` `<script setup>`, add `AppBadge` and `useProductPrice`:

```typescript
// AppBadge is already imported — verify it's present; if not, add:
import AppBadge from '@/shared/components/ui/AppBadge.vue'

// Add after existing imports:
import { useProductPrice } from '@/modules/catalog/composables/useProductPrice'
```

- [ ] **Step 2: Call the composable**

In the `<script setup>` block, after the `qty` ref declaration, add:

```typescript
const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } = useProductPrice(product, qty)
```

(`product` here is already `computed(() => catalog.getById(...))` and `qty` is `ref(1)` — both are `Ref` types, compatible with the composable's parameter types.)

- [ ] **Step 3: Replace the price box in the template**

Find the `<!-- Price -->` block (the `<div class="bg-white rounded-2xl p-5 border border-slate-200">` element). Replace only the price display templates inside it, keeping the stock indicator and qty+add-to-cart section unchanged:

```html
<!-- Price -->
<div class="bg-white rounded-2xl p-5 border border-slate-200">
  <!-- WS discounted price -->
  <template v-if="isDiscounted">
    <div class="flex items-center gap-2 mb-0.5">
      <span class="text-sm text-slate-400 line-through">{{ formatCurrency(basePrice!) }}</span>
      <AppBadge :variant="tierLabel!.startsWith('OEM') ? 'orange' : 'blue'" size="xs">{{ tierLabel }}</AppBadge>
    </div>
    <p class="text-4xl font-extrabold text-slate-900 mb-1">{{ formatCurrency(effectivePrice!) }}</p>
    <div class="flex items-center gap-4 mb-4">
      <p class="text-xs text-slate-400">{{ product.priceCop != null ? 'COP · IVA incluido' : 'USD' }}</p>
      <p v-if="bulkPrice" class="text-xs font-medium text-slate-500">+10 uds: {{ formatCurrency(bulkPrice) }}</p>
    </div>
  </template>
  <!-- Regular price -->
  <template v-else-if="effectivePrice != null">
    <p class="text-4xl font-extrabold text-slate-900 mb-1">{{ formatCurrency(effectivePrice) }}</p>
    <p class="text-xs text-slate-400 mb-4">{{ product.priceCop != null ? 'COP · IVA incluido' : 'USD' }}</p>
  </template>
  <template v-else>
    <p class="text-xl font-semibold text-slate-400 mb-4">Consultar precio</p>
  </template>

  <!-- Stock indicator — unchanged -->
  <div v-if="product.stock > 0" class="flex items-center gap-2 mb-5">
    <div :class="['h-2 w-2 rounded-full', product.stock > 5 ? 'bg-emerald-500' : 'bg-amber-500']" />
    <span class="text-sm font-medium" :class="product.stock > 5 ? 'text-emerald-700' : 'text-amber-700'">
      {{ product.stock > 5 ? `${product.stock} unidades en stock` : `Solo ${product.stock} unidades disponibles` }}
    </span>
  </div>

  <!-- Qty + Add — unchanged -->
  <div class="flex gap-3">
    <div class="flex items-center border border-slate-200 rounded-xl overflow-hidden" role="group" aria-label="Cantidad">
      <button
        @click="qty > 1 && qty--"
        aria-label="Reducir cantidad"
        class="px-3 py-3 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded-l-xl transition-colors text-lg font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >−</button>
      <span class="px-4 text-base font-semibold min-w-[3rem] text-center border-x border-slate-200">{{ qty }}</span>
      <button
        @click="(!product.stock || qty < product.stock) && qty++"
        aria-label="Aumentar cantidad"
        class="px-3 py-3 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded-r-xl transition-colors text-lg font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >+</button>
    </div>
    <button
      @click="handleAdd"
      class="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold py-3 px-6 rounded-xl transition-colors text-base focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
    >
      <component :is="justAdded ? Check : ShoppingCart" class="h-5 w-5" aria-hidden="true" />
      {{ justAdded ? '¡Agregado al carrito!' : 'Agregar al carrito' }}
    </button>
  </div>
</div>
```

- [ ] **Step 4: TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/views/ProductDetailView.vue
git commit -m "feat: reactive WS price display in ProductDetailView, updates on qty change"
```

---

## Task 6: `customers.service.ts`

**Files:**
- Create: `src/modules/admin/services/customers.service.ts`

- [ ] **Step 1: Create the service**

Create `src/modules/admin/services/customers.service.ts`:

```typescript
import { supabase } from '@/core/supabase/client'
import type { UserRole } from '@/shared/types'

export interface CustomerRow {
  id:         string
  email:      string
  full_name:  string | null
  phone:      string | null
  company:    string | null
  role:       UserRole
  notes:      string | null
  created_at: string
}

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function listCustomers(opts?: {
  search?: string
  role?:   UserRole | 'all'
}): Promise<CustomerRow[]> {
  let q = getSb()
    .from('user_profiles')
    .select('id, email, full_name, phone, company, role, notes, created_at')
    .order('created_at', { ascending: false })

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`
    q = q.or(`full_name.ilike.${s},email.ilike.${s},company.ilike.${s}`)
  }

  if (opts?.role && opts.role !== 'all') {
    q = q.eq('role', opts.role)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CustomerRow[]
}

export async function updateCustomerRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await getSb()
    .from('user_profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateCustomerNotes(userId: string, notes: string): Promise<void> {
  const { error } = await getSb()
    .from('user_profiles')
    .update({ notes })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/services/customers.service.ts
git commit -m "feat: add customers.service with listCustomers, updateRole, updateNotes"
```

---

## Task 7: `AdminCustomersView.vue`

**Files:**
- Create: `src/modules/admin/views/AdminCustomersView.vue`

- [ ] **Step 1: Create the view**

Create `src/modules/admin/views/AdminCustomersView.vue`:

```vue
<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Clientes</h1>
      <p class="text-sm text-slate-500 mt-0.5">{{ customers.length }} usuarios registrados</p>
    </div>

    <!-- Search + role filter bar -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          v-model="searchQuery"
          placeholder="Buscar por nombre, email o empresa..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="f in roleFilters"
          :key="f.value"
          @click="activeRole = f.value"
          :class="[
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            activeRole === f.value
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700',
          ]"
        >
          {{ f.label }}
          <span class="ml-1 font-normal opacity-60">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <AppSpinner size="lg" class="text-brand-600" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="loadCustomers" class="text-xs text-brand-600 underline">Reintentar</button>
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Cliente</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Empresa</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden md:table-cell">Teléfono</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Rol</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden lg:table-cell">Miembro desde</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr
            v-for="c in filtered"
            :key="c.id"
            @click="openPanel(c)"
            class="hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 select-none', avatarClass(c)]">
                  {{ initials(c.full_name ?? c.email) }}
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 truncate">{{ c.full_name ?? '—' }}</p>
                  <p class="text-xs text-slate-400 truncate">{{ c.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3.5 text-slate-600 text-sm">{{ c.company ?? '—' }}</td>
            <td class="px-5 py-3.5 text-slate-600 text-sm hidden md:table-cell">{{ c.phone ?? '—' }}</td>
            <td class="px-5 py-3.5">
              <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full', roleBadgeClass(c.role)]">
                {{ roleLabel(c.role) }}
              </span>
            </td>
            <td class="px-5 py-3.5 text-slate-400 text-xs hidden lg:table-cell">{{ formatDate(c.created_at) }}</td>
            <td class="px-5 py-3.5">
              <ChevronRight class="h-4 w-4 text-slate-300" aria-hidden="true" />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length && !loading" class="py-16 text-center text-slate-400 text-sm">
        No se encontraron clientes
      </div>
    </div>

    <!-- Slide-over detail panel -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selected" class="fixed inset-0 bg-black/30 z-50" @click="closePanel" aria-hidden="true" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="selected"
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-customer-name"
          class="fixed top-0 right-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col"
        >
          <!-- Panel header -->
          <div class="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div :class="['w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none', avatarClass(selected)]">
                {{ initials(selected.full_name ?? selected.email) }}
              </div>
              <div class="min-w-0">
                <p id="panel-customer-name" class="font-bold text-slate-900 truncate">{{ selected.full_name ?? '—' }}</p>
                <p class="text-xs text-slate-400 truncate">{{ selected.email }}</p>
              </div>
            </div>
            <button
              @click="closePanel"
              aria-label="Cerrar panel"
              class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <!-- Panel body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Info grid -->
            <dl class="space-y-3">
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Empresa</dt>
                <dd class="font-medium text-slate-900 text-right">{{ selected.company ?? '—' }}</dd>
              </div>
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Teléfono</dt>
                <dd class="font-medium text-slate-900 text-right">{{ selected.phone ?? '—' }}</dd>
              </div>
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Miembro desde</dt>
                <dd class="font-medium text-slate-900 text-right">{{ formatDate(selected.created_at) }}</dd>
              </div>
            </dl>

            <div class="border-t border-slate-100 pt-5 space-y-4">
              <!-- Role selector -->
              <div>
                <label for="panel-role" class="block text-xs font-semibold text-slate-500 mb-1.5">Rol</label>
                <select
                  id="panel-role"
                  v-model="panelRole"
                  :disabled="selected.role === 'admin'"
                  class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                  <option value="customer">customer — Precio estándar</option>
                  <option value="customer_ws1">customer_ws1 — Mayorista</option>
                  <option value="customer_ws3">customer_ws3 — OEM</option>
                  <option value="admin" disabled>admin (no cambiar)</option>
                </select>
                <p v-if="selected.role === 'admin'" class="text-xs text-slate-400 mt-1">
                  El rol de administrador no puede modificarse desde aquí.
                </p>
              </div>

              <!-- Notes -->
              <div>
                <label for="panel-notes" class="block text-xs font-semibold text-slate-500 mb-1.5">Notas internas</label>
                <textarea
                  id="panel-notes"
                  v-model="panelNotes"
                  rows="4"
                  placeholder="Notas visibles solo para el equipo interno..."
                  class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <!-- Panel footer -->
          <div class="p-6 border-t border-slate-100 flex-shrink-0">
            <p v-if="saveError" class="text-xs text-red-500 mb-3">{{ saveError }}</p>
            <button
              @click="saveChanges"
              :disabled="saving || selected.role === 'admin'"
              class="w-full bg-brand-700 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Search, ChevronRight, X } from '@lucide/vue'
import AppSpinner from '@/shared/components/ui/AppSpinner.vue'
import {
  listCustomers,
  updateCustomerRole,
  updateCustomerNotes,
  type CustomerRow,
} from '../services/customers.service'
import type { UserRole } from '@/shared/types'

// ── State ──────────────────────────────────────────────────────────────────────

const customers   = ref<CustomerRow[]>([])
const loading     = ref(true)
const loadError   = ref<string | null>(null)
const searchQuery = ref('')
const activeRole  = ref<UserRole | 'all'>('all')

const selected   = ref<CustomerRow | null>(null)
const panelRole  = ref<UserRole>('customer')
const panelNotes = ref('')
const saving     = ref(false)
const saveError  = ref<string | null>(null)

// ── Derived ────────────────────────────────────────────────────────────────────

const roleFilters = computed(() => {
  const count = (r: string) => customers.value.filter(c => c.role === r).length
  return [
    { value: 'all'          as const, label: 'Todos',    count: customers.value.length },
    { value: 'customer'     as const, label: 'customer', count: count('customer') },
    { value: 'customer_ws1' as const, label: 'WS1',      count: count('customer_ws1') },
    { value: 'customer_ws3' as const, label: 'OEM',      count: count('customer_ws3') },
    { value: 'admin'        as const, label: 'Admin',    count: count('admin') },
  ]
})

const filtered = computed(() => {
  let list = customers.value
  if (activeRole.value !== 'all') {
    list = list.filter(c => c.role === activeRole.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    )
  }
  return list
})

// ── Actions ────────────────────────────────────────────────────────────────────

async function loadCustomers() {
  loading.value   = true
  loadError.value = null
  try {
    customers.value = await listCustomers()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openPanel(c: CustomerRow) {
  selected.value   = c
  panelRole.value  = c.role
  panelNotes.value = c.notes ?? ''
  saveError.value  = null
}

function closePanel() {
  selected.value = null
}

async function saveChanges() {
  if (!selected.value || selected.value.role === 'admin') return
  saving.value    = true
  saveError.value = null
  try {
    await updateCustomerRole(selected.value.id, panelRole.value)
    await updateCustomerNotes(selected.value.id, panelNotes.value)
    const idx = customers.value.findIndex(c => c.id === selected.value!.id)
    if (idx !== -1) {
      customers.value[idx] = {
        ...customers.value[idx],
        role:  panelRole.value,
        notes: panelNotes.value,
      }
    }
    closePanel()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function avatarClass(c: CustomerRow): string {
  const code = (c.full_name ?? c.email).charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

function roleBadgeClass(role: UserRole): string {
  if (role === 'customer_ws1') return 'bg-brand-50 text-brand-700'
  if (role === 'customer_ws3') return 'bg-orange-50 text-orange-600'
  if (role === 'admin')        return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}

function roleLabel(role: UserRole): string {
  if (role === 'customer_ws1') return 'WS1 · Mayorista'
  if (role === 'customer_ws3') return 'OEM'
  if (role === 'admin')        return 'Admin'
  return 'Customer'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel()
}

onMounted(() => {
  loadCustomers()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>
```

- [ ] **Step 2: TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/views/AdminCustomersView.vue
git commit -m "feat: add AdminCustomersView with search, role filter, and slide-over panel"
```

---

## Task 8: Router + AdminLayout Nav Item

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/modules/admin/layouts/AdminLayout.vue`

- [ ] **Step 1: Add route to router**

In `src/router/index.ts`, add the customers route inside the `/admin` children array, after the `settings` entry:

```typescript
// Add after:
{ path: 'settings', name: 'admin-settings', component: () => import('@/modules/admin/views/AdminSettingsView.vue') },

// Add this:
{ path: 'customers', name: 'admin-customers', component: () => import('@/modules/admin/views/AdminCustomersView.vue') },
```

- [ ] **Step 2: Add nav item to AdminLayout**

In `src/modules/admin/layouts/AdminLayout.vue`, update the imports and `navItems` array:

```typescript
// Change:
import { Package, Layers, Settings, ExternalLink } from '@lucide/vue'

// To:
import { Package, Layers, Settings, Users, ExternalLink } from '@lucide/vue'
```

```typescript
// Change:
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/settings',  label: 'CSV',        icon: Settings },
]

// To:
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
  { to: '/admin/settings',  label: 'CSV',        icon: Settings },
]
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all 9 useProductPrice tests PASS, zero failures.

- [ ] **Step 4: TypeScript check**

```bash
npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Final commit**

```bash
git add src/router/index.ts src/modules/admin/layouts/AdminLayout.vue
git commit -m "feat: add /admin/customers route and Clientes nav item to admin sidebar"
```
