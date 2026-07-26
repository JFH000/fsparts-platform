# Inventory Stock Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full accounting stock ledger to the FSP Parts admin panel: admins can receive batch purchase orders, apply quick adjustments, and inspect per-product movement history.

**Architecture:** Two new Postgres tables (`stock_receipts`, `stock_movements`) with a trigger that atomically maintains `products.stock`. A `stock.service.ts` provides typed access. Three Vue views cover the main stock table (`/admin/stock`), batch receipt form (`/admin/stock/new`), and a product-creation stock field integration.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Tailwind CSS v4 (`@theme` block, `brand-700` = Blueprint Indigo `#1d4ed8`, `accent-500` = Thermal Orange `#f97316`), Supabase Postgres + supabase-js, lucide-vue-next icons via `@lucide/vue`.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `supabase/migrations/20260611_stock_tables.sql` | DB: tables + trigger + RLS |
| Modify | `supabase/schema.sql` | Keep schema doc in sync |
| Create | `src/modules/admin/services/stock.service.ts` | Typed Supabase queries/mutations for stock |
| Modify | `src/router/index.ts` | Add `/admin/stock` + `/admin/stock/new` routes |
| Modify | `src/modules/admin/layouts/AdminLayout.vue` | Add "Stock" sidebar nav item |
| Create | `src/modules/admin/views/AdminStockView.vue` | Main stock table + adjust widget + historial slide-over |
| Create | `src/modules/admin/views/AdminStockNewReceiptView.vue` | Batch receipt form |
| Modify | `src/modules/admin/views/AdminProductFormView.vue` | "Stock inicial" field on create |

---

## Codebase Context (read before implementing any task)

- Supabase client: `import { supabase } from '@/core/supabase/client'` — may be `null` if env vars missing; always guard with `if (!supabase) throw new Error('Supabase no configurado')`.
- Tailwind v4 tokens: `bg-brand-700` (Blueprint Indigo), `text-accent-500` (Thermal Orange), `bg-slate-900` (dark sidebar). Classes are utility-first — no CSS modules.
- Icon library: `import { PackageIcon, ... } from '@lucide/vue'` (note: `@lucide/vue`, NOT `lucide-vue-next`).
- AdminLayout sidebar pattern: array `navItems = [{ to, label, icon }]` rendered as `RouterLink` with tooltip.
- Route guard: all `/admin/*` routes have `meta: { requiresAuth: true }` — the guard in `router/index.ts` checks `authStore.isAdmin`.
- `products.stock` column already exists (`INT NOT NULL DEFAULT 0 CHECK (stock >= 0)`). Do NOT add it again. Only add the trigger that maintains it via `stock_movements` inserts.
- `createProduct` in `admin.service.ts` returns `Promise<string>` (the new product UUID). Use this id when creating the initial stock movement.

---

## Task 1: DB Migration — stock_receipts + stock_movements + trigger + RLS

**Files:**
- Create: `supabase/migrations/20260611_stock_tables.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260611_stock_tables.sql` with this exact content:

```sql
-- ============================================================
-- Stock management tables
-- ============================================================

-- stock_receipts: one row per batch purchase order received
CREATE TABLE IF NOT EXISTS stock_receipts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   TEXT NOT NULL,
  supplier    TEXT,
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stock_movements: immutable ledger; one row per unit-event
CREATE TABLE IF NOT EXISTS stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  receipt_id    UUID REFERENCES stock_receipts(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL,
  cost_per_unit NUMERIC(12,2),
  type          TEXT NOT NULL CHECK (type IN ('ingreso', 'ajuste')),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-product history queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id
  ON stock_movements(product_id, created_at DESC);

-- ============================================================
-- Trigger: maintain products.stock after each movement insert
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_stock ON stock_movements;
CREATE TRIGGER trg_update_product_stock
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE stock_receipts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Helper reused from existing schema: is_admin() checks user_profiles.role = 'admin'
-- stock_receipts: admins full access
CREATE POLICY "admins_stock_receipts_select" ON stock_receipts
  FOR SELECT USING (is_admin());
CREATE POLICY "admins_stock_receipts_insert" ON stock_receipts
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins_stock_receipts_update" ON stock_receipts
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- stock_movements: admins can read and insert; no update/delete (immutable ledger)
CREATE POLICY "admins_stock_movements_select" ON stock_movements
  FOR SELECT USING (is_admin());
CREATE POLICY "admins_stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (is_admin());
```

- [ ] **Step 2: Apply the migration to the live DB via Supabase MCP**

Run the migration using the Supabase MCP `apply_migration` tool with name `stock_tables` and the SQL from Step 1. Verify: no error returned.

- [ ] **Step 3: Verify the tables exist**

Use `list_tables` MCP tool. Confirm `stock_receipts` and `stock_movements` appear.

- [ ] **Step 4: Update supabase/schema.sql**

Read `supabase/schema.sql`. Append the two `CREATE TABLE` statements (without `IF NOT EXISTS`, matching the existing schema style), the trigger function, and the trigger definition. Add RLS policy docs as SQL comments. Place after the existing `user_profiles` table section.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611_stock_tables.sql supabase/schema.sql
git commit -m "feat: add stock_receipts, stock_movements tables with trigger and RLS"
```

---

## Task 2: stock.service.ts

**Files:**
- Create: `src/modules/admin/services/stock.service.ts`

- [ ] **Step 1: Create the service file**

Create `src/modules/admin/services/stock.service.ts`:

```typescript
import { supabase } from '@/core/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductStockRow {
  id:            string
  sku:           string
  name:          string
  stock:         number
  product_line:  { id: number; code: string } | null
  last_movement: { type: string; quantity: number; created_at: string } | null
}

export interface StockMovement {
  id:            string
  product_id:    string
  receipt_id:    string | null
  quantity:      number
  cost_per_unit: number | null
  type:          'ingreso' | 'ajuste'
  notes:         string | null
  created_by:    string
  created_at:    string
  receipt:       { reference: string; supplier: string | null } | null
}

export interface CreateReceiptInput {
  reference: string
  supplier:  string
  notes:     string
  lines: Array<{
    product_id:    string
    quantity:      number
    cost_per_unit: number | null
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listProductsWithStock(): Promise<ProductStockRow[]> {
  const { data, error } = await getSb()
    .from('products')
    .select(`
      id, sku, name, stock,
      product_line:product_lines(id, code)
    `)
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)

  // Fetch last movement per product in a second query (Supabase doesn't support
  // DISTINCT ON in the JS client; a simple per-product latest-row is cleaner as
  // a separate call when the product list is not huge)
  const ids = (data ?? []).map((p: { id: string }) => p.id)
  let lastMovements: Array<{ product_id: string; type: string; quantity: number; created_at: string }> = []
  if (ids.length) {
    const { data: mv } = await getSb()
      .from('stock_movements')
      .select('product_id, type, quantity, created_at')
      .in('product_id', ids)
      .order('created_at', { ascending: false })
    // keep only the most recent per product
    const seen = new Set<string>()
    for (const m of (mv ?? [])) {
      if (!seen.has(m.product_id)) {
        seen.add(m.product_id)
        lastMovements.push(m as { product_id: string; type: string; quantity: number; created_at: string })
      }
    }
  }

  const mvMap = new Map(lastMovements.map(m => [m.product_id, m]))

  return (data ?? []).map((p: Record<string, unknown>) => ({
    id:            p.id as string,
    sku:           p.sku as string,
    name:          p.name as string,
    stock:         p.stock as number,
    product_line:  p.product_line as { id: number; code: string } | null,
    last_movement: mvMap.get(p.id as string) ?? null,
  }))
}

export async function listMovements(productId: string): Promise<StockMovement[]> {
  const { data, error } = await getSb()
    .from('stock_movements')
    .select(`
      id, product_id, receipt_id, quantity, cost_per_unit, type, notes, created_by, created_at,
      receipt:stock_receipts(reference, supplier)
    `)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as StockMovement[]
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createReceipt(input: CreateReceiptInput): Promise<void> {
  const sb = getSb()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // 1. Insert receipt header
  const { data: receipt, error: rErr } = await sb
    .from('stock_receipts')
    .insert({
      reference:  input.reference,
      supplier:   input.supplier || null,
      notes:      input.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (rErr) throw new Error(rErr.message)

  // 2. Insert all movement lines in one batch
  const movements = input.lines.map(line => ({
    product_id:    line.product_id,
    receipt_id:    (receipt as { id: string }).id,
    quantity:      line.quantity,
    cost_per_unit: line.cost_per_unit ?? null,
    type:          'ingreso' as const,
    notes:         null,
    created_by:    user.id,
  }))

  const { error: mErr } = await sb.from('stock_movements').insert(movements)
  if (mErr) throw new Error(mErr.message)
}

export async function createAdjustment(
  productId: string,
  delta: number,
  notes: string,
): Promise<void> {
  const sb = getSb()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await sb.from('stock_movements').insert({
    product_id: productId,
    receipt_id: null,
    quantity:   delta,
    type:       'ajuste',
    notes:      notes || null,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
}

export async function createInitialStockMovement(
  productId: string,
  qty: number,
): Promise<void> {
  const sb = getSb()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await sb.from('stock_movements').insert({
    product_id: productId,
    receipt_id: null,
    quantity:   qty,
    type:       'ajuste',
    notes:      'Stock inicial',
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `stock.service.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/services/stock.service.ts
git commit -m "feat: add stock.service with listProductsWithStock, listMovements, createReceipt, createAdjustment"
```

---

## Task 3: Router + AdminLayout nav item

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/modules/admin/layouts/AdminLayout.vue`

- [ ] **Step 1: Add routes to router/index.ts**

In `src/router/index.ts`, find the `/admin` children array. Add two entries after the `customers` route:

```typescript
{ path: 'stock',     name: 'admin-stock',            component: () => import('@/modules/admin/views/AdminStockView.vue') },
{ path: 'stock/new', name: 'admin-stock-new-receipt', component: () => import('@/modules/admin/views/AdminStockNewReceiptView.vue') },
```

The full `/admin` children array should then end with:
```typescript
{ path: 'settings',  name: 'admin-settings',         component: () => import('@/modules/admin/views/AdminSettingsView.vue') },
{ path: 'customers', name: 'admin-customers',         component: () => import('@/modules/admin/views/AdminCustomersView.vue') },
{ path: 'stock',     name: 'admin-stock',             component: () => import('@/modules/admin/views/AdminStockView.vue') },
{ path: 'stock/new', name: 'admin-stock-new-receipt', component: () => import('@/modules/admin/views/AdminStockNewReceiptView.vue') },
```

- [ ] **Step 2: Add Stock nav item to AdminLayout.vue**

In `src/modules/admin/layouts/AdminLayout.vue`:

**Script change** — add `ArchiveIcon` to the lucide import (the `Package` icon is already used for Productos; use `Archive` for Stock to differentiate):

```typescript
import { Package, Layers, Settings, Users, ExternalLink, Archive } from '@lucide/vue'
```

**navItems change** — insert the Stock entry between Clientes and CSV:

```typescript
const navItems = [
  { to: '/admin/products',  label: 'Productos', icon: Package  },
  { to: '/admin/catalog',   label: 'Catálogo',  icon: Layers   },
  { to: '/admin/customers', label: 'Clientes',  icon: Users    },
  { to: '/admin/stock',     label: 'Stock',     icon: Archive  },
  { to: '/admin/settings',  label: 'CSV',       icon: Settings },
]
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/modules/admin/layouts/AdminLayout.vue
git commit -m "feat: add /admin/stock routes and Stock sidebar nav item"
```

---

## Task 4: AdminStockView.vue

**Files:**
- Create: `src/modules/admin/views/AdminStockView.vue`

This is the main stock management view. It loads all products with their current stock, provides an inline adjust widget per row, a search/filter bar, and a per-product movement history slide-over.

- [ ] **Step 1: Create the component**

Create `src/modules/admin/views/AdminStockView.vue` with the following complete implementation:

```vue
<template>
  <div class="max-w-6xl mx-auto px-8 py-8">

    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Stock</h1>
        <p class="text-sm text-slate-400 mt-0.5">
          {{ rows.length }} productos
          <span v-if="loadedAt"> · actualizado {{ timeAgo(loadedAt) }}</span>
        </p>
      </div>
      <RouterLink
        to="/admin/stock/new"
        class="flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
      >
        <Plus class="h-4 w-4" />
        Nuevo ingreso por lote
      </RouterLink>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{{ error }}</div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-20">
      <Loader2 class="h-7 w-7 text-brand-600 animate-spin" />
    </div>

    <template v-else>
      <!-- Filter bar -->
      <div class="flex items-center gap-3 mb-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            v-model="search"
            type="text"
            placeholder="Buscar SKU o producto…"
            class="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent w-64"
          />
        </div>
        <div class="flex gap-2">
          <button
            v-for="f in filters"
            :key="f.key"
            @click="activeFilter = f.key"
            class="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors"
            :class="activeFilter === f.key
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left px-6 py-3 text-xs font-semibold text-slate-400">Producto</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400">Línea</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400">Stock actual</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400">Ajuste rápido</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400">Último movimiento</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              class="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
              :class="{ 'bg-amber-50 hover:bg-amber-50/80': row.stock > 0 && row.stock <= 5 }"
            >
              <td class="px-6 py-4">
                <div class="font-semibold text-slate-900 text-sm">{{ row.name }}</div>
                <div class="text-xs text-slate-400 font-mono mt-0.5">{{ row.sku }}</div>
              </td>
              <td class="px-4 py-4">
                <span v-if="row.product_line" class="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {{ row.product_line.code }}
                </span>
              </td>
              <td class="px-4 py-4 text-center">
                <span
                  class="text-lg font-bold"
                  :class="{
                    'text-slate-900': row.stock > 5,
                    'text-amber-600': row.stock > 0 && row.stock <= 5,
                    'text-slate-400': row.stock === 0,
                  }"
                >{{ row.stock }}</span>
                <span v-if="row.stock > 0 && row.stock <= 5" class="text-amber-500 ml-1 text-sm">⚠</span>
                <span class="text-xs text-slate-400 ml-1">uds</span>
              </td>
              <td class="px-4 py-4 text-center">
                <div class="inline-flex items-center gap-2">
                  <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      @click="adjustDeltas[row.id] = (adjustDeltas[row.id] ?? 0) - 1"
                      class="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-sm"
                    >−</button>
                    <input
                      :value="adjustDeltas[row.id] ?? 0"
                      @input="adjustDeltas[row.id] = parseInt(($event.target as HTMLInputElement).value) || 0"
                      type="number"
                      class="w-12 text-center border-x border-slate-200 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none"
                    />
                    <button
                      @click="adjustDeltas[row.id] = (adjustDeltas[row.id] ?? 0) + 1"
                      class="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-sm"
                    >+</button>
                  </div>
                  <button
                    @click="openAdjustModal(row)"
                    :disabled="!adjustDeltas[row.id]"
                    class="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors"
                  >✓</button>
                </div>
              </td>
              <td class="px-4 py-4">
                <template v-if="row.last_movement">
                  <div class="text-xs text-slate-600">
                    {{ row.last_movement.quantity > 0 ? '+' : '' }}{{ row.last_movement.quantity }}
                    {{ row.last_movement.type }}
                  </div>
                  <div class="text-xs text-slate-400">{{ timeAgo(row.last_movement.created_at) }}</div>
                </template>
                <span v-else class="text-xs text-slate-400">Nunca ingresado</span>
              </td>
              <td class="px-4 py-4 text-right">
                <button
                  @click="openHistorial(row)"
                  class="text-xs text-slate-400 hover:text-brand-700 transition-colors"
                >Historial →</button>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="6" class="px-6 py-12 text-center text-sm text-slate-400">
                Sin productos que coincidan
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Adjust confirmation mini-modal -->
    <Teleport to="body">
      <div v-if="adjustTarget" class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" @click.self="adjustTarget = null">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h3 class="font-bold text-slate-900 mb-1">Confirmar ajuste</h3>
          <p class="text-sm text-slate-500 mb-4">
            {{ adjustTarget.name }} ·
            <span :class="(adjustDeltas[adjustTarget.id] ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'" class="font-semibold">
              {{ (adjustDeltas[adjustTarget.id] ?? 0) >= 0 ? '+' : '' }}{{ adjustDeltas[adjustTarget.id] ?? 0 }} uds
            </span>
          </p>
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Motivo del ajuste *
          </label>
          <input
            v-model="adjustNotes"
            type="text"
            placeholder="p. ej. Conteo físico, daño en bodega…"
            class="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent mb-4"
            @keydown.enter="confirmAdjust"
          />
          <p v-if="adjustError" class="text-xs text-red-500 mb-3">{{ adjustError }}</p>
          <div class="flex gap-3">
            <button @click="adjustTarget = null" class="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-slate-300 transition-colors">
              Cancelar
            </button>
            <button
              @click="confirmAdjust"
              :disabled="isAdjusting || !adjustNotes.trim()"
              class="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Loader2 v-if="isAdjusting" class="h-4 w-4 animate-spin" />
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Historial slide-over -->
    <Teleport to="body">
      <div v-if="historialProduct" class="fixed inset-0 z-50" @click.self="historialProduct = null">
        <div class="absolute inset-0 bg-black/30" @click="historialProduct = null" />
        <div class="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-2xl flex flex-col">

          <!-- Panel header -->
          <div class="flex items-start justify-between p-5 border-b border-slate-100">
            <div>
              <div class="font-bold text-slate-900 text-sm">{{ historialProduct.name }}</div>
              <div class="text-xs text-slate-400 font-mono mt-0.5">{{ historialProduct.sku }}</div>
            </div>
            <div class="text-right ml-4 flex-shrink-0">
              <div class="text-2xl font-extrabold text-slate-900">{{ historialProduct.stock }}</div>
              <div class="text-xs text-slate-400">en stock</div>
            </div>
          </div>

          <!-- Movement list -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="isLoadingMovements" class="flex justify-center py-8">
              <Loader2 class="h-5 w-5 text-brand-600 animate-spin" />
            </div>
            <template v-else>
              <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Historial de movimientos
              </div>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="(mv, i) in movements"
                  :key="mv.id"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  :class="mv.quantity >= 0 ? 'bg-emerald-50' : 'bg-red-50'"
                >
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    :class="mv.quantity >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                  >
                    {{ mv.quantity >= 0 ? '+' : '' }}{{ mv.quantity }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-slate-900 text-xs">
                      {{ mv.type === 'ingreso' ? 'Ingreso' : 'Ajuste' }}
                      <span v-if="mv.receipt?.reference"> · {{ mv.receipt.reference }}</span>
                      <span v-else-if="mv.notes"> · {{ mv.notes }}</span>
                    </div>
                    <div class="text-xs text-slate-500 mt-0.5 truncate">
                      <span v-if="mv.receipt?.supplier">{{ mv.receipt.supplier }}</span>
                      <span v-if="mv.cost_per_unit"> · ${{ mv.cost_per_unit.toLocaleString('es-CO') }}/und</span>
                      <span v-if="!mv.receipt && mv.notes">{{ mv.notes }}</span>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="text-xs font-semibold" :class="mv.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'">
                      → {{ stockAfter(i) }}
                    </div>
                    <div class="text-xs text-slate-400">{{ timeAgo(mv.created_at) }}</div>
                  </div>
                </div>
                <div v-if="!movements.length" class="text-sm text-slate-400 py-6 text-center">
                  Sin movimientos registrados
                </div>
              </div>
            </template>
          </div>

          <button
            @click="historialProduct = null"
            class="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, Search, Loader2, X } from '@lucide/vue'
import {
  listProductsWithStock,
  listMovements,
  createAdjustment,
  type ProductStockRow,
  type StockMovement,
} from '@/modules/admin/services/stock.service'

// ── Data loading ──────────────────────────────────────────────────────────────
const rows      = ref<ProductStockRow[]>([])
const isLoading = ref(false)
const error     = ref('')
const loadedAt  = ref<string>('')

async function load() {
  isLoading.value = true
  error.value     = ''
  try {
    rows.value    = await listProductsWithStock()
    loadedAt.value = new Date().toISOString()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar stock'
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

// ── Escape key to close panels ────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (historialProduct.value) { historialProduct.value = null; return }
    if (adjustTarget.value)     { adjustTarget.value = null }
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── Filters ───────────────────────────────────────────────────────────────────
const search       = ref('')
const activeFilter = ref<'all' | 'low' | 'out'>('all')

const filters = [
  { key: 'all' as const, label: 'Todos'      },
  { key: 'low' as const, label: 'Stock bajo' },
  { key: 'out' as const, label: 'Sin stock'  },
]

const filteredRows = computed(() => {
  let list = rows.value
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
  }
  if (activeFilter.value === 'low') list = list.filter(r => r.stock > 0 && r.stock <= 5)
  if (activeFilter.value === 'out') list = list.filter(r => r.stock === 0)
  return list
})

// ── Adjust widget ─────────────────────────────────────────────────────────────
const adjustDeltas: Record<string, number> = reactive({})
const adjustTarget = ref<ProductStockRow | null>(null)
const adjustNotes  = ref('')
const adjustError  = ref('')
const isAdjusting  = ref(false)

function openAdjustModal(row: ProductStockRow) {
  adjustTarget.value = row
  adjustNotes.value  = ''
  adjustError.value  = ''
}

async function confirmAdjust() {
  if (!adjustTarget.value || !adjustNotes.value.trim()) {
    adjustError.value = 'El motivo es obligatorio.'
    return
  }
  const delta = adjustDeltas[adjustTarget.value.id] ?? 0
  if (delta === 0) return
  const newStock = adjustTarget.value.stock + delta
  if (newStock < 0) {
    adjustError.value = `El stock resultante sería negativo (${newStock}). Ajusta el delta.`
    return
  }

  isAdjusting.value = true
  adjustError.value = ''
  try {
    await createAdjustment(adjustTarget.value.id, delta, adjustNotes.value.trim())
    // Optimistic local update
    const row = rows.value.find(r => r.id === adjustTarget.value!.id)
    if (row) {
      row.stock = newStock
      row.last_movement = { type: 'ajuste', quantity: delta, created_at: new Date().toISOString() }
    }
    adjustDeltas[adjustTarget.value.id] = 0
    adjustTarget.value = null
  } catch (e: unknown) {
    adjustError.value = e instanceof Error ? e.message : 'Error al guardar ajuste'
  } finally {
    isAdjusting.value = false
  }
}

// ── Historial slide-over ──────────────────────────────────────────────────────
const historialProduct    = ref<ProductStockRow | null>(null)
const movements           = ref<StockMovement[]>([])
const isLoadingMovements  = ref(false)

async function openHistorial(row: ProductStockRow) {
  historialProduct.value   = row
  isLoadingMovements.value = true
  movements.value          = []
  try {
    movements.value = await listMovements(row.id)
  } finally {
    isLoadingMovements.value = false
  }
}

// Compute stock_after for each movement (movements are newest-first from DB;
// reverse to accumulate oldest→newest, then index back)
function stockAfter(indexFromTop: number): number {
  if (!historialProduct.value) return 0
  // movements[0] is the latest; we want to show the stock resulting from each event
  // Accumulate from oldest (end of array) to newest
  const reversed = [...movements.value].reverse()
  let acc = 0
  const afterValues = reversed.map(m => { acc += m.quantity; return acc })
  afterValues.reverse()
  return afterValues[indexFromTop] ?? historialProduct.value.stock
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1)   return 'ahora'
  if (minutes < 60)  return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7)      return `hace ${days} días`
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/views/AdminStockView.vue
git commit -m "feat: add AdminStockView with table, inline adjust widget, and historial slide-over"
```

---

## Task 5: AdminStockNewReceiptView.vue

**Files:**
- Create: `src/modules/admin/views/AdminStockNewReceiptView.vue`

- [ ] **Step 1: Create the component**

Create `src/modules/admin/views/AdminStockNewReceiptView.vue`:

```vue
<template>
  <div class="max-w-3xl mx-auto px-8 py-8">

    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <RouterLink to="/admin/stock" class="hover:text-slate-600 transition-colors">Stock</RouterLink>
        <ChevronRight class="h-3 w-3" />
        <span class="text-slate-600">Nuevo ingreso</span>
      </div>
      <h1 class="text-2xl font-bold text-slate-900">Nuevo ingreso por lote</h1>
    </div>

    <!-- Page error -->
    <div v-if="pageError" class="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
      {{ pageError }}
    </div>

    <!-- Cabecera -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cabecera del ingreso</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="field-label">Referencia / Factura *</label>
          <input v-model="form.reference" type="text" class="field-input" placeholder="FAC-2026-001" />
        </div>
        <div>
          <label class="field-label">Proveedor</label>
          <input v-model="form.supplier" type="text" class="field-input" placeholder="Danfoss Colombia" />
        </div>
        <div class="col-span-2">
          <label class="field-label">Notas</label>
          <input v-model="form.notes" type="text" class="field-input" placeholder="Opcional…" />
        </div>
      </div>
    </div>

    <!-- Líneas de producto -->
    <div class="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Líneas de producto</h2>
        <button
          @click="showPicker = true"
          class="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
        >
          <Plus class="h-4 w-4" />
          Agregar producto
        </button>
      </div>

      <!-- Product picker combobox -->
      <div v-if="showPicker" class="mb-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref="pickerInput"
            v-model="pickerQuery"
            type="text"
            placeholder="Buscar por nombre o SKU…"
            class="w-full pl-9 pr-4 py-2.5 border border-brand-400 rounded-xl text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div v-if="pickerResults.length" class="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg max-h-52 overflow-y-auto">
          <button
            v-for="p in pickerResults"
            :key="p.id"
            @click="addLine(p)"
            class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
          >
            <div>
              <div class="text-sm font-semibold text-slate-900">{{ p.name }}</div>
              <div class="text-xs text-slate-400 font-mono">{{ p.sku }}</div>
            </div>
            <div class="text-xs text-slate-400 ml-4">Stock: {{ p.stock }}</div>
          </button>
        </div>
        <p v-else-if="pickerQuery.length > 1" class="mt-2 text-xs text-slate-400 px-1">Sin resultados</p>
        <button @click="showPicker = false; pickerQuery = ''" class="mt-2 text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
      </div>

      <!-- Line items table -->
      <template v-if="lines.length">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-slate-100">
              <th class="text-left pb-2 text-xs font-semibold text-slate-400">Producto</th>
              <th class="text-center pb-2 px-3 text-xs font-semibold text-slate-400 w-24">Cantidad</th>
              <th class="text-center pb-2 px-3 text-xs font-semibold text-slate-400 w-32">Costo/und</th>
              <th class="pb-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.product_id" class="border-b border-slate-50 last:border-0">
              <td class="py-3 pr-3">
                <div class="text-sm font-semibold text-slate-900">{{ line.name }}</div>
                <div class="text-xs text-slate-400 font-mono">{{ line.sku }}</div>
              </td>
              <td class="py-3 px-3 text-center">
                <input
                  v-model.number="line.quantity"
                  type="number"
                  min="1"
                  class="w-20 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </td>
              <td class="py-3 px-3 text-center">
                <div class="relative">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                  <input
                    v-model.number="line.cost_per_unit"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="—"
                    class="w-full pl-6 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </td>
              <td class="py-3 pl-2">
                <button @click="removeLine(line.product_id)" class="text-slate-300 hover:text-red-500 transition-colors">
                  <X class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Summary -->
        <div class="mt-4 px-4 py-3 bg-slate-50 rounded-xl flex items-center justify-between">
          <div class="text-xs text-slate-500">
            {{ lines.length }} {{ lines.length === 1 ? 'referencia' : 'referencias' }} ·
            {{ totalUnits }} {{ totalUnits === 1 ? 'unidad' : 'unidades' }}
          </div>
          <div class="text-sm font-bold text-slate-900">
            Total: ${{ totalCost.toLocaleString('es-CO') }}
          </div>
        </div>
      </template>
      <p v-else class="text-sm text-slate-400 py-2">Agrega al menos un producto para continuar.</p>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between">
      <RouterLink to="/admin/stock" class="text-sm text-slate-500 hover:text-slate-700 transition-colors">
        ← Cancelar
      </RouterLink>
      <button
        @click="handleSubmit"
        :disabled="isSaving || !canSubmit"
        class="flex items-center gap-2 px-6 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
      >
        <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
        Confirmar ingreso
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Plus, Search, X, ChevronRight, Loader2 } from '@lucide/vue'
import { listProductsWithStock, createReceipt, type ProductStockRow } from '@/modules/admin/services/stock.service'

const router = useRouter()

// ── Form state ────────────────────────────────────────────────────────────────
const form = reactive({ reference: '', supplier: '', notes: '' })

interface LineItem {
  product_id:    string
  name:          string
  sku:           string
  quantity:      number
  cost_per_unit: number | null
}

const lines     = ref<LineItem[]>([])
const pageError = ref('')
const isSaving  = ref(false)

const totalUnits = computed(() => lines.value.reduce((s, l) => s + (l.quantity || 0), 0))
const totalCost  = computed(() => lines.value.reduce((s, l) => s + (l.quantity || 0) * (l.cost_per_unit || 0), 0))
const canSubmit  = computed(() => form.reference.trim() && lines.value.length > 0 && lines.value.every(l => l.quantity >= 1))

// ── Product picker ────────────────────────────────────────────────────────────
const showPicker   = ref(false)
const pickerQuery  = ref('')
const pickerInput  = ref<HTMLInputElement | null>(null)
const allProducts  = ref<ProductStockRow[]>([])

// Load product catalogue once
;(async () => {
  try { allProducts.value = await listProductsWithStock() } catch { /* silent */ }
})()

// Auto-focus input when picker opens
watch(showPicker, async (v) => {
  if (v) { await nextTick(); pickerInput.value?.focus() }
})

const pickerResults = computed(() => {
  if (pickerQuery.value.length < 2) return []
  const q   = pickerQuery.value.toLowerCase()
  const ids = new Set(lines.value.map(l => l.product_id))
  return allProducts.value
    .filter(p => !ids.has(p.id) && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))
    .slice(0, 8)
})

function addLine(p: ProductStockRow) {
  lines.value.push({ product_id: p.id, name: p.name, sku: p.sku, quantity: 1, cost_per_unit: null })
  showPicker.value = false
  pickerQuery.value = ''
}

function removeLine(productId: string) {
  lines.value = lines.value.filter(l => l.product_id !== productId)
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function handleSubmit() {
  pageError.value = ''
  if (!form.reference.trim()) { pageError.value = 'La referencia es obligatoria.'; return }
  if (!lines.value.length)    { pageError.value = 'Agrega al menos un producto.'; return }
  if (lines.value.some(l => !l.quantity || l.quantity < 1)) {
    pageError.value = 'Todas las líneas deben tener cantidad ≥ 1.'
    return
  }

  isSaving.value = true
  try {
    await createReceipt({
      reference: form.reference.trim(),
      supplier:  form.supplier.trim(),
      notes:     form.notes.trim(),
      lines:     lines.value.map(l => ({
        product_id:    l.product_id,
        quantity:      l.quantity,
        cost_per_unit: l.cost_per_unit,
      })),
    })
    router.push('/admin/stock')
  } catch (e: unknown) {
    pageError.value = e instanceof Error ? e.message : 'Error al guardar el ingreso'
  } finally {
    isSaving.value = false
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

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/views/AdminStockNewReceiptView.vue
git commit -m "feat: add AdminStockNewReceiptView batch receipt form"
```

---

## Task 6: AdminProductFormView.vue — stock inicial integration

**Files:**
- Modify: `src/modules/admin/views/AdminProductFormView.vue`

The existing form has a `form.stock` field that directly sets stock on the product. In create mode only, we replace this with a `stockInicial` ref that creates the first movement after the product is saved, passing `stock: 0` in the product payload.

- [ ] **Step 1: Add stockInicial ref to the script**

In the `<script setup>` section of `src/modules/admin/views/AdminProductFormView.vue`, add the import and new ref after the existing imports:

```typescript
import { createInitialStockMovement } from '@/modules/admin/services/stock.service'

// New: for create mode only
const stockInicial = ref<number>(0)
```

- [ ] **Step 2: Replace stock field in the template (create mode only)**

In the "Precios y stock" section of the template, find the existing stock input:

```html
<div>
  <label class="field-label">Stock</label>
  <input v-model="form.stock" type="number" min="0" class="field-input" placeholder="0" />
</div>
```

Replace it with:

```html
<div>
  <label class="field-label">
    {{ isEditMode ? 'Stock' : 'Stock inicial' }}
  </label>
  <input
    v-if="isEditMode"
    v-model="form.stock"
    type="number"
    min="0"
    class="field-input"
    placeholder="0"
  />
  <input
    v-else
    v-model.number="stockInicial"
    type="number"
    min="0"
    class="field-input"
    placeholder="0"
  />
</div>
```

- [ ] **Step 3: Update handleSave to create initial movement**

In the `handleSave` function, find the create branch:

```typescript
if (isEditMode.value) {
  await updateProduct(route.params.id as string, payload)
} else {
  await createProduct(payload)
}
router.push('/admin/products')
```

Replace with:

```typescript
if (isEditMode.value) {
  await updateProduct(route.params.id as string, payload)
} else {
  // Always create with stock=0; initial stock is handled via movement ledger
  const newId = await createProduct({ ...payload, stock: 0 })
  if (stockInicial.value > 0) {
    await createInitialStockMovement(newId, stockInicial.value)
  }
}
router.push('/admin/products')
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/views/AdminProductFormView.vue
git commit -m "feat: integrate stock inicial field into product creation form"
```

---

## Self-Review

**Spec coverage check:**
- ✅ DB: `stock_receipts` + `stock_movements` + trigger + RLS → Task 1
- ✅ `products.stock` maintained by trigger (already exists, trigger added) → Task 1
- ✅ `stock.service.ts` with all four functions → Task 2
- ✅ `/admin/stock` + `/admin/stock/new` routes → Task 3
- ✅ Stock sidebar nav item → Task 3
- ✅ `AdminStockView` with search/filter, stock indicators, inline adjust widget, adjust mini-modal, historial slide-over → Task 4
- ✅ `AdminStockNewReceiptView` batch receipt form with combobox picker, line items, summary, submit → Task 5
- ✅ Product form `stockInicial` field on create → Task 6
- ✅ `createInitialStockMovement` uses `type: 'ajuste'` + `notes: 'Stock inicial'` (receipt_id null) → Tasks 2 & 6

**Type consistency:**
- `ProductStockRow` defined in Task 2, used in Tasks 4 and 5 ✅
- `StockMovement` defined in Task 2, used in Task 4 ✅
- `CreateReceiptInput` defined in Task 2, used in Task 5 ✅
- `createAdjustment(productId, delta, notes)` matches call site in Task 4 ✅
- `createInitialStockMovement(productId, qty)` matches call site in Task 6 ✅
- `createProduct` returns `Promise<string>` (existing, confirmed in `admin.service.ts`) ✅

**Placeholder scan:** No TBD, no TODOs, all code blocks complete.
