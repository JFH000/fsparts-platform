# Shared Header Actions & Auth Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each app (`shop`, `calculator`, `dashboard`) real, working content in `AppHeader`'s `#actions` slot (cart button in shop, functional login in calculator, an admin badge in dashboard), and stop duplicating `ProfileDropdown`/`AuthModal`/`LoginForm` across apps by moving the shared pieces into `@fsparts/ui`.

**Architecture:** New `packages/ui/src/auth/` module holds four shared primitives (`useAuthModal`, `AuthModal`, `LoginForm`, `ProfileDropdown`) exported from the `@fsparts/ui` barrel. `AppHeader`'s existing generic `#center`/`#actions` slots are unchanged — apps keep plugging arbitrary content into them, they just now have more to plug in. Shop keeps its own richer `LoginForm`/`RegisterForm`/`OnboardingForm`/`EditProfileForm` untouched (business logic specific to customer accounts); calculator and dashboard use the shared minimal `LoginForm`.

**Tech Stack:** Vue 3.5, Vite 8, Vue Router 4.6, Pinia 3, Tailwind CSS v4, `@lucide/vue`, Vitest 4 + `@vue/test-utils` + jsdom, npm workspaces.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-24-shared-header-actions-design.md`.
- Do not move `RegisterForm.vue`, `OnboardingForm.vue`, or `EditProfileForm.vue` out of `apps/shop` — customer-account flows stay shop-only.
- Do not touch `AdminLayout.vue`'s floating sidebar navigation or move it into `AppHeader`'s `#center` slot.
- No search bar in shop's `#center` slot — out of scope.
- `useAuthModal`'s `mode` state is a per-app singleton (each app bundles its own copy) — no cross-app synchronization.
- Components in `packages/ui` never use `@apply`/`@reference` in `<style scoped>` blocks (no build step of their own to resolve the theme against) — Tailwind utility classes go directly in the template; only plain CSS (transitions, keyframes) is allowed in `<style scoped>`, matching the existing `AppToast.vue` precedent.
- Testing components that use `<Teleport>` requires `global: { stubs: { teleport: true } } }` in `mount()` — confirmed empirically in this repo; the default `wrapper.find()` does **not** see teleported content otherwise.
- Dashboard's public/gate view (`apps/dashboard/src/App.vue`, shown before `AdminLayout`) keeps an empty `#actions` slot — no login/account control belongs there, the whole view already is the login gate.

---

### Task 1: Shared `useAuthModal` composable

**Files:**
- Create: `packages/ui/src/auth/useAuthModal.ts`
- Test: `packages/ui/src/auth/useAuthModal.test.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `useAuthModal(): { mode: Ref<AuthModalMode | null>, open(m: AuthModalMode): void, close(): void, switchTo(m: AuthModalMode): void }`, `type AuthModalMode = 'login' | 'register' | 'onboarding' | 'editProfile'`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/auth/useAuthModal.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthModal } from './useAuthModal'

describe('useAuthModal', () => {
  const { mode, open, close, switchTo } = useAuthModal()

  beforeEach(() => close())

  it('starts closed', () => {
    expect(mode.value).toBeNull()
  })

  it('open sets the given mode', () => {
    open('login')
    expect(mode.value).toBe('login')
  })

  it('close resets mode to null', () => {
    open('login')
    close()
    expect(mode.value).toBeNull()
  })

  it('switchTo changes mode without closing', () => {
    open('login')
    switchTo('register')
    expect(mode.value).toBe('register')
  })

  it('switchTo from null sets mode', () => {
    switchTo('onboarding')
    expect(mode.value).toBe('onboarding')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/ui/src/auth/useAuthModal.test.ts`
Expected: FAIL — `Cannot find module './useAuthModal'`.

- [ ] **Step 3: Implement**

Create `packages/ui/src/auth/useAuthModal.ts`:

```ts
import { ref } from 'vue'

export type AuthModalMode = 'login' | 'register' | 'onboarding' | 'editProfile'

const mode = ref<AuthModalMode | null>(null)

export function useAuthModal() {
  function open(m: AuthModalMode) { mode.value = m }
  function close() { mode.value = null }
  function switchTo(m: AuthModalMode) { mode.value = m }
  return { mode, open, close, switchTo }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/ui/src/auth/useAuthModal.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Add the barrel export**

In `packages/ui/src/index.ts`, add at the end:

```ts
export { useAuthModal } from './auth/useAuthModal'
export type { AuthModalMode } from './auth/useAuthModal'
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/auth/useAuthModal.ts packages/ui/src/auth/useAuthModal.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): add shared useAuthModal composable"
```

---

### Task 2: Shared `AuthModal` overlay shell

**Files:**
- Create: `packages/ui/src/auth/AuthModal.vue`
- Test: `packages/ui/src/auth/AuthModal.test.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `useAuthModal()` (Task 1).
- Produces: `AuthModal` component with default scoped slot `#default="{ mode }"` — renders nothing when `mode` is `null`; renders the slot (passing `mode`) inside a teleported overlay otherwise. Closes on backdrop click or close button.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/auth/AuthModal.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AuthModal from './AuthModal.vue'
import { useAuthModal } from './useAuthModal'

describe('AuthModal', () => {
  beforeEach(() => useAuthModal().close())

  it('renders nothing when mode is null', () => {
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: (props: { mode: string | null }) => h('div', { class: 'probe' }, props.mode ?? '') },
    })
    expect(wrapper.find('.probe').exists()).toBe(false)
  })

  it('renders the default slot with the current mode when open', () => {
    useAuthModal().open('login')
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: (props: { mode: string | null }) => h('div', { class: 'probe' }, props.mode ?? '') },
    })
    expect(wrapper.find('.probe').text()).toBe('login')
  })

  it('closes when the backdrop is clicked', async () => {
    useAuthModal().open('login')
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: () => h('div', 'content') },
    })
    await wrapper.find('[data-testid="auth-modal-overlay"]').trigger('click')
    expect(useAuthModal().mode.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/ui/src/auth/AuthModal.test.ts`
Expected: FAIL — `Cannot find module './AuthModal.vue'`.

- [ ] **Step 3: Implement**

Create `packages/ui/src/auth/AuthModal.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="mode"
        data-testid="auth-modal-overlay"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="modal-card relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <button
            class="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            @click="close"
            aria-label="Cerrar"
          >
            <X class="h-4 w-4" />
          </button>
          <slot :mode="mode" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { X } from '@lucide/vue'
import { useAuthModal } from './useAuthModal'

const { mode, close } = useAuthModal()

watch(mode, (val) => {
  if (val) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
  } else {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}, { immediate: true })
</script>

<style scoped>
.modal-card {
  animation: modal-card-in 0.2s ease;
}

@keyframes modal-card-in {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}

.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/ui/src/auth/AuthModal.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add the barrel export**

In `packages/ui/src/index.ts`, add:

```ts
export { default as AuthModal } from './auth/AuthModal.vue'
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/auth/AuthModal.vue packages/ui/src/auth/AuthModal.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): add shared AuthModal overlay shell"
```

---

### Task 3: Shared `LoginForm`

**Files:**
- Create: `packages/ui/src/auth/LoginForm.vue`
- Test: `packages/ui/src/auth/LoginForm.test.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `useAuthStore()` from `@fsparts/core` (`signIn`, `fetchProfile`, `user`); `useAuthModal()` (Task 1) for `close()`.
- Produces: `LoginForm` component — pure email/password form, no register link, no onboarding/admin-redirect logic.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/auth/LoginForm.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const authState = reactive({
  user: null as { id: string } | null,
  signIn: vi.fn().mockResolvedValue(undefined),
  fetchProfile: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import LoginForm from './LoginForm.vue'
import { useAuthModal } from './useAuthModal'

describe('LoginForm', () => {
  beforeEach(() => {
    authState.user = null
    authState.signIn.mockClear()
    authState.fetchProfile.mockClear()
    useAuthModal().open('login')
  })

  it('signs in with the entered email and password', async () => {
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(authState.signIn).toHaveBeenCalledWith('user@test.co', 'secret123')
  })

  it('closes the auth modal after a successful login', async () => {
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(useAuthModal().mode.value).toBeNull()
  })

  it('shows an error message when sign-in fails', async () => {
    authState.signIn.mockRejectedValueOnce(new Error('Credenciales inválidas'))
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('wrong')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Credenciales inválidas')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/ui/src/auth/LoginForm.test.ts`
Expected: FAIL — `Cannot find module './LoginForm.vue'`.

- [ ] **Step 3: Implement**

Create `packages/ui/src/auth/LoginForm.vue`:

```vue
<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Snowflake class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Iniciar sesión</h2>
      <p class="text-slate-500 text-sm">Accede a tu cuenta para continuar</p>
    </div>

    <Transition name="fade">
      <div v-if="error" class="mb-5 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
        {{ error }}
      </div>
    </Transition>

    <form @submit.prevent="handleLogin" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Correo electrónico</label>
        <input v-model="email" type="email" required autocomplete="email"
          placeholder="tu@correo.com"
          class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contraseña</label>
        <div class="relative">
          <input v-model="password" :type="showPwd ? 'text' : 'password'"
            required autocomplete="current-password" placeholder="••••••••"
            class="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
          <button type="button" @click="showPwd = !showPwd"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <Eye v-if="!showPwd" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
      <button type="submit" :disabled="loading"
        class="w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <span>{{ loading ? 'Ingresando...' : 'Ingresar' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from './useAuthModal'

const authStore = useAuthStore()
const { close }  = useAuthModal()

const email    = ref('')
const password = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const error    = ref<string | null>(null)

async function handleLogin() {
  error.value   = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    if (authStore.user) await authStore.fetchProfile(authStore.user.id)
    close()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/ui/src/auth/LoginForm.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add the barrel export**

In `packages/ui/src/index.ts`, add:

```ts
export { default as LoginForm } from './auth/LoginForm.vue'
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/auth/LoginForm.vue packages/ui/src/auth/LoginForm.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): add shared minimal LoginForm"
```

---

### Task 4: Shared `ProfileDropdown`

**Files:**
- Create: `packages/ui/src/auth/ProfileDropdown.vue`
- Test: `packages/ui/src/auth/ProfileDropdown.test.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `useAuthStore()` from `@fsparts/core` (`profile`, `user`, `signOut`).
- Produces: `ProfileDropdown` component — avatar circle with initials, dropdown with name/email header, named slot `#extra-items` (scoped, exposes `close(): void` so callers can dismiss the menu before navigating/opening a modal), "Cerrar sesión". Renders a divider above "Cerrar sesión" only when `#extra-items` content is provided.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/auth/ProfileDropdown.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const authState = reactive({
  profile: { full_name: 'Juana Pérez', email: 'juana@test.co' } as { full_name: string | null; email: string } | null,
  user: { id: 'u1', email: 'juana@test.co' } as { id: string; email: string } | null,
  signOut: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import ProfileDropdown from './ProfileDropdown.vue'

describe('ProfileDropdown', () => {
  beforeEach(() => authState.signOut.mockClear())

  it('shows the user initials on the avatar button', () => {
    const wrapper = mount(ProfileDropdown)
    expect(wrapper.find('button').text()).toBe('JP')
  })

  it('opens the dropdown with the user name and no divider when there are no extra items', async () => {
    const wrapper = mount(ProfileDropdown)
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Juana Pérez')
    expect(wrapper.text()).toContain('Cerrar sesión')
    expect(wrapper.find('.divider').exists()).toBe(false)
  })

  it('renders extra-items slot content with a divider when provided', async () => {
    const wrapper = mount(ProfileDropdown, {
      slots: { 'extra-items': '<button class="probe">Mis pedidos</button>' },
    })
    await wrapper.find('button').trigger('click')

    expect(wrapper.find('.probe').exists()).toBe(true)
    expect(wrapper.find('.divider').exists()).toBe(true)
  })

  it('calls signOut when "Cerrar sesión" is clicked', async () => {
    const wrapper = mount(ProfileDropdown)
    await wrapper.find('button').trigger('click')
    const signOutBtn = wrapper.findAll('button').find(b => b.text() === 'Cerrar sesión')
    await signOutBtn!.trigger('click')

    expect(authState.signOut).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/ui/src/auth/ProfileDropdown.test.ts`
Expected: FAIL — `Cannot find module './ProfileDropdown.vue'`.

- [ ] **Step 3: Implement**

Create `packages/ui/src/auth/ProfileDropdown.vue`:

```vue
<template>
  <div ref="containerRef" class="relative">
    <!-- Avatar -->
    <button
      @click="toggle"
      class="flex items-center justify-center w-8 h-8 bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold rounded-full transition-all"
      :class="isOpen ? 'ring-2 ring-brand-400 ring-offset-1' : ''"
      :title="authStore.profile?.full_name || authStore.user?.email || 'Mi perfil'"
    >
      {{ userInitials }}
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden">
        <!-- Cabecera usuario -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div class="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
            {{ userInitials }}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 truncate">
              {{ authStore.profile?.full_name || 'Usuario' }}
            </p>
            <p class="text-xs text-slate-400 truncate">{{ authStore.user?.email }}</p>
          </div>
        </div>

        <!-- Acciones -->
        <div class="p-1.5">
          <slot name="extra-items" :close="closeMenu" />
          <div v-if="$slots['extra-items']" class="divider h-px bg-slate-100 my-1" />
          <button
            class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            @click="onSignOut"
          >
            <LogOut class="h-3.5 w-3.5 flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { LogOut } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()

const isOpen       = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitials = computed(() => {
  const name = authStore.profile?.full_name ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

function toggle() { isOpen.value = !isOpen.value }
function closeMenu() { isOpen.value = false }

function handleOutsideClick(e: MouseEvent) {
  if (!containerRef.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

async function onSignOut() {
  closeMenu()
  await authStore.signOut()
}
</script>

<style scoped>
.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/ui/src/auth/ProfileDropdown.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Add the barrel export**

In `packages/ui/src/index.ts`, add:

```ts
export { default as ProfileDropdown } from './auth/ProfileDropdown.vue'
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/auth/ProfileDropdown.vue packages/ui/src/auth/ProfileDropdown.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): add shared ProfileDropdown with extra-items slot"
```

---

### Task 5: Migrate shop's auth module onto the shared primitives

**Files:**
- Modify: `apps/shop/src/router/index.ts`
- Modify: `apps/shop/src/App.vue`
- Modify: `apps/shop/src/modules/auth/components/RegisterForm.vue`
- Modify: `apps/shop/src/modules/auth/components/LoginForm.vue`
- Modify: `apps/shop/src/modules/auth/components/EditProfileForm.vue`
- Modify: `apps/shop/src/modules/auth/components/OnboardingForm.vue`
- Rewrite: `apps/shop/src/modules/auth/components/AuthModal.vue`
- Rewrite: `apps/shop/src/modules/auth/components/ProfileDropdown.vue`
- Delete: `apps/shop/src/modules/auth/composables/useAuthModal.ts`
- Delete: `apps/shop/src/modules/auth/composables/__tests__/useAuthModal.test.ts`

**Interfaces:**
- Consumes: `useAuthModal`, `AuthModal`, `ProfileDropdown` from `@fsparts/ui` (Tasks 1, 2, 4).
- Produces: no new public interface — shop's own `AuthModal`/`ProfileDropdown` component behavior is preserved exactly.

This task is one atomic change: shop's local `useAuthModal.ts` singleton and the shared one are two different `mode` refs. Leaving some files pointed at the old one and some at the new one mid-refactor would desync `open()`/`close()` calls from what `AuthModal.vue` renders. Do all edits below, then delete the local composable, then run the full shop suite once at the end.

- [ ] **Step 1: Swap the `useAuthModal` import in the 5 files that only need a path change**

In `apps/shop/src/router/index.ts`, change:

```ts
import { useAuthModal } from '../modules/auth/composables/useAuthModal'
```
to:
```ts
import { useAuthModal } from '@fsparts/ui'
```

In `apps/shop/src/App.vue`, change:
```ts
import { useAuthModal } from './modules/auth/composables/useAuthModal'
```
to:
```ts
import { useAuthModal } from '@fsparts/ui'
```

In `apps/shop/src/modules/auth/components/RegisterForm.vue`, `LoginForm.vue`, `EditProfileForm.vue`, and `OnboardingForm.vue`, change:
```ts
import { useAuthModal } from '../composables/useAuthModal'
```
to:
```ts
import { useAuthModal } from '@fsparts/ui'
```
(This is the same one-line change in all four files — no other line in any of them changes.)

- [ ] **Step 2: Rewrite `AuthModal.vue` as a thin wrapper around the shared shell**

Replace the full contents of `apps/shop/src/modules/auth/components/AuthModal.vue` with:

```vue
<template>
  <AuthModal>
    <template #default="{ mode }">
      <LoginForm      v-if="mode === 'login'" />
      <RegisterForm   v-else-if="mode === 'register'" />
      <OnboardingForm v-else-if="mode === 'onboarding'" />
      <EditProfileForm v-else-if="mode === 'editProfile'" />
    </template>
  </AuthModal>
</template>

<script setup lang="ts">
import { AuthModal } from '@fsparts/ui'
import LoginForm       from './LoginForm.vue'
import RegisterForm    from './RegisterForm.vue'
import OnboardingForm  from './OnboardingForm.vue'
import EditProfileForm from './EditProfileForm.vue'
</script>
```

- [ ] **Step 3: Rewrite `ProfileDropdown.vue` as a thin wrapper around the shared shell**

Replace the full contents of `apps/shop/src/modules/auth/components/ProfileDropdown.vue` with:

```vue
<template>
  <ProfileDropdown>
    <template #extra-items="{ close }">
      <button
        class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
        @click="onOrders(close)"
      >
        <Package class="h-3.5 w-3.5 flex-shrink-0" />
        Mis pedidos
      </button>
      <button
        class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
        @click="onEditProfile(close)"
      >
        <Pencil class="h-3.5 w-3.5 flex-shrink-0" />
        Editar perfil
      </button>
    </template>
  </ProfileDropdown>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Pencil, Package } from '@lucide/vue'
import { ProfileDropdown, useAuthModal } from '@fsparts/ui'

const { open } = useAuthModal()
const router   = useRouter()

function onEditProfile(closeMenu: () => void) {
  closeMenu()
  open('editProfile')
}

function onOrders(closeMenu: () => void) {
  closeMenu()
  router.push('/orders')
}
</script>
```

- [ ] **Step 4: Delete the local composable and its test**

```bash
rm apps/shop/src/modules/auth/composables/useAuthModal.ts
rm apps/shop/src/modules/auth/composables/__tests__/useAuthModal.test.ts
```

- [ ] **Step 5: Run the full shop test suite**

Run: `npx vitest run apps/shop`
Expected: PASS — all existing shop tests still green (behavior unchanged, only import paths and internal wiring moved).

- [ ] **Step 6: Commit**

```bash
git add apps/shop/src/router/index.ts apps/shop/src/App.vue apps/shop/src/modules/auth
git commit -m "refactor(shop): consume shared useAuthModal/AuthModal/ProfileDropdown from @fsparts/ui"
```

---

### Task 6: Shop — add the cart button to the header

**Files:**
- Modify: `apps/shop/src/App.vue`
- Modify: `apps/shop/src/App.test.ts`

**Interfaces:**
- Consumes: `useCartStore()` from `apps/shop/src/modules/cart/stores/cart.store.ts` (`totalItems: ComputedRef<number>`, `openDrawer(): void`).

- [ ] **Step 1: Write the failing test**

Replace the full contents of `apps/shop/src/App.test.ts` with:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useCartStore } from './modules/cart/stores/cart.store'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('Shop')
  })

  it('opens the cart drawer when the cart button is clicked', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })
    const cartStore = useCartStore()

    await wrapper.find('[aria-label="Carrito"]').trigger('click')

    expect(cartStore.isDrawerOpen).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `npx vitest run apps/shop/src/App.test.ts`
Expected: the cart test FAILS — `[aria-label="Carrito"]` not found.

- [ ] **Step 3: Add the cart button to `App.vue`**

In `apps/shop/src/App.vue`, change the `#actions` template block from:

```vue
      <template #actions>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          @click="openAuthModal('login')"
        >
          Iniciar sesión
        </button>
        <ProfileDropdown v-else />
      </template>
```
to:
```vue
      <template #actions>
        <button
          type="button"
          class="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label="Carrito"
          @click="cartStore.openDrawer()"
        >
          <ShoppingCart class="h-5 w-5" />
          <span
            v-if="cartStore.totalItems > 0"
            class="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center"
          >
            {{ cartStore.totalItems > 99 ? '99+' : cartStore.totalItems }}
          </span>
        </button>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          @click="openAuthModal('login')"
        >
          Iniciar sesión
        </button>
        <ProfileDropdown v-else />
      </template>
```

And change the `<script setup>` block from:

```ts
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AuthModal from './modules/auth/components/AuthModal.vue'
import ProfileDropdown from './modules/auth/components/ProfileDropdown.vue'
import { useAuthModal } from '@fsparts/ui'
import CartDrawer from './modules/cart/components/CartDrawer.vue'
import { useCatalogStore } from './modules/catalog/stores/catalog.store'

const authStore    = useAuthStore()
const catalogStore = useCatalogStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => {
  catalogStore.initialize()
  authStore.init()
})
```
to:
```ts
import { onMounted } from 'vue'
import { ShoppingCart } from '@lucide/vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AuthModal from './modules/auth/components/AuthModal.vue'
import ProfileDropdown from './modules/auth/components/ProfileDropdown.vue'
import { useAuthModal } from '@fsparts/ui'
import CartDrawer from './modules/cart/components/CartDrawer.vue'
import { useCartStore } from './modules/cart/stores/cart.store'
import { useCatalogStore } from './modules/catalog/stores/catalog.store'

const authStore    = useAuthStore()
const catalogStore = useCatalogStore()
const cartStore    = useCartStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => {
  catalogStore.initialize()
  authStore.init()
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/shop/src/App.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/shop/src/App.vue apps/shop/src/App.test.ts
git commit -m "feat(shop): add cart button with item-count badge to the header"
```

---

### Task 7: Calculator — functional login in the header

**Files:**
- Modify: `apps/calculator/src/App.vue`
- Modify: `apps/calculator/src/App.test.ts`

**Interfaces:**
- Consumes: `AppHeader`, `AppFooter`, `AppToast`, `AuthModal`, `LoginForm`, `ProfileDropdown`, `useAuthModal` from `@fsparts/ui`; `useAuthStore` from `@fsparts/core`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `apps/calculator/src/App.test.ts` with:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

const authState = reactive({
  isAuthenticated: false,
  user: null as { id: string } | null,
  profile: null,
  init: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import router from './router'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => { authState.isAuthenticated = false })

  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).toContain('Aire Acondicionado')
  })

  it('shows a login button in the header when unauthenticated', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).toContain('Iniciar sesión')
  })

  it('shows the profile dropdown instead of the login button when authenticated', async () => {
    authState.isAuthenticated = true
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).not.toContain('Iniciar sesión')
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run apps/calculator/src/App.test.ts`
Expected: the two new tests FAIL — no "Iniciar sesión" text exists yet.

- [ ] **Step 3: Wire up the header actions and the modal**

Replace the full contents of `apps/calculator/src/App.vue` with:

```vue
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Calculadora" current-app-id="calculator">
      <template #actions>
        <button
          v-if="!authStore.isAuthenticated"
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          @click="openAuthModal('login')"
        >
          Iniciar sesión
        </button>
        <ProfileDropdown v-else />
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
    <AuthModal>
      <template #default="{ mode }">
        <LoginForm v-if="mode === 'login'" />
      </template>
    </AuthModal>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast, AuthModal, LoginForm, ProfileDropdown, useAuthModal } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => { authStore.init() })
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/calculator/src/App.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/calculator/src/App.vue apps/calculator/src/App.test.ts
git commit -m "feat(calculator): wire real login/profile dropdown into the header"
```

---

### Task 8: Dashboard public view — shared `LoginForm`, empty actions slot

**Files:**
- Modify: `apps/dashboard/src/App.vue`
- Delete: `apps/dashboard/src/modules/auth/components/LoginForm.vue`

**Interfaces:**
- Consumes: `LoginForm` from `@fsparts/ui` (Task 3) instead of the local component.

- [ ] **Step 1: Confirm no other file references the local `LoginForm.vue`**

Run: `grep -rn "auth/components/LoginForm" apps/dashboard/src --include=*.vue --include=*.ts`
Expected: only `apps/dashboard/src/App.vue` matches.

- [ ] **Step 2: Update `App.vue`**

Replace the full contents of `apps/dashboard/src/App.vue` with:

```vue
<template>
  <AdminLayout v-if="authStore.isReady && authStore.isAuthenticated && authStore.isAdmin" />

  <div v-else class="min-h-screen flex flex-col">
    <AppHeader app-label="Dashboard" current-app-id="dashboard" />
    <main class="flex-1 flex items-center justify-center py-12 px-6">
      <AppSpinner v-if="!authStore.isReady" size="lg" class="text-brand-600" />
      <div v-else-if="!authStore.isAuthenticated" class="w-full max-w-sm bg-white rounded-2xl border border-slate-200">
        <LoginForm />
      </div>
      <div v-else class="text-center">
        <p class="text-sm font-semibold text-slate-500">Acceso restringido</p>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Esta sección es solo para administradores de FSP Parts.</p>
        <button
          @click="authStore.signOut()"
          class="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
    <AppFooter />
  </div>

  <AppToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast, AppSpinner, LoginForm } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AdminLayout from './modules/admin/layouts/AdminLayout.vue'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
```

- [ ] **Step 3: Delete the local `LoginForm.vue`**

```bash
rm apps/dashboard/src/modules/auth/components/LoginForm.vue
```

- [ ] **Step 4: Run the dashboard test suite**

Run: `npx vitest run apps/dashboard`
Expected: PASS — all 5 existing tests still green (the "Iniciar sesión" heading text is unchanged in the shared `LoginForm`).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.vue
git rm apps/dashboard/src/modules/auth/components/LoginForm.vue
git commit -m "refactor(dashboard): use the shared LoginForm, empty the gate view's actions slot"
```

---

### Task 9: Dashboard admin — shared `ProfileDropdown` + Admin badge

**Files:**
- Modify: `apps/dashboard/src/modules/admin/layouts/AdminLayout.vue`
- Modify: `apps/dashboard/src/App.test.ts`
- Delete: `apps/dashboard/src/modules/auth/components/ProfileDropdown.vue`

**Interfaces:**
- Consumes: `ProfileDropdown`, `AppBadge` from `@fsparts/ui`.

- [ ] **Step 1: Confirm no other file references the local `ProfileDropdown.vue`**

Run: `grep -rn "auth/components/ProfileDropdown" apps/dashboard/src --include=*.vue --include=*.ts`
Expected: only `apps/dashboard/src/modules/admin/layouts/AdminLayout.vue` matches.

- [ ] **Step 2: Write the failing test for the Admin badge**

In `apps/dashboard/src/App.test.ts`, in the `'shows AdminLayout for an admin'` test, replace the single existing assertion with two:

```ts
  it('shows AdminLayout for an admin', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    authState.isAdmin = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Admin')
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run apps/dashboard/src/App.test.ts`
Expected: FAIL — no "Admin" text rendered yet.

- [ ] **Step 4: Update `AdminLayout.vue`**

In `apps/dashboard/src/modules/admin/layouts/AdminLayout.vue`, change the `<AppHeader>` block from:

```vue
    <AppHeader app-label="Dashboard" current-app-id="dashboard">
      <template #actions>
        <ProfileDropdown />
      </template>
    </AppHeader>
```
to:
```vue
    <AppHeader app-label="Dashboard" current-app-id="dashboard">
      <template #actions>
        <AppBadge variant="purple">Admin</AppBadge>
        <ProfileDropdown />
      </template>
    </AppHeader>
```

And change the imports from:
```ts
import { useRoute } from 'vue-router'
import { Package, Layers, Users, ExternalLink, ShoppingBag } from '@lucide/vue'
import { AppHeader } from '@fsparts/ui'
import ProfileDropdown from '../../auth/components/ProfileDropdown.vue'
```
to:
```ts
import { useRoute } from 'vue-router'
import { Package, Layers, Users, ExternalLink, ShoppingBag } from '@lucide/vue'
import { AppHeader, AppBadge, ProfileDropdown } from '@fsparts/ui'
```

- [ ] **Step 5: Delete the local `ProfileDropdown.vue`**

```bash
rm apps/dashboard/src/modules/auth/components/ProfileDropdown.vue
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run apps/dashboard`
Expected: PASS — all 5 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/modules/admin/layouts/AdminLayout.vue apps/dashboard/src/App.test.ts
git rm apps/dashboard/src/modules/auth/components/ProfileDropdown.vue
git commit -m "feat(dashboard): use shared ProfileDropdown, add Admin badge to the admin header"
```

---

### Task 10: Full regression across the monorepo

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — every test file in the monorepo green.

- [ ] **Step 2: Build all three apps**

Run:
```bash
npm run build --workspace=apps/shop
npm run build --workspace=apps/calculator
npm run build --workspace=apps/dashboard
```
Expected: all three exit 0.

- [ ] **Step 3: Confirm no leftover references to the deleted local auth files**

Run: `grep -rln "composables/useAuthModal'" apps/shop/src`
Expected: no matches (all shop files now import `useAuthModal` from `@fsparts/ui`).

Run: `grep -rn "modules/auth/components/LoginForm.vue\|auth/components/ProfileDropdown.vue" apps/dashboard/src`
Expected: no matches.

- [ ] **Step 4: Commit (only if any fixups were needed in Steps 1-3; otherwise skip — Task 9 already committed a clean state)**
