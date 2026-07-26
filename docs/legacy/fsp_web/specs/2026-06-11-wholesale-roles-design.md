# Wholesale Pricing Roles & Admin Customer View

**Date:** 2026-06-11  
**Status:** Approved  
**Scope:** Two new customer roles (`customer_ws1`, `customer_ws3`), quantity-based price resolution, admin customer management view.

---

## Overview

FSP Parts needs a B2B wholesale pricing tier system. Admins manually assign one of two wholesale roles to customers. The role, combined with order quantity, determines which of four pre-existing price columns (`price_ws1`–`price_ws4`) is displayed to that customer. Regular customers and unauthenticated users always see the base price. Admins need a new `/admin/customers` view to search, filter, and assign roles to users.

---

## 1. Database Migration

### Role constraint extension

Extend the `user_profiles_role_check` constraint from `('admin', 'customer')` to include the two new roles:

```sql
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'customer', 'customer_ws1', 'customer_ws3'));
```

### Notes column

Add an internal-notes field to `user_profiles` for admin use:

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notes TEXT;
```

### RLS policy fixes

Three changes to Row Level Security:

**1. Admin can read all profiles (SELECT)**
```sql
DROP POLICY "own_profile_select" ON user_profiles;
CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());
```

**2. Customers cannot change their own role (UPDATE — non-admin)**
```sql
DROP POLICY "own_profile_update" ON user_profiles;
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT is_admin())
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT up.role FROM user_profiles up WHERE up.id = auth.uid())
  );
```
The subquery reads the committed role value before the mutation. If the new `role` differs from the current value, the check fails and the operation is rejected at the database level.

**3. Admins can update any profile including role (UPDATE — admin)**
```sql
CREATE POLICY "admin_profile_update" ON user_profiles FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

With two permissive UPDATE policies, PostgreSQL OR's their USING and WITH CHECK clauses:
- Non-admin hits `own_profile_update` only (is_admin() = false eliminates the admin policy)
- Admin hits `admin_profile_update` (no role-field restriction)

---

## 2. TypeScript Types

**`src/shared/types/index.ts`** — align `UserRole` to actual DB constraint:

```typescript
// Before (stale — includes technician/distributor which don't exist in DB)
export type UserRole = 'customer' | 'technician' | 'distributor' | 'admin'

// After
export type UserRole = 'admin' | 'customer' | 'customer_ws1' | 'customer_ws3'
```

No other type changes needed — `Product` already has `priceWs1`–`priceWs4` fields and `UserProfile` already uses `UserRole`.

---

## 3. Price Resolution Composable

**New file:** `src/modules/catalog/composables/useProductPrice.ts`

### Interface

```typescript
interface PriceResult {
  effectivePrice: ComputedRef<number | null>  // price to display
  basePrice: ComputedRef<number | null>       // original price for strikethrough (null if not discounted)
  isDiscounted: ComputedRef<boolean>
  tierLabel: ComputedRef<string | null>       // 'WS1' | 'OEM' | null
  bulkPrice: ComputedRef<number | null>       // next-tier price (shown as "+10 uds: $X"), null if already at top tier or not applicable
  bulkThreshold: ComputedRef<number>          // always 10
}

function useProductPrice(
  product: Ref<Product | null | undefined>,
  qty?: Ref<number>   // defaults to ref(1) if omitted
): PriceResult
```

### Resolution logic

| Role | qty 1–9 | qty ≥ 10 | `tierLabel` |
|---|---|---|---|
| `customer` / unauthenticated | `price_cop ?? price_usd` | same | `null` |
| `customer_ws1` | `price_ws1` | `price_ws2` | `'WS1'` |
| `customer_ws3` | `price_ws3` | `price_ws4` | `'OEM'` |
| `admin` | `price_cop ?? price_usd` | same | `null` |

**Fallback rules:**
- If `price_ws1` is `null` for a product, `effectivePrice` falls back to `price_cop ?? price_usd`
- `isDiscounted` is `true` only when `effectivePrice < basePrice` (both non-null)
- `bulkPrice` is `null` when already in the upper tier (qty ≥ 10) or when the bulk column is null
- `basePrice` is only exposed (non-null) when `isDiscounted = true`; otherwise `null`

### Usage pattern

```typescript
// ProductCard (qty always 1)
const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } = useProductPrice(
  computed(() => props.product)
)

// ProductDetailView (qty reactive)
const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } = useProductPrice(product, qty)
```

---

## 4. Price Display — ProductCard

The current price display block is replaced. When `isDiscounted`:

```
~~COP $85.000~~        ← basePrice, strikethrough, text-slate-400
COP $62.000  [WS1]    ← effectivePrice bold + AppBadge tier label
+10 uds: $54.000      ← bulkPrice hint, text-xs text-slate-500 (only if bulkPrice != null)
```

When not discounted (regular customer):
```
COP $85.000           ← unchanged current behavior
```

Unauthenticated users and regular customers see no change from the current UI.

---

## 5. Price Display — ProductDetailView

The price box (`bg-white rounded-2xl p-5 border border-slate-200`) receives the same composable, but `qty` is the reactive quantity ref already used by the quantity selector. The price updates in real-time as qty changes:

```
qty 1–9:   ~~$85.000~~  $62.000  [WS1]    "+10 uds: $54.000"
qty 10+:   ~~$85.000~~  $54.000  [WS2 ×10]   (bulkPrice line hidden — already at top tier)
```

The tier badge changes from `WS1` to `WS2 ×10` (or `OEM` to `OEM ×10`) when the quantity crosses 10. A subtle transition on the price number communicates the change.

---

## 6. Admin Customers View

### New files

| File | Purpose |
|---|---|
| `src/modules/admin/services/customers.service.ts` | Supabase queries for user management |
| `src/modules/admin/views/AdminCustomersView.vue` | The view |

### customers.service.ts

```typescript
listCustomers(opts?: { search?: string; role?: UserRole | 'all' }): Promise<CustomerRow[]>
updateCustomerRole(userId: string, role: UserRole): Promise<void>
updateCustomerNotes(userId: string, notes: string): Promise<void>
```

`CustomerRow` shape: `{ id, email, full_name, phone, company, role, notes, created_at }`.

`listCustomers` applies `ilike` on `full_name`, `email`, `company` when `search` is present, and `eq('role', role)` when `role !== 'all'`. Results ordered by `created_at` descending.

### AdminCustomersView layout

```
┌────────────────────────────────────────────────────────────┐
│  Clientes          [🔍 Buscar nombre, email, empresa...]   │
│                                                            │
│  Todos[12]  customer[8]  WS1[3]  OEM[1]  Admin[1]        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ JG  Juan García     juan@co  Frigomec    [WS1  ▾] │   │
│  │ MP  María Pérez     mp@co    —           [customer▾]│  │
│  │ ...                                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  [Fila seleccionada → panel lateral o modal]               │
│  ┌──────────────────────────────────────┐                 │
│  │  Juan García · juan@empresa.co       │                 │
│  │  Empresa: Frigomec · Tel: 310...     │                 │
│  │  Miembro desde: 15 mar 2026          │                 │
│  │  Rol: [WS1           ▾]              │                 │
│  │  Notas internas:                     │                 │
│  │  [________________________________]  │                 │
│  │                         [Guardar]    │                 │
│  └──────────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────┘
```

**Table columns:** Avatar initials chip (color determinístico del nombre), nombre + email, empresa, rol badge (gris=customer, azul=WS1, naranja=OEM, rojo=admin), dropdown de rol.

**Role badge colors:**
- `customer` → `bg-slate-100 text-slate-600`
- `customer_ws1` → `bg-brand-50 text-brand-700` (Blueprint Indigo)
- `customer_ws3` → `bg-accent-50 text-accent-600` (Thermal Orange)
- `admin` → `bg-red-50 text-red-600`

**Detail panel:** Slide-over panel from the right (`position: fixed`, `w-96`, `z-50`), with a semi-transparent backdrop. Explicit "Guardar" button — no auto-save. Role dropdown shows all four valid roles. Notes is a `<textarea>` (4 rows). The panel closes on Escape or clicking the backdrop.

**Security note:** The role dropdown in the UI is purely cosmetic security. The actual enforcement is the `admin_profile_update` RLS policy — if a non-admin somehow calls `updateCustomerRole`, the database rejects it regardless of what the frontend allows.

### Router & navigation

`router/index.ts` — add under `/admin` children:
```typescript
{ path: 'customers', name: 'admin-customers', component: () => import('@/modules/admin/views/AdminCustomersView.vue') }
```

`AdminLayout.vue` — add nav item:
```typescript
{ to: '/admin/customers', label: 'Clientes', icon: Users }
```

---

## Implementation order

1. DB migration (Supabase MCP) — unblocks everything else
2. `UserRole` type update
3. `useProductPrice` composable + unit-level verification
4. Update `ProductCard` price display
5. Update `ProductDetailView` price display
6. `customers.service.ts`
7. `AdminCustomersView.vue`
8. Router + AdminLayout nav item
