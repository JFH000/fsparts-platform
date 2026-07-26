# Checkout, Stripe Payments & Order Management — Design

## Context

FSP Parts is a Vue 3 + Vite + TS + Supabase B2B catalog for HVAC/R parts. The cart (`src/modules/cart/stores/cart.store.ts`) currently persists only to `localStorage`, and `/checkout` is a placeholder route pointing at the same `CartView.vue` component — there is no real payment flow. This design adds: a real checkout flow that charges through Stripe, a permanent order record, an order-status pipeline the admin manages, a customer-facing order history, and a new admin "Ventas" (Sales) view.

**Pre-existing gap this design fixes:** `cart.store.ts`'s `subtotal` computed and `CartView.vue`'s per-item price both use `item.product.priceCop ?? item.product.priceUsd ?? 0` directly — this ignores the wholesale tier pricing (`price_ws1`-`price_ws4`) that `useProductPrice.ts` already implements for the catalog and product-detail views. A `customer_ws1`/`customer_ws3` user currently sees the wrong (retail) price in their cart. This must be fixed as part of this work, since checkout must charge the same price the customer sees.

## Goals

- Customer can pay for their cart via Stripe Checkout (hosted page), with correct role-tiered pricing.
- Orders are recorded permanently, associated with the buyer, with a snapshot of what was actually charged.
- Admin gets a new "Ventas" view to see orders and advance them through a fulfillment pipeline.
- Customer gets a "Mis pedidos" view to see their own order history.
- Pricing is never trusted from the client — the server (an Edge Function) always recomputes the amount to charge from the database.

## Non-Goals (explicitly out of scope for this iteration)

- Automated refunds from the admin panel (cancel = status change in-app; actual Stripe refund is done manually in the Stripe Dashboard).
- Automatic stock decrement on payment (admin adjusts `products.stock` manually, as today).
- Guest checkout (login is required to check out).
- Hardcoding specific local payment methods (PSE, etc.) into the Checkout Session — whatever is enabled on the Stripe account's dashboard is what customers see, no code-level restriction.
- A reconciliation job for missed webhook deliveries — v1 relies on Stripe's own built-in webhook retry behavior (it retries failed deliveries for several hours) rather than a polling/reconciliation mechanism on our side.

## A. End-to-End Flow

```
Carrito (/cart)
   │ "Proceder al checkout"
   ▼
Checkout (/checkout) — order summary + shipping address form
   │ requires login (if not authenticated → AuthModal, login mode)
   │ "Pagar con Stripe →"
   ▼
Edge Function: create-checkout-session
   │ recomputes price PER LINE ITEM server-side (never trusts client prices)
   │ inserts `orders` row with status = 'pending_payment'
   │ creates a Stripe Checkout Session, order_id stored in session metadata
   ▼
Stripe Checkout (hosted page) — customer pays
   │
   ├─ success ──────────────► /pedido-confirmado?session_id=...
   │                              (shows summary; if the webhook hasn't
   │                               landed yet, shows a brief "confirming"
   │                               state and retries a few times)
   └─ cancel ───────────────► back to /checkout (cart untouched)

   (in parallel, async)
Stripe ──webhook──► Edge Function: stripe-webhook
                        verifies Stripe signature, flips order to 'paid'

The customer can see all their orders later at /orders ("Mis pedidos").
The admin manages all orders at /admin/sales ("Ventas").
```

**Why the price is recomputed server-side:** the cart lives in client-controlled `localStorage`. If checkout sent "charge $X for this line" and the server trusted it, anyone could edit `localStorage` and buy a compressor for $1. The `create-checkout-session` Edge Function receives only `{ product_id, quantity }` pairs — it independently looks up the authenticated caller's role and each product's current prices in the database, and computes the tiered price using the same rules `useProductPrice.ts` already implements (WS1/WS2 for `customer_ws1` with a ≥10-unit bulk threshold, WS3/WS4 for `customer_ws3`, `price_cop` for `customer`).

## B. Data Model

One new table, `orders`. Line items are stored as a JSONB snapshot (matching the existing convention of `products.specs`), so an order always shows what was actually charged even if the underlying product's price, name, or existence changes later.

```sql
create table public.orders (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id),
  status                      text not null default 'pending_payment'
                               check (status in (
                                 'pending_payment', 'paid', 'preparing',
                                 'shipped', 'delivered', 'cancelled'
                               )),
  items                       jsonb not null,   -- [{product_id, sku, name, image, unit_price, quantity, line_total}]
  subtotal                    numeric not null,
  currency                    text not null default 'COP',
  shipping_name               text not null,
  shipping_phone              text not null,
  shipping_address            text not null,
  shipping_city               text not null,
  shipping_notes              text,
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  created_at                  timestamptz not null default now(),
  paid_at                     timestamptz
);
```

**Status pipeline** (post-payment, admin-managed): `paid → preparing → shipped → delivered`, plus `cancelled` reachable from any of those. `pending_payment` is a pre-payment state the customer never explicitly sees as "their order" — it exists so the Stripe session can reference a real row via `metadata.order_id`, and becomes `paid` once the webhook fires. Abandoned/expired sessions simply leave a `pending_payment` row behind (harmless, filtered out of the admin's default view).

**RLS policies:**
- `SELECT`: customer sees their own orders (`user_id = auth.uid()`), admin sees all (`is_admin()`).
- `INSERT`: no policy for `anon`/`authenticated` — only the `create-checkout-session` Edge Function (using the `service_role` key, which bypasses RLS) can create an order row.
- `UPDATE`: `is_admin()` only (for advancing/cancelling status from the Ventas panel). The webhook also uses `service_role`, so it doesn't need a policy of its own.
- `DELETE`: none. Orders are a permanent record; "cancelled" is a status, not a deletion.

This mirrors the security posture already established for `stock_movements`/`app_settings` before their removal: the client never writes this table directly, everything routes through a trusted server-side function.

## C. Backend: Edge Functions

### `create-checkout-session` (`verify_jwt: true`)

1. Receives `{ items: [{product_id, quantity}], shipping: {name, phone, address, city, notes} }` — quantities and product IDs only, never prices.
2. Resolves the caller's identity from the JWT, reads their `role` from `user_profiles`.
3. Looks up each `product_id` in `products`, computes the effective per-line price using the same tier rules as `useProductPrice.ts` (this logic is necessarily duplicated in Deno/TypeScript on the Edge Function side — the implementation plan should keep the two copies' rules explicitly cross-referenced/commented so they can't silently drift).
4. If a product no longer exists or has no resolvable price, that line is dropped and the response tells the client which item(s) were removed, before ever creating a Stripe session for it.
5. Inserts the `orders` row with `status = 'pending_payment'` and the computed items snapshot.
6. Creates the Stripe Checkout Session: `mode: 'payment'`, currency `cop` (a standard 2-decimal currency in Stripe, *not* zero-decimal — `unit_amount` is the whole-peso price ×100, i.e. centavos; verified directly against Stripe's currency docs during implementation after an earlier draft of this spec incorrectly assumed COP was zero-decimal like JPY/KRW), `metadata: { order_id }`, `success_url`/`cancel_url` pointing at the frontend routes below.
7. Returns `{ url }`; the client does a full-page redirect (`window.location.href = url`). No Stripe.js / `@stripe/stripe-js` package is needed client-side since we never mount Stripe Elements.

### `stripe-webhook` (`verify_jwt: false`)

Stripe calls this directly with no user JWT — authenticity is verified via the `Stripe-Signature` header against the webhook signing secret, not Supabase auth.

1. Verify the event signature.
2. On `checkout.session.completed`: look up the order by `metadata.order_id`, set `status = 'paid'`, store `stripe_payment_intent_id`, set `paid_at = now()`. The update is idempotent — safe if Stripe redelivers the event.
3. Other event types (e.g. `checkout.session.expired`) are ignored; the order simply stays `pending_payment`.

### Why not Supabase's official Stripe integrations

Supabase offers two official Stripe integrations, both considered and rejected for this design:
- **Stripe Wrapper (FDW):** read-only — exposes Stripe objects as foreign tables for querying, cannot create a Checkout Session (a multi-parameter API action, not a queryable resource). Also requires its own private schema + `security definer` functions to expose safely (no RLS on foreign tables). Not needed since the webhook already gives authoritative payment status.
- **Stripe Sync Engine (alpha):** a standalone Docker/Fastify service that mirrors the *entire* Stripe object graph (customers, charges, invoices, subscriptions, prices...) into Postgres — cannot run as a Supabase Edge Function, needs separate hosting this project doesn't have, and Supabase's own repo warns it "lacks tight access controls, should only be deployed internally." Overkill for reacting to a single event type.

Both custom Edge Functions below remain the right fit: no added infrastructure, minimal attack surface, exactly the two operations (create a session, react to one webhook event) this flow needs.

### Required secrets

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be set as Supabase Edge Function secrets. As with the earlier `sync-sheets` function, this environment has no local Supabase CLI and the connected MCP toolset has no secrets-management tool discovered so far — setting these, and configuring the webhook endpoint URL in the Stripe Dashboard, will likely be a manual step for the user, to be confirmed during implementation.

## D. Frontend

### Fix: `cart.store.ts` tiered pricing

Extract the pure calculation currently inside `useProductPrice.ts` into a plain function (e.g. `resolveEffectivePrice(product, qty, role)`) usable outside a component's reactive setup context. `useProductPrice` becomes a thin reactive wrapper around it (for catalog/detail views); `cart.store.ts`'s `subtotal` and `CartView.vue`'s per-item price call the plain function directly with `authStore.profile?.role`. This guarantees the price shown in the cart, the checkout summary, and what the Edge Function actually charges are always the same calculation.

### `/checkout` (replaces the current placeholder that points at `CartView.vue`)

- Read-only order summary: items, quantity, effective tiered unit price, subtotal.
- Shipping form: name, phone, address, city, optional notes.
- "Pagar con Stripe →" button: validates the form, calls `create-checkout-session`, redirects to the returned URL.
- Requires login: reintroduces the `meta: { requiresUser: true }` route flag (checks `isAuthenticated` only, not `isAdmin` — distinct from the existing `requiresAuth` meta used by `/admin`) on this route and on `/orders`. This is the exact same flag/guard-branch name a prior cleanup pass removed from `router/index.ts` as dead code (it was legitimately unused at the time — nothing set it); this feature is its first real consumer, so the `router.beforeEach` branch is reintroduced verbatim. If not authenticated when landing on `/checkout` or clicking "Pagar", opens `AuthModal` in login mode, matching the pattern the removed favorites feature used to use.

### `/pedido-confirmado?session_id=...`

- Looks up the order by `stripe_checkout_session_id`. If it's still `pending_payment` (webhook can lag slightly behind the redirect), shows a brief "Confirmando tu pago…" state and retries a few times before settling on a non-blocking "te notificaremos" message.
- Links to "Ver mis pedidos" and "Seguir comprando".

### `/orders` — "Mis pedidos" (customer)

- List of the user's own orders: date, item count/thumbnail, total, status badge. Click through to a detail view (items, shipping address, status, Stripe reference).
- Replaces "Mis favoritos" in `ProfileDropdown.vue` — same menu slot.
- Empty state: "Aún no tienes pedidos" + link to the catalog.

### `/admin/sales` — "Ventas" (admin)

- New sidebar item in `AdminLayout.vue`, alongside Productos/Catálogo/Clientes.
- Same list + slide-over detail panel pattern as `AdminCustomersView.vue`: table columns (cliente, fecha, items, total, estado badge), search, status filter.
- Slide-over panel: full item breakdown, shipping address, customer contact, Stripe reference link, and controls to advance the status pipeline (`paid → preparing → shipped → delivered`) or cancel.
- Default view hides `pending_payment` orders (abandoned carts that never completed payment) to keep the list focused on real sales.

## E. Edge Cases

- **Priceless product ("Consultar precio") in cart:** currently addable to cart and silently contributes $0 to the subtotal — closed at the source by disabling "Agregar al carrito" whenever the effective price resolves to `null`, rather than special-casing it at checkout.
- **Product deleted or unavailable between add-to-cart and payment:** the Edge Function validates existence when building line items; a missing product is dropped from the order with the customer informed before any Stripe session is created — no charge for something invalid. Stock availability itself is not checked (matches the decision that stock isn't auto-managed by this flow).
- **Card declined / payment abandoned:** handled inside Stripe's own hosted page; if the customer leaves, they land back on `cancel_url` (`/checkout`) with their cart intact. The order row stays `pending_payment`.
- **Duplicate or out-of-order webhook delivery:** the `paid` transition is idempotent; nothing depends on event ordering.
- **Customer closes the tab right after paying, before `/pedido-confirmado` loads:** no impact — the webhook already marked the order `paid` independent of whether the browser reached the confirmation page; it shows up correctly in "Mis pedidos" regardless.

## Open Item Requiring the User

Setting `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` as Edge Function secrets and registering the webhook URL in the Stripe Dashboard may require manual action outside available tooling — to be confirmed at implementation time (same category of gap as the `sync-sheets` Edge Function's pending manual deletion from an earlier change).
