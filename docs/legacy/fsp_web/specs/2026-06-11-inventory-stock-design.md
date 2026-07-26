# Inventory Stock Management — Design Spec

**Date:** 2026-06-11
**Status:** Approved

---

## Goal

Add a stock management module to the FSP Parts admin panel that functions as a lightweight accounting ledger: every unit that enters or leaves inventory is recorded with its origin, cost, and responsible admin. Admins can receive batch purchase orders, make quick adjustments, and inspect the full movement history per product.

---

## Scope

This spec covers:
1. Database schema (new tables + Postgres trigger)
2. Single `/admin/stock` route with inline adjust widget
3. Batch receipt form (`/admin/stock/new`)
4. Per-product movement history slide-over
5. Product form integration (stock inicial on new product)

Out of scope: customer-facing stock display changes, stock reservation on cart, low-stock notifications.

---

## Data Model

### New table: `stock_receipts`

Represents a single purchase order receipt (a batch of products received from a supplier).

```sql
CREATE TABLE stock_receipts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   TEXT NOT NULL,         -- e.g. "FAC-2026-042"
  supplier    TEXT,
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### New table: `stock_movements`

One row per unit-event. Every change to `products.stock` is backed by a row here.

```sql
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id),
  receipt_id      UUID REFERENCES stock_receipts(id),  -- null for ajuste
  quantity        INTEGER NOT NULL,                    -- positive or negative
  cost_per_unit   NUMERIC(12,2),                       -- null for ajuste
  type            TEXT NOT NULL CHECK (type IN ('ingreso', 'ajuste')),
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Movement types:**
- `ingreso` — always positive; always linked to a `stock_receipt`; records cost per unit
- `ajuste` — positive or negative; standalone (no receipt); used for physical count corrections

### `products.stock` column

Add `stock INTEGER NOT NULL DEFAULT 0` to the `products` table if not already present.

Maintained by a Postgres trigger that fires `AFTER INSERT ON stock_movements`, adding `NEW.quantity` to `products.stock` atomically. This is the only way `products.stock` changes — never updated directly.

```sql
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_product_stock
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_stock();
```

### RLS policies

- `stock_receipts`: admins can SELECT/INSERT/UPDATE. No public access.
- `stock_movements`: admins can SELECT/INSERT. No UPDATE/DELETE (immutable ledger).
- `products.stock` is readable by all (existing SELECT policy covers it).

---

## UI

### Route structure

```
/admin/stock          → AdminStockView.vue     (main table + slide-over)
/admin/stock/new      → AdminStockNewReceiptView.vue  (batch receipt form)
```

One sidebar entry: **Stock** (with `Package` icon from lucide-vue-next), inserted between Catálogo and Clientes in `AdminLayout.vue`.

---

### AdminStockView — Main table

**Header:**
- Title: "Stock"
- Subtitle: "N productos · última actualización hace X min"
- Button (Blueprint Indigo): "Nuevo ingreso por lote" → navigates to `/admin/stock/new`

**Filter bar:**
- Search input (SKU o nombre)
- Pills: Todos · Stock bajo · Sin stock

**Table columns:**
| Producto | Línea | Stock actual | Ajuste rápido | Último movimiento | — |
|---|---|---|---|---|---|

**Stock indicators:**
- `stock === 0`: gray number
- `stock > 0 && stock <= 5`: amber number + "⚠" suffix (Thermal Orange token)
- `stock > 5`: black number

**Ajuste rápido widget** (inline per row):
- `[−] [input] [+]` spinner, default value 0
- `[✓]` confirm button (Blueprint Indigo)
- On confirm: open a mini-modal asking for "Motivo del ajuste" (text, required), then POST `stock_movements` with `type: 'ajuste'`, `quantity: delta`, `notes: motivo`.
- Optimistic local update of `stock` in the table row.

**Historial →** link (last column): opens the per-product slide-over.

---

### AdminStockNewReceiptView — Batch receipt form

**Layout:** full-page (not a modal), with "← Volver" nav link.

**Cabecera section:**
- `reference` (text, required) — e.g. "FAC-2026-042"
- `supplier` (text, optional)
- `notes` (text, optional)

**Líneas de producto section:**
- "Agregar producto" button opens a searchable product picker (combobox filtered by name/SKU from existing `products`)
- Each added product becomes a table row with:
  - Product name + SKU (read-only)
  - `quantity` (integer input, required, min 1)
  - `cost_per_unit` (numeric input, optional — for accounting record)
  - `×` remove button
- Running summary: "N referencias · M unidades totales · Total: $X"

**On submit:**
1. INSERT `stock_receipts` → get `receipt_id`
2. INSERT all `stock_movements` in a single batch (one row per line item, `type: 'ingreso'`, linked to `receipt_id`)
3. Trigger fires, updating each product's `stock` atomically
4. Navigate back to `/admin/stock`

---

### Historial slide-over

**Trigger:** clicking "Historial →" on any product row.

**Panel (w-96, fixed right, Teleport to body):**
- Header: product name + SKU + current stock (large number)
- Section title: "HISTORIAL DE MOVIMIENTOS"
- List in reverse chronological order; each item:
  - Delta badge: `+N` green background / `−N` red background
  - Type + reference: "Ingreso · FAC-2026-042" or "Ajuste · Conteo físico"
  - Subline: supplier + cost/unit (ingreso) OR notes (ajuste)
  - Right: "→ stock_after" + relative timestamp
- Bottom of list: "Stock inicial" entry (the `stock` value at product creation, if a founding movement was recorded)

**Close:** Escape key, backdrop click, or explicit × button.

---

### Product form integration

`AdminProductFormView.vue` (new product creation only) gains a **"Stock inicial"** numeric field (integer, default 0, min 0).

On save, if `stock_inicial > 0`:
1. Create the product (existing flow)
2. Immediately INSERT one `stock_movements` row: `type: 'ingreso'`, `quantity: stock_inicial`, `cost_per_unit: null`, `notes: 'Stock inicial'`, `receipt_id: null`

This ensures even the founding stock entry appears in the movement ledger.

---

## Services

### `src/modules/admin/services/stock.service.ts`

```typescript
// Queries
listProductsWithStock(): Promise<ProductStockRow[]>
listMovements(productId: string): Promise<StockMovement[]>

// Mutations
createReceipt(data: CreateReceiptInput): Promise<void>
  // data: { reference, supplier?, notes?, lines: { product_id, quantity, cost_per_unit? }[] }
createAdjustment(productId: string, delta: number, notes: string): Promise<void>
```

`ProductStockRow` extends the existing `Product` type with `stock: number` and `last_movement: { type, quantity, created_at } | null`.

---

## Files

| Action | File |
|---|---|
| Create | `supabase/migrations/20260611_stock_tables.sql` |
| Modify | `supabase/schema.sql` |
| Create | `src/modules/admin/services/stock.service.ts` |
| Create | `src/modules/admin/views/AdminStockView.vue` |
| Create | `src/modules/admin/views/AdminStockNewReceiptView.vue` |
| Modify | `src/modules/admin/views/AdminProductFormView.vue` (add stock inicial field) |
| Modify | `src/modules/admin/layouts/AdminLayout.vue` (add Stock nav item) |
| Modify | `src/router/index.ts` (add /admin/stock routes) |

---

## Decisions log

| Question | Decision | Reason |
|---|---|---|
| Ledger style | Full accounting (cost, document, responsible) | Chosen option A — enables future reporting |
| Receipt model | Batch (multi-product per lote) | Chosen option B — matches how HVAC/R distributors buy |
| Movement types | ingreso + ajuste only | Chosen option C — no sale deduction for now |
| Product form | Integrated stock inicial field | Chosen option A — no orphan stock at product creation |
| Navigation | Single `/admin/stock` view | Chosen option C — simplest, scalable enough |
| Stock column | Postgres-maintained via trigger | Avoids inconsistency from client-side counting |
