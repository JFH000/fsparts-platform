# Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new monorepo, `fsparts-platform`, containing a shared design-token/UI-kit package (`@fsparts/ui`), a shared Supabase/auth package (`@fsparts/core`) with cross-subdomain SSO, and three minimal Vue app shells (`apps/shop`, `apps/calculator`, `apps/dashboard`) that prove the shared brand shell (header, app switcher, footer) and shared session work end to end before any real feature code is migrated from `fsp_web`.

**Architecture:** npm workspaces monorepo with `packages/ui`, `packages/core`, and three `apps/*` Vite+Vue projects. Packages have no separate build step — Vite compiles their source directly as part of each consuming app's build via `resolve.alias`. Design tokens are ported verbatim from `fsp_web`'s `src/style.css`/`DESIGN.md`. The Supabase client's `auth.storage` is swapped for a cookie-backed adapter scoped to `.fsparts.org` in production, falling back to `localStorage` locally.

**Tech Stack:** Vue 3.5, Vite 8, Vue Router 4.6, Pinia 3, Tailwind CSS v4 (`@tailwindcss/vite`), `@supabase/supabase-js` 2.106, `@lucide/vue`, `@vueuse/core`, TypeScript ~6.0, Vitest 4 + `@vue/test-utils` + jsdom, npm workspaces.

## Global Constraints

- New repo, created from scratch (not migrated in place from `fsp_web`), located at `C:\Users\juanf\fs\fsparts-platform`.
- npm workspaces only — no Turborepo or other build-caching layer for this phase.
- Workspace packages are named `@fsparts/ui` and `@fsparts/core`; apps are named `shop`, `calculator`, `dashboard` under `apps/`.
- Design tokens must match `fsp_web`'s existing values exactly: `--color-brand-700: #1d4ed8` (Blueprint Indigo), `--color-accent-500: #f97316` (Thermal Orange), full ramp as in `fsp_web/src/style.css`.
- Cross-subdomain session cookie: `Domain=.fsparts.org; Path=/; Secure; SameSite=Lax`, written only when `hostname` is `fsparts.org` or ends with `.fsparts.org`; every other hostname (including `localhost`) falls back to `window.localStorage`.
- The app switcher shows the "Dashboard" entry only when `useAuthStore().isAdmin` is `true`; "Shop" and "Calculadora" are always visible.
- Brand name format in the header is literally `fsparts <AppLabel>` — "fsparts Shop", "fsparts Calculadora", "fsparts Dashboard".
- Do not migrate real feature code (catalog, cart, checkout, orders, landing, hvac calculator logic, admin CRUD) in this plan — each `apps/*` gets only a placeholder home view.
- Do not create Vercel projects or attach `*.fsparts.org` domains — produce `vercel.json` per app and stop there.
- Dependency versions must match `fsp_web/package.json` exactly: `vue@^3.5.34`, `vue-router@^4.6.4`, `pinia@^3.0.4`, `@supabase/supabase-js@^2.106.2`, `@lucide/vue@^1.17.0`, `@vueuse/core@^14.3.0`, `@tailwindcss/vite@^4.3.0`, `tailwindcss@^4.3.0`, `vite@^8.0.12`, `@vitejs/plugin-vue@^6.0.6`, `typescript@~6.0.2`, `vue-tsc@^3.2.8`, `vitest@^4.1.8`, `@vue/test-utils@^2.4.11`, `@vue/tsconfig@^0.9.1`, `jsdom@^29.1.1`, `@types/node@^24.12.3`.

All file paths below are relative to the new repo root, `C:\Users\juanf\fs\fsparts-platform`, unless stated otherwise.

---

### Task 1: Repo init, root workspace config, and `@fsparts/core`'s cross-subdomain storage adapter

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `vitest.config.ts` (root)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/cookieStorage.ts`
- Test: `packages/core/src/cookieStorage.test.ts`
- Test: `packages/core/src/cookieStorage.localhost.test.ts`

**Interfaces:**
- Produces: `shouldUseCookies(hostname: string): boolean`, `createSessionStorage(hostname?: string): CookieStorage`, `interface CookieStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }` — all from `packages/core/src/cookieStorage.ts`.

- [ ] **Step 1: Create the new repo and root workspace files**

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform" && cd "C:\Users\juanf\fs\fsparts-platform" && git init
```

Create `.gitignore`:

```
node_modules/
dist/
.env
.env.local
*.local
.DS_Store
```

Create `package.json`:

```json
{
  "name": "fsparts-platform",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev:shop": "npm run dev --workspace=apps/shop",
    "dev:calculator": "npm run dev --workspace=apps/calculator",
    "dev:dashboard": "npm run dev --workspace=apps/dashboard",
    "build:shop": "npm run build --workspace=apps/shop",
    "build:calculator": "npm run build --workspace=apps/calculator",
    "build:dashboard": "npm run build --workspace=apps/dashboard"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@types/node": "^24.12.3",
    "@vitejs/plugin-vue": "^6.0.6",
    "@vue/test-utils": "^2.4.11",
    "@vue/tsconfig": "^0.9.1",
    "jsdom": "^29.1.1",
    "tailwindcss": "^4.3.0",
    "typescript": "~6.0.2",
    "vite": "^8.0.12",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.2.8"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('./packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
    },
  },
  test: { environment: 'node' },
})
```

- [ ] **Step 2: Scaffold `packages/core`**

Create `packages/core/package.json`:

```json
{
  "name": "@fsparts/core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.106.2",
    "pinia": "^3.0.4",
    "vue": "^3.5.34"
  }
}
```

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write the failing tests for the storage adapter**

Create `packages/core/src/cookieStorage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldUseCookies } from './cookieStorage'

describe('shouldUseCookies', () => {
  it('is true for the apex domain', () => {
    expect(shouldUseCookies('fsparts.org')).toBe(true)
  })

  it('is true for any *.fsparts.org subdomain', () => {
    expect(shouldUseCookies('shop.fsparts.org')).toBe(true)
    expect(shouldUseCookies('calculator.fsparts.org')).toBe(true)
    expect(shouldUseCookies('dashboard.fsparts.org')).toBe(true)
  })

  it('is false for localhost', () => {
    expect(shouldUseCookies('localhost')).toBe(false)
  })

  it('is false for a domain that merely ends with the substring "fsparts.org"', () => {
    expect(shouldUseCookies('evilfsparts.org')).toBe(false)
  })
})
```

Create `packages/core/src/cookieStorage.localhost.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createSessionStorage } from './cookieStorage'

describe('createSessionStorage on localhost', () => {
  it('falls back to window.localStorage and round-trips values', () => {
    const storage = createSessionStorage('localhost')
    storage.setItem('sb-test-auth-token', 'abc123')
    expect(storage.getItem('sb-test-auth-token')).toBe('abc123')
    expect(window.localStorage.getItem('sb-test-auth-token')).toBe('abc123')
    storage.removeItem('sb-test-auth-token')
    expect(storage.getItem('sb-test-auth-token')).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npm install && npx vitest run packages/core/src/cookieStorage`
Expected: FAIL — `Cannot find module './cookieStorage'` (file doesn't exist yet).

- [ ] **Step 5: Implement the storage adapter**

Create `packages/core/src/cookieStorage.ts`:

```ts
const COOKIE_DOMAIN = '.fsparts.org'
const APEX_DOMAIN = 'fsparts.org'

export interface CookieStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function shouldUseCookies(hostname: string): boolean {
  return hostname === APEX_DOMAIN || hostname.endsWith(COOKIE_DOMAIN)
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string): void {
  const maxAgeSeconds = 60 * 60 * 24 * 100
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`
}

const cookieStorage: CookieStorage = {
  getItem: readCookie,
  setItem: writeCookie,
  removeItem: deleteCookie,
}

export function createSessionStorage(hostname: string = window.location.hostname): CookieStorage {
  return shouldUseCookies(hostname) ? cookieStorage : window.localStorage
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/cookieStorage`
Expected: PASS — 6 tests across both files.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: init fsparts-platform monorepo, add cross-subdomain storage adapter"
```

---

### Task 2: `@fsparts/core` — Supabase client factory and singleton

**Files:**
- Create: `packages/core/src/supabase.ts`
- Create: `packages/core/src/client.ts`
- Test: `packages/core/src/supabase.test.ts`

**Interfaces:**
- Consumes: `createSessionStorage(): CookieStorage` from `./cookieStorage` (Task 1).
- Produces: `createSupabaseClient(config: SupabaseConfig): SupabaseClient`, `interface SupabaseConfig { url: string; anonKey: string }` from `./supabase`; `supabase: SupabaseClient | null`, `isSupabaseConfigured: boolean` from `./client`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/supabase.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mocked: true })),
}))

import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from './supabase'

describe('createSupabaseClient', () => {
  it('passes url, anonKey, and a storage adapter into createClient', () => {
    createSupabaseClient({ url: 'https://test.supabase.co', anonKey: 'test-key' })

    expect(createClient).toHaveBeenCalledTimes(1)
    const [url, anonKey, options] = vi.mocked(createClient).mock.calls[0]
    expect(url).toBe('https://test.supabase.co')
    expect(anonKey).toBe('test-key')
    expect(options?.auth?.storage?.getItem).toBeTypeOf('function')
    expect(options?.auth?.storage?.setItem).toBeTypeOf('function')
    expect(options?.auth?.storage?.removeItem).toBeTypeOf('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/supabase.test.ts`
Expected: FAIL — `Cannot find module './supabase'`.

- [ ] **Step 3: Implement the factory and the singleton**

Create `packages/core/src/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSessionStorage } from './cookieStorage'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { storage: createSessionStorage() },
  })
}
```

Create `packages/core/src/client.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseClient } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createSupabaseClient({ url, anonKey })
  : null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/supabase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/supabase.ts packages/core/src/client.ts packages/core/src/supabase.test.ts
git commit -m "feat: add shared Supabase client factory with cross-subdomain session storage"
```

---

### Task 3: `@fsparts/core` — types, currency utils, auth store, and package barrel

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/currency.ts`
- Create: `packages/core/src/auth.store.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/auth.store.test.ts`

**Interfaces:**
- Consumes: `supabase` from `./client` (Task 2).
- Produces: `useAuthStore()` Pinia store (id `'auth'`) exposing `user`, `profile`, `role`, `isReady`, `isAuthenticated`, `isAdmin`, `init()`, `signIn(email, password)`, `signUp(email, password)`, `signOut()`, `updateProfile(data)`, `fetchProfile(userId)`; `formatCurrency(amount, currency?)`, `formatNumber(n)`; types `UserRole`, `UserProfile`, `OrderStatus`, plus the full `fsp_web` shared type set. `packages/core/src/index.ts` is the public entrypoint of `@fsparts/core`.

- [ ] **Step 1: Port `types.ts` and `currency.ts` unchanged**

Create `packages/core/src/types.ts`:

```ts
export interface ProductLine {
  id: number
  code: string
  name: string
  description: string
  icon: string
  slug: string
  productCount?: number
}

export interface Brand {
  id: number
  name: string
  slug: string
  logoUrl?: string
  country?: string
}

export interface Category {
  id: number
  name: string
  slug: string
  productLineId: number
  description?: string
}

export interface ProductSpec {
  key: string
  value: string
  unit?: string
  group?: string
}

export interface Product {
  id: string
  sku: string
  name: string
  slug: string
  description: string
  brand: Brand
  category: Category
  productLine: ProductLine
  priceUsd?: number
  priceCop?: number
  priceWs1?: number
  priceWs2?: number
  priceWs3?: number
  priceWs4?: number
  stock: number
  isFeatured: boolean
  isNew?: boolean
  images: string[]
  specs: ProductSpec[]
  refrigerants: string[]
}

export interface CartItem {
  product: Product
  quantity: number
}

export type UserRole = 'admin' | 'customer' | 'customer_ws1' | 'customer_ws3'

export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  company: string | null
  notes: string | null
}

export interface FilterState {
  search: string
  productLineIds: number[]
  brandIds: number[]
  categoryIds: number[]
  refrigerants: string[]
  priceRange: [number, number]
  inStockOnly: boolean
}

export type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest'

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
  shipping_company: string | null
  shipping_tax_id: string | null
  shipping_address: string
  shipping_city: string
  shipping_notes: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  paid_at: string | null
}

export interface ShippingAddress {
  id: string
  user_id: string
  label: string | null
  full_name: string
  phone: string
  company: string | null
  tax_id: string | null
  address: string
  city: string
  notes: string | null
  is_default: boolean
  created_at: string
}
```

Create `packages/core/src/currency.ts`:

```ts
export function formatCurrency(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CO').format(n)
}
```

- [ ] **Step 2: Write the failing test for `isAdmin`**

Create `packages/core/src/auth.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth.store'

describe('useAuthStore.isAdmin', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('is false when there is no profile', () => {
    const auth = useAuthStore()
    expect(auth.isAdmin).toBe(false)
  })

  it('is false for a non-admin role', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'customer', company: null, notes: null }
    expect(auth.isAdmin).toBe(false)
  })

  it('is true when role is admin', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'admin', company: null, notes: null }
    expect(auth.isAdmin).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/core/src/auth.store.test.ts`
Expected: FAIL — `Cannot find module './auth.store'`.

- [ ] **Step 4: Port `auth.store.ts`**

Create `packages/core/src/auth.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from './client'
import type { UserProfile } from './types'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const isReady = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin         = computed(() => profile.value?.role === 'admin')
  const role            = computed(() => profile.value?.role ?? null)

  let initPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (!initPromise) initPromise = _init()
    return initPromise
  }

  async function fetchProfile(userId: string): Promise<void> {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      profile.value = data ?? null
    } catch {
      profile.value = null
    }
  }

  async function updateProfile(data: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>): Promise<void> {
    if (!supabase || !user.value) return
    if (!user.value.email) throw new Error('No hay email asociado a este usuario')
    const { error } = await supabase.from('user_profiles').upsert({
      id:    user.value.id,
      email: user.value.email,
      ...data,
    })
    if (error) throw new Error(error.message)
    await fetchProfile(user.value.id)
  }

  function _init(): Promise<void> {
    if (!supabase) {
      isReady.value = true
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      supabase!.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
        const resolveReady = () => {
          if (!isReady.value) { isReady.value = true; resolve() }
        }
        if (user.value) {
          fetchProfile(user.value.id).finally(resolveReady)
        } else {
          profile.value = null
          resolveReady()
        }
      })
    })
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    profile.value = null
  }

  return {
    user, profile, role, isReady,
    isAuthenticated, isAdmin,
    init, signIn, signUp, signOut, updateProfile, fetchProfile,
  }
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/core/src/auth.store.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the package barrel**

Create `packages/core/src/index.ts`:

```ts
export { createSupabaseClient } from './supabase'
export type { SupabaseConfig } from './supabase'
export { supabase, isSupabaseConfigured } from './client'
export { useAuthStore } from './auth.store'
export { formatCurrency, formatNumber } from './currency'
export { shouldUseCookies, createSessionStorage } from './cookieStorage'
export type { CookieStorage } from './cookieStorage'
export type {
  ProductLine, Brand, Category, ProductSpec, Product, CartItem,
  UserRole, UserProfile, FilterState, SortOption, OrderStatus,
  OrderItemSnapshot, Order, ShippingAddress,
} from './types'
```

- [ ] **Step 7: Run the full `packages/core` test suite**

Run: `npx vitest run packages/core`
Expected: PASS — all tests from Tasks 1–3 (10 tests total).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/currency.ts packages/core/src/auth.store.ts packages/core/src/auth.store.test.ts packages/core/src/index.ts
git commit -m "feat: complete @fsparts/core — types, currency utils, auth store, barrel"
```

---

### Task 4: `@fsparts/ui` — design tokens and presentational component kit

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/tokens.css`
- Create: `packages/ui/src/components/AppButton.vue`
- Create: `packages/ui/src/components/AppBadge.vue`
- Create: `packages/ui/src/components/AppSpinner.vue`
- Create: `packages/ui/src/composables/useToast.ts`
- Create: `packages/ui/src/components/AppToast.vue`
- Create: `packages/ui/src/components/OrderStatusBadge.vue`

**Interfaces:**
- Consumes: `OrderStatus` type from `@fsparts/core` (Task 3).
- Produces: `AppButton`, `AppBadge`, `AppSpinner`, `AppToast`, `OrderStatusBadge` Vue components; `useToast(): { toasts, add, dismiss }`; `packages/ui/src/tokens.css` (Tailwind v4 `@theme` block).

- [ ] **Step 1: Scaffold `packages/ui`**

Create `packages/ui/package.json`:

```json
{
  "name": "@fsparts/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@fsparts/core": "*",
    "@lucide/vue": "^1.17.0",
    "@vueuse/core": "^14.3.0",
    "vue": "^3.5.34"
  }
}
```

Create `packages/ui/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@fsparts/core": ["../core/src/index.ts"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 2: Port the design tokens**

Create `packages/ui/src/tokens.css` (ported verbatim from `fsp_web/src/style.css`'s `@theme` block):

```css
@theme {
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-200: #bfdbfe;
  --color-brand-300: #93c5fd;
  --color-brand-400: #60a5fa;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-brand-800: #1e40af;
  --color-brand-900: #1e3a8a;
  --color-brand-950: #172554;

  --color-accent-400: #fb923c;
  --color-accent-500: #f97316;
  --color-accent-600: #ea580c;

  --font-sans: 'Inter', system-ui, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 3: Port the presentational components unchanged**

Create `packages/ui/src/components/AppButton.vue`:

```vue
<template>
  <component
    :is="to ? 'RouterLink' : 'button'"
    :to="to"
    :type="!to ? type : undefined"
    :disabled="!to && (disabled || loading)"
    :class="classes"
    v-bind="$attrs"
  >
    <span v-if="loading" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot v-else-if="$slots.icon && iconPos === 'left'" name="icon" />
    <span v-if="$slots.default"><slot /></span>
    <slot v-else-if="$slots.icon && iconPos === 'right'" name="icon" />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  disabled?: boolean
  to?: string
  type?: 'button' | 'submit' | 'reset'
  iconPos?: 'left' | 'right'
  full?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
  iconPos: 'left',
  full: false,
})

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 no-underline'

const variants: Record<string, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  outline:   'border border-brand-700 text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  ghost:     'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  accent:    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-sm',
}

const sizes: Record<string, string> = {
  xs: 'text-xs px-2.5 py-1.5',
  sm: 'text-sm px-3 py-2',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-5 py-3',
  xl: 'text-lg px-7 py-4',
}

const classes = computed(() => [
  base,
  variants[props.variant],
  sizes[props.size],
  props.full ? 'w-full' : '',
])
</script>
```

Create `packages/ui/src/components/AppBadge.vue`:

```vue
<template>
  <span :class="classes"><slot /></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'blue' | 'green' | 'orange' | 'red' | 'slate' | 'purple' | 'teal'
  size?: 'xs' | 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'blue',
  size: 'sm',
})

const variants: Record<string, string> = {
  blue:   'bg-brand-100 text-brand-800',
  green:  'bg-emerald-100 text-emerald-800',
  orange: 'bg-orange-100 text-orange-800',
  red:    'bg-red-100 text-red-700',
  slate:  'bg-slate-100 text-slate-700',
  purple: 'bg-purple-100 text-purple-800',
  teal:   'bg-teal-100 text-teal-800',
}

const sizes: Record<string, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
}

const classes = computed(() => [
  'inline-flex items-center font-medium rounded-full whitespace-nowrap',
  variants[props.variant],
  sizes[props.size],
])
</script>
```

Create `packages/ui/src/components/AppSpinner.vue`:

```vue
<template>
  <div :class="['inline-block animate-spin rounded-full border-2 border-current border-t-transparent', sizes[size]]" role="status">
    <span class="sr-only">Cargando...</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
</script>
```

Create `packages/ui/src/composables/useToast.ts`:

```ts
import { reactive } from 'vue'

type Toast = {
  id: string
  message: string
  href?: string
  linkLabel?: string
  duration?: number
}

const toasts = reactive<Toast[]>([])

export function useToast() {
  function add(opts: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID()
    toasts.push({ id, ...opts })
    setTimeout(() => dismiss(id), opts.duration ?? 6000)
  }

  function dismiss(id: string) {
    const i = toasts.findIndex(t => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  return { toasts, add, dismiss }
}
```

Create `packages/ui/src/components/AppToast.vue`:

```vue
<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl max-w-sm"
        >
          <CheckCircle class="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <span class="flex-1 text-slate-100">{{ toast.message }}</span>
          <RouterLink
            v-if="toast.href"
            :to="toast.href"
            class="font-semibold text-brand-400 hover:text-brand-300 whitespace-nowrap transition-colors"
          >{{ toast.linkLabel ?? 'Ver' }} →</RouterLink>
          <button
            @click="dismiss(toast.id)"
            class="text-slate-500 hover:text-white transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckCircle, X } from '@lucide/vue'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.2s ease-out;
}
.toast-leave-active {
  transition: all 0.18s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.15s;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
```

Create `packages/ui/src/components/OrderStatusBadge.vue`:

```vue
<template>
  <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full', classes]">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@fsparts/core'

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

- [ ] **Step 4: Type-check the package**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vue-tsc --noEmit -p packages/ui/tsconfig.json`
Expected: exits with no errors (exit code 0).

- [ ] **Step 5: Commit**

```bash
git add packages/ui
git commit -m "feat: port design tokens and presentational UI kit into @fsparts/ui"
```

---

### Task 5: `@fsparts/ui` — shared app list and auth-aware visibility logic

**Files:**
- Create: `packages/ui/src/shell/apps.config.ts`
- Create: `packages/ui/src/shell/useVisibleApps.ts`
- Test: `packages/ui/src/shell/useVisibleApps.test.ts`

**Interfaces:**
- Consumes: `useAuthStore` from `@fsparts/core` (Task 3).
- Produces: `type AppId = 'shop' | 'calculator' | 'dashboard'`, `interface AppEntry { id: AppId; name: string; description: string; url: string; requiresAdmin: boolean }`, `APPS: AppEntry[]`, `useVisibleApps(): { visibleApps: ComputedRef<AppEntry[]> }`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/shell/useVisibleApps.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@fsparts/core'
import { useVisibleApps } from './useVisibleApps'

describe('useVisibleApps', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('excludes admin-only apps when the user is not an admin', () => {
    const { visibleApps } = useVisibleApps()
    expect(visibleApps.value.map((a) => a.id)).toEqual(['shop', 'calculator'])
  })

  it('includes admin-only apps when isAdmin is true', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'admin', company: null, notes: null }
    const { visibleApps } = useVisibleApps()
    expect(visibleApps.value.map((a) => a.id)).toEqual(['shop', 'calculator', 'dashboard'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run packages/ui/src/shell/useVisibleApps.test.ts`
Expected: FAIL — `Cannot find module './useVisibleApps'`.

- [ ] **Step 3: Implement `apps.config.ts` and `useVisibleApps.ts`**

Create `packages/ui/src/shell/apps.config.ts`:

```ts
export type AppId = 'shop' | 'calculator' | 'dashboard'

export interface AppEntry {
  id: AppId
  name: string
  description: string
  url: string
  requiresAdmin: boolean
}

export const APPS: AppEntry[] = [
  {
    id: 'shop',
    name: 'fsparts Shop',
    description: 'Catálogo y pedidos de repuestos HVAC/R',
    url: import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org',
    requiresAdmin: false,
  },
  {
    id: 'calculator',
    name: 'fsparts Calculadora',
    description: 'Calculadora de carga térmica',
    url: import.meta.env.VITE_APP_URL_CALCULATOR ?? 'https://calculator.fsparts.org',
    requiresAdmin: false,
  },
  {
    id: 'dashboard',
    name: 'fsparts Dashboard',
    description: 'Panel administrativo',
    url: import.meta.env.VITE_APP_URL_DASHBOARD ?? 'https://dashboard.fsparts.org',
    requiresAdmin: true,
  },
]
```

Create `packages/ui/src/shell/useVisibleApps.ts`:

```ts
import { computed } from 'vue'
import { useAuthStore } from '@fsparts/core'
import { APPS } from './apps.config'

export function useVisibleApps() {
  const auth = useAuthStore()
  const visibleApps = computed(() => APPS.filter((app) => !app.requiresAdmin || auth.isAdmin))
  return { visibleApps }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/ui/src/shell/useVisibleApps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/shell/apps.config.ts packages/ui/src/shell/useVisibleApps.ts packages/ui/src/shell/useVisibleApps.test.ts
git commit -m "feat: add shared app registry and admin-aware visibility logic"
```

---

### Task 6: `@fsparts/ui` — brand shell components and package barrel

**Files:**
- Create: `packages/ui/src/shell/AppHeader.vue`
- Create: `packages/ui/src/shell/AppSwitcher.vue`
- Create: `packages/ui/src/shell/AppFooter.vue`
- Create: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `useVisibleApps`, `AppId` from `./useVisibleApps` / `./apps.config` (Task 5); `AppButton`, `AppBadge`, `AppSpinner`, `AppToast`, `OrderStatusBadge`, `useToast` from Task 4.
- Produces: `AppHeader` (props: `appLabel: string`, `currentAppId: AppId`; slots: `center`, `actions`), `AppSwitcher` (props: `currentAppId: AppId`), `AppFooter` — this completes `@fsparts/ui`'s public API via `packages/ui/src/index.ts`.

- [ ] **Step 1: Implement `AppSwitcher.vue`**

Create `packages/ui/src/shell/AppSwitcher.vue`:

```vue
<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-label="Apps de fsparts"
      @click="isOpen = !isOpen"
    >
      <LayoutGrid class="h-5 w-5" />
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg py-2 z-50"
    >
      <a
        v-for="app in visibleApps"
        :key="app.id"
        :href="app.url"
        class="flex flex-col gap-0.5 px-4 py-2.5 no-underline hover:bg-slate-50"
        :class="app.id === currentAppId ? 'bg-brand-50' : ''"
      >
        <span class="text-sm font-semibold text-slate-900">{{ app.name }}</span>
        <span class="text-xs text-slate-500">{{ app.description }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { LayoutGrid } from '@lucide/vue'
import { useVisibleApps } from './useVisibleApps'
import type { AppId } from './apps.config'

defineProps<{ currentAppId: AppId }>()

const isOpen = ref(false)
const { visibleApps } = useVisibleApps()

const root = useTemplateRef<HTMLElement>('root')
onClickOutside(root, () => { isOpen.value = false })
</script>
```

- [ ] **Step 2: Implement `AppHeader.vue`**

Create `packages/ui/src/shell/AppHeader.vue`:

```vue
<template>
  <header class="sticky top-0 z-40 bg-white border-b border-slate-200 h-14 md:h-16">
    <div class="mx-auto max-w-7xl h-full px-4 flex items-center gap-4">
      <div class="flex-shrink-0 flex items-center gap-3">
        <AppSwitcher :current-app-id="currentAppId" />
        <a href="/" class="flex items-center gap-2 no-underline">
          <span class="font-semibold text-slate-900 text-sm md:text-base whitespace-nowrap">
            fsparts <span class="text-brand-700">{{ appLabel }}</span>
          </span>
        </a>
      </div>
      <div class="flex-1 min-w-0">
        <slot name="center" />
      </div>
      <div class="flex-shrink-0 flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppSwitcher from './AppSwitcher.vue'
import type { AppId } from './apps.config'

defineProps<{ appLabel: string; currentAppId: AppId }>()
</script>
```

- [ ] **Step 3: Implement `AppFooter.vue`**

Create `packages/ui/src/shell/AppFooter.vue`:

```vue
<template>
  <footer class="border-t border-slate-200 bg-white">
    <div class="mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-slate-500">
      <span>&copy; {{ year }} FSP Parts. Todos los derechos reservados.</span>
      <span>Distribuidor especializado de repuestos HVAC/R — Colombia</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const year = computed(() => new Date().getFullYear())
</script>
```

- [ ] **Step 4: Add the package barrel**

Create `packages/ui/src/index.ts`:

```ts
export { default as AppButton } from './components/AppButton.vue'
export { default as AppBadge } from './components/AppBadge.vue'
export { default as AppSpinner } from './components/AppSpinner.vue'
export { default as AppToast } from './components/AppToast.vue'
export { default as OrderStatusBadge } from './components/OrderStatusBadge.vue'
export { useToast } from './composables/useToast'
export { default as AppHeader } from './shell/AppHeader.vue'
export { default as AppSwitcher } from './shell/AppSwitcher.vue'
export { default as AppFooter } from './shell/AppFooter.vue'
export { APPS } from './shell/apps.config'
export type { AppEntry, AppId } from './shell/apps.config'
export { useVisibleApps } from './shell/useVisibleApps'
```

- [ ] **Step 5: Type-check the package**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vue-tsc --noEmit -p packages/ui/tsconfig.json`
Expected: exits with no errors.

- [ ] **Step 6: Run the full `packages/ui` test suite**

Run: `npx vitest run packages/ui`
Expected: PASS — the 2 tests from Task 5.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/shell/AppHeader.vue packages/ui/src/shell/AppSwitcher.vue packages/ui/src/shell/AppFooter.vue packages/ui/src/index.ts
git commit -m "feat: add AppHeader/AppSwitcher/AppFooter brand shell, complete @fsparts/ui barrel"
```

---

### Task 7: Scaffold `apps/shop`

**Files:**
- Create: `apps/shop/package.json`
- Create: `apps/shop/tsconfig.json`
- Create: `apps/shop/vite.config.ts`
- Create: `apps/shop/vercel.json`
- Create: `apps/shop/.env.example`
- Create: `apps/shop/index.html`
- Create: `apps/shop/public/favicon.svg` (copied from `fsp_web`)
- Create: `apps/shop/src/style.css`
- Create: `apps/shop/src/main.ts`
- Create: `apps/shop/src/App.vue`
- Create: `apps/shop/src/router/index.ts`
- Create: `apps/shop/src/views/HomeView.vue`
- Test: `apps/shop/src/App.test.ts`

**Interfaces:**
- Consumes: `AppHeader`, `AppFooter`, `AppToast` from `@fsparts/ui` (Task 6); `useAuthStore` from `@fsparts/core` (Task 3).
- Produces: a running app on `localhost:5173` in dev and a `dist/` build via `npm run build --workspace=apps/shop`.

- [ ] **Step 1: Write the failing smoke test**

Create `apps/shop/src/App.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import HomeView from './views/HomeView.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('fsparts Shop')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/shop/src/App.test.ts`
Expected: FAIL — `Cannot find module './App.vue'`.

- [ ] **Step 3: Scaffold the app**

Create `apps/shop/package.json`:

```json
{
  "name": "shop",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
}
```

Create `apps/shop/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@fsparts/ui": ["../../packages/ui/src/index.ts"],
      "@fsparts/core": ["../../packages/core/src/index.ts"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

Create `apps/shop/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5173 },
})
```

Create `apps/shop/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Create `apps/shop/.env.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL_SHOP=http://localhost:5173
VITE_APP_URL_CALCULATOR=http://localhost:5174
VITE_APP_URL_DASHBOARD=http://localhost:5175
```

Create `apps/shop/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>fsparts Shop</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Copy the favicon from `fsp_web`:

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\shop\public"
cp "C:\Users\juanf\fs\fsp_web\public\favicon.svg" "C:\Users\juanf\fs\fsparts-platform\apps\shop\public\favicon.svg"
```

Create `apps/shop/src/style.css`:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/tokens.css";
@source "../../../packages/ui/src";

body {
  font-family: var(--font-sans);
  background-color: #f8fafc;
  color: #0f172a;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}
```

Create `apps/shop/src/views/HomeView.vue`:

```vue
<template>
  <div class="mx-auto max-w-3xl px-4 py-24 text-center">
    <h1 class="text-3xl font-bold text-slate-900">fsparts Shop</h1>
    <p class="mt-3 text-slate-500">Plantilla base funcionando. El catálogo llega en la Fase 2.</p>
  </div>
</template>
```

Create `apps/shop/src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
})

export default router
```

Create `apps/shop/src/App.vue`:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Shop" current-app-id="shop">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
```

Create `apps/shop/src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install && npx vitest run apps/shop/src/App.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the production build**

Run: `npm run build --workspace=apps/shop`
Expected: exits 0, prints `dist/index.html` and hashed asset filenames, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/shop
git commit -m "feat: scaffold apps/shop with shared brand shell"
```

---

### Task 8: Scaffold `apps/calculator`

**Files:**
- Create: `apps/calculator/package.json`
- Create: `apps/calculator/tsconfig.json`
- Create: `apps/calculator/vite.config.ts`
- Create: `apps/calculator/vercel.json`
- Create: `apps/calculator/.env.example`
- Create: `apps/calculator/index.html`
- Create: `apps/calculator/public/favicon.svg` (copied from `fsp_web`)
- Create: `apps/calculator/src/style.css`
- Create: `apps/calculator/src/main.ts`
- Create: `apps/calculator/src/App.vue`
- Create: `apps/calculator/src/router/index.ts`
- Create: `apps/calculator/src/views/HomeView.vue`
- Test: `apps/calculator/src/App.test.ts`

**Interfaces:**
- Same as Task 7, mirrored for the `calculator` app: `appLabel="Calculadora"`, `currentAppId="calculator"`, port `5174`.

- [ ] **Step 1: Write the failing smoke test**

Create `apps/calculator/src/App.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import HomeView from './views/HomeView.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('fsparts Calculadora')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/calculator/src/App.test.ts`
Expected: FAIL — `Cannot find module './App.vue'`.

- [ ] **Step 3: Scaffold the app**

Create `apps/calculator/package.json`:

```json
{
  "name": "calculator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
}
```

Create `apps/calculator/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@fsparts/ui": ["../../packages/ui/src/index.ts"],
      "@fsparts/core": ["../../packages/core/src/index.ts"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

Create `apps/calculator/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5174 },
})
```

Create `apps/calculator/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Create `apps/calculator/.env.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL_SHOP=http://localhost:5173
VITE_APP_URL_CALCULATOR=http://localhost:5174
VITE_APP_URL_DASHBOARD=http://localhost:5175
```

Create `apps/calculator/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>fsparts Calculadora</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Copy the favicon from `fsp_web`:

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\calculator\public"
cp "C:\Users\juanf\fs\fsp_web\public\favicon.svg" "C:\Users\juanf\fs\fsparts-platform\apps\calculator\public\favicon.svg"
```

Create `apps/calculator/src/style.css`:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/tokens.css";
@source "../../../packages/ui/src";

body {
  font-family: var(--font-sans);
  background-color: #f8fafc;
  color: #0f172a;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}
```

Create `apps/calculator/src/views/HomeView.vue`:

```vue
<template>
  <div class="mx-auto max-w-3xl px-4 py-24 text-center">
    <h1 class="text-3xl font-bold text-slate-900">fsparts Calculadora</h1>
    <p class="mt-3 text-slate-500">Plantilla base funcionando. La calculadora de carga térmica llega en la Fase 3.</p>
  </div>
</template>
```

Create `apps/calculator/src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
})

export default router
```

Create `apps/calculator/src/App.vue`:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Calculadora" current-app-id="calculator">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
```

Create `apps/calculator/src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/calculator/src/App.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the production build**

Run: `npm run build --workspace=apps/calculator`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/calculator
git commit -m "feat: scaffold apps/calculator with shared brand shell"
```

---

### Task 9: Scaffold `apps/dashboard`

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/vite.config.ts`
- Create: `apps/dashboard/vercel.json`
- Create: `apps/dashboard/.env.example`
- Create: `apps/dashboard/index.html`
- Create: `apps/dashboard/public/favicon.svg` (copied from `fsp_web`)
- Create: `apps/dashboard/src/style.css`
- Create: `apps/dashboard/src/main.ts`
- Create: `apps/dashboard/src/App.vue`
- Create: `apps/dashboard/src/router/index.ts`
- Create: `apps/dashboard/src/views/HomeView.vue`
- Test: `apps/dashboard/src/App.test.ts`

**Interfaces:**
- Same as Task 7, mirrored for the `dashboard` app: `appLabel="Dashboard"`, `currentAppId="dashboard"`, port `5175`.

- [ ] **Step 1: Write the failing smoke test**

Create `apps/dashboard/src/App.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import HomeView from './views/HomeView.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('fsparts Dashboard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npx vitest run apps/dashboard/src/App.test.ts`
Expected: FAIL — `Cannot find module './App.vue'`.

- [ ] **Step 3: Scaffold the app**

Create `apps/dashboard/package.json`:

```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
}
```

Create `apps/dashboard/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@fsparts/ui": ["../../packages/ui/src/index.ts"],
      "@fsparts/core": ["../../packages/core/src/index.ts"]
    },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

Create `apps/dashboard/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5175 },
})
```

Create `apps/dashboard/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Create `apps/dashboard/.env.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL_SHOP=http://localhost:5173
VITE_APP_URL_CALCULATOR=http://localhost:5174
VITE_APP_URL_DASHBOARD=http://localhost:5175
```

Create `apps/dashboard/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>fsparts Dashboard</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Copy the favicon from `fsp_web`:

```bash
mkdir -p "C:\Users\juanf\fs\fsparts-platform\apps\dashboard\public"
cp "C:\Users\juanf\fs\fsp_web\public\favicon.svg" "C:\Users\juanf\fs\fsparts-platform\apps\dashboard\public\favicon.svg"
```

Create `apps/dashboard/src/style.css`:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/tokens.css";
@source "../../../packages/ui/src";

body {
  font-family: var(--font-sans);
  background-color: #f8fafc;
  color: #0f172a;
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
}
```

Create `apps/dashboard/src/views/HomeView.vue`:

```vue
<template>
  <div class="mx-auto max-w-3xl px-4 py-24 text-center">
    <h1 class="text-3xl font-bold text-slate-900">fsparts Dashboard</h1>
    <p class="mt-3 text-slate-500">Plantilla base funcionando. El panel administrativo llega en la Fase 4.</p>
  </div>
</template>
```

Create `apps/dashboard/src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
})

export default router
```

Create `apps/dashboard/src/App.vue`:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Dashboard" current-app-id="dashboard">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
```

Create `apps/dashboard/src/main.ts`:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

createApp(App).use(createPinia()).use(router).mount('#app')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/dashboard/src/App.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the production build**

Run: `npm run build --workspace=apps/dashboard`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard
git commit -m "feat: scaffold apps/dashboard with shared brand shell"
```

---

### Task 10: Full workspace verification

**Files:** none (verification only).

**Interfaces:** none — this task only runs commands across the workspace built in Tasks 1–9.

- [ ] **Step 1: Run the entire test suite from the root**

Run: `cd "C:\Users\juanf\fs\fsparts-platform" && npm test`
Expected: PASS — every test file from Tasks 1, 2, 3, 5, 7, 8, 9 (16 tests total), 0 failures.

- [ ] **Step 2: Build all three apps**

Run:
```bash
npm run build:shop
npm run build:calculator
npm run build:dashboard
```
Expected: all three exit 0, each producing its own `apps/*/dist/index.html`.

- [ ] **Step 3: Manual visual check (not automated)**

Run each dev server in its own terminal:
```bash
npm run dev:shop        # http://localhost:5173
npm run dev:calculator  # http://localhost:5174
npm run dev:dashboard   # http://localhost:5175
```

In a browser, confirm for each of the 3 URLs:
- The header shows the correct wordmark ("fsparts Shop" / "fsparts Calculadora" / "fsparts Dashboard") and identical Blueprint Indigo / typography styling.
- Clicking the Apps switcher button opens a panel listing "fsparts Shop" and "fsparts Calculadora", but **not** "fsparts Dashboard" (no admin session exists yet — this is expected, since no login UI has been migrated in this phase).
- The footer is identical across all three.

This step is manual because there is no admin session to test the Dashboard-visibility branch, and cross-subdomain cookie behavior cannot run locally (no real `*.fsparts.org` DNS) — both are explicitly deferred to post-deploy verification per the design spec's Testing section.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify fsparts-platform foundation builds and tests pass end to end" --allow-empty
```

---

## Follow-Ups (not part of this plan)

- Create the 3 Vercel projects and attach `shop.`/`calculator.`/`dashboard.fsparts.org` domains (manual, per spec Section E).
- Phase 2 plan: migrate `fsp_web`'s landing/catalog/cart/checkout/orders/auth UI into `apps/shop`.
- Phase 3 plan: migrate the thermal load calculator into `apps/calculator`.
- Phase 4 plan: migrate the admin panel into `apps/dashboard`.
- Post-deploy manual verification of real cross-subdomain SSO (log in on `shop.fsparts.org`, confirm session on `calculator.fsparts.org`).
