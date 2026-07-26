# Auth & Perfil de Usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar login/register general para todos los usuarios, onboarding post-registro, página de perfil `/me` con acceso al panel admin, y eliminar el antiguo `/admin/login`.

**Architecture:** Cuatro vistas nuevas en `src/modules/auth/views/`. El auth store se extiende para manejar el perfil completo (no solo el rol). El router obtiene nuevas rutas y guards actualizados. Se agrega una RLS policy de INSERT en Supabase para que el onboarding pueda crear el perfil.

**Tech Stack:** Vue 3 SFC `<script setup>`, Pinia, Supabase JS, Vue Router, Tailwind CSS 4 (scoped `@apply`), Lucide `@lucide/vue`.

---

## File Structure

```
src/modules/auth/
  stores/
    auth.store.ts           ← MODIFY: add profile, fetchProfile, updateProfile
  views/
    AdminLoginView.vue      ← DELETE
    LoginView.vue           ← CREATE: split screen login
    RegisterView.vue        ← CREATE: split screen register
    OnboardingView.vue      ← CREATE: centered onboarding
    ProfileView.vue         ← CREATE: sidebar + content profile
src/router/
  index.ts                  ← MODIFY: new routes, updated guards
```

---

## Task 1: Supabase — INSERT policy en user_profiles

**Files:**
- SQL run via Supabase dashboard (Settings → SQL Editor) o MCP

Los usuarios nuevos necesitan poder crear su propio perfil en el onboarding. Actualmente no hay política INSERT, así que el upsert falla.

- [ ] **Step 1: Ejecutar este SQL en Supabase**

```sql
CREATE POLICY "users can insert own profile"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = id
  AND role = 'customer'
);
```

- [ ] **Step 2: Verificar que las 3 policies existen**

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles' ORDER BY cmd;
```

Resultado esperado: 3 filas — INSERT, SELECT, UPDATE.

- [ ] **Step 3: Commit (solo documentación del cambio)**

```bash
git commit --allow-empty -m "fix: add INSERT RLS policy to user_profiles for onboarding"
```

---

## Task 2: Extender auth store

**Files:**
- Modify: `src/modules/auth/stores/auth.store.ts`

Reemplazar `fetchRole` (solo seleccionaba `role`) por `fetchProfile` (selecciona `*`). Agregar `updateProfile`. Mantener `role` como computed para compatibilidad.

- [ ] **Step 1: Reemplazar el contenido completo de auth.store.ts**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/core/supabase/client'
import type { UserProfile } from '@/shared/types'

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
    await supabase.from('user_profiles').upsert({
      id:    user.value.id,
      email: user.value.email!,
      role:  profile.value?.role ?? 'customer',
      ...data,
    })
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
    init, signIn, signUp, signOut, updateProfile,
  }
})
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npm run build 2>&1 | head -30
```

Esperado: sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/stores/auth.store.ts
git commit -m "feat: extend auth store with full profile fetch and updateProfile"
```

---

## Task 3: Actualizar router

**Files:**
- Modify: `src/router/index.ts`

Agregar 4 rutas nuevas. Eliminar `/admin/login`. Actualizar `beforeEach` para manejar auth-only y public-only guards.

- [ ] **Step 1: Reemplazar el contenido completo de src/router/index.ts**

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import ShopLayout from '@/layouts/ShopLayout.vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Shop ──────────────────────────────────────────────────────
    {
      path: '/',
      component: ShopLayout,
      children: [
        { path: '',               name: 'landing',       component: () => import('@/modules/landing/views/LandingView.vue') },
        { path: 'catalog',        name: 'catalog',       component: () => import('@/modules/catalog/views/CatalogView.vue') },
        { path: 'product/:id',    name: 'product-detail',component: () => import('@/modules/catalog/views/ProductDetailView.vue') },
        { path: 'cart',           name: 'cart',          component: () => import('@/modules/cart/views/CartView.vue') },
        { path: 'checkout',       name: 'checkout',      component: () => import('@/modules/cart/views/CartView.vue') },
        { path: 'hvac-calculator',name: 'hvac-calculator',component: () => import('@/modules/hvac/views/HvacCalculatorView.vue') },
      ],
    },

    // ── Auth público (redirige a /me si ya autenticado) ───────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/auth/views/LoginView.vue'),
      meta: { publicOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/modules/auth/views/RegisterView.vue'),
      meta: { publicOnly: true },
    },

    // ── Auth privado ──────────────────────────────────────────────
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/modules/auth/views/OnboardingView.vue'),
      meta: { requiresUser: true },
    },
    {
      path: '/me',
      name: 'profile',
      component: () => import('@/modules/auth/views/ProfileView.vue'),
      meta: { requiresUser: true },
    },

    // ── Admin panel ───────────────────────────────────────────────
    {
      path: '/admin',
      component: () => import('@/modules/admin/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '',               redirect: '/admin/products' },
        { path: 'products',       name: 'admin-products',    component: () => import('@/modules/admin/views/AdminProductsView.vue') },
        { path: 'products/new',   name: 'admin-product-new', component: () => import('@/modules/admin/views/AdminProductFormView.vue') },
        { path: 'products/:id/edit', name: 'admin-product-edit', component: () => import('@/modules/admin/views/AdminProductFormView.vue') },
        { path: 'catalog',        name: 'admin-catalog',     component: () => import('@/modules/admin/views/AdminCatalogView.vue') },
        { path: 'settings',       name: 'admin-settings',    component: () => import('@/modules/admin/views/AdminSettingsView.vue') },
      ],
    },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.isReady) await authStore.init()

  // Rutas solo para no autenticados (/login, /register)
  if (to.meta.publicOnly && authStore.isAuthenticated) {
    return { name: 'profile' }
  }

  // Rutas que requieren estar autenticado (/me, /onboarding)
  if (to.meta.requiresUser && !authStore.isAuthenticated) {
    return { name: 'login' }
  }

  // Rutas de admin (requieren rol admin)
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) return { name: 'login' }
    if (!authStore.isAdmin)         return { name: 'landing' }
  }

  return true
})

export default router
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | head -30
```

Esperado: sin errores (AdminLoginView aún existe, se borrará en Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add auth routes (login, register, onboarding, me) and update guards"
```

---

## Task 4: LoginView — Split screen

**Files:**
- Create: `src/modules/auth/views/LoginView.vue`

Panel izquierdo: `bg-slate-900` con dot-grid, logo, tagline y 3 bullets. Panel derecho: blanco, formulario email + contraseña. Tras login exitoso: admin → `/admin/products`, customer → `/me`.

- [ ] **Step 1: Crear src/modules/auth/views/LoginView.vue**

```vue
<template>
  <div class="min-h-screen flex">
    <!-- Panel izquierdo (branding) -->
    <div class="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
      <div class="absolute inset-0 opacity-10"
        style="background-image: radial-gradient(circle, #60a5fa 1px, transparent 1px); background-size: 32px 32px;" />
      <div class="absolute inset-0 bg-gradient-to-br from-brand-950/60 via-transparent to-slate-900/80" />

      <div class="relative z-10">
        <RouterLink to="/" class="flex items-center gap-2.5 mb-16">
          <div class="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center shadow-lg">
            <Snowflake class="h-5 w-5 text-white" />
          </div>
          <span class="text-2xl font-bold text-white tracking-tight">
            FS <span class="text-brand-400">Parts</span>
          </span>
        </RouterLink>

        <h1 class="text-4xl font-extrabold text-white leading-tight mb-4">
          Tu distribuidor<br />
          <span class="text-brand-400">HVAC/R</span> de confianza
        </h1>
        <p class="text-slate-400 text-lg mb-12">Compresores, válvulas, refrigerantes y más.</p>

        <div class="space-y-5">
          <div v-for="b in bullets" :key="b.text" class="flex items-center gap-3">
            <div class="w-8 h-8 bg-brand-700/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <component :is="b.icon" class="h-4 w-4 text-brand-400" />
            </div>
            <span class="text-slate-300 text-sm">{{ b.text }}</span>
          </div>
        </div>
      </div>

      <p class="relative z-10 text-slate-600 text-xs">© {{ new Date().getFullYear() }} FS Parts</p>
    </div>

    <!-- Panel derecho (formulario) -->
    <div class="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
      <div class="w-full max-w-sm">
        <!-- Logo móvil -->
        <div class="flex items-center gap-2 mb-8 lg:hidden">
          <div class="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
            <Snowflake class="h-4 w-4 text-white" />
          </div>
          <span class="text-xl font-bold text-slate-900">FS <span class="text-brand-700">Parts</span></span>
        </div>

        <h2 class="text-2xl font-extrabold text-slate-900 mb-1">Iniciar sesión</h2>
        <p class="text-slate-500 text-sm mb-8">Accede a tu cuenta para continuar</p>

        <!-- Error -->
        <Transition name="fade">
          <div v-if="error" class="mb-5 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
            {{ error }}
          </div>
        </Transition>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="field-label">Correo electrónico</label>
            <input v-model="email" type="email" required autocomplete="email"
              placeholder="tu@correo.com" class="field-input" />
          </div>
          <div>
            <label class="field-label">Contraseña</label>
            <div class="relative">
              <input v-model="password" :type="showPwd ? 'text' : 'password'"
                required autocomplete="current-password" placeholder="••••••••"
                class="field-input pr-11" />
              <button type="button" @click="showPwd = !showPwd"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <Eye v-if="!showPwd" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
          <button type="submit" :disabled="loading" class="submit-btn">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <span>{{ loading ? 'Ingresando...' : 'Ingresar' }}</span>
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500">
          ¿No tienes cuenta?
          <RouterLink to="/register" class="font-semibold text-brand-700 hover:text-brand-800">Regístrate</RouterLink>
        </p>
        <p class="mt-3 text-center">
          <RouterLink to="/" class="text-xs text-slate-400 hover:text-slate-600">← Volver al catálogo</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Snowflake, Eye, EyeOff, Loader2, Package, Calculator, Headphones } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const router    = useRouter()
const authStore = useAuthStore()

const email   = ref('')
const password = ref('')
const showPwd = ref(false)
const loading = ref(false)
const error   = ref<string | null>(null)

const bullets = [
  { icon: Package,    text: '+5,000 productos en stock' },
  { icon: Calculator, text: 'Calculadora de carga térmica gratuita' },
  { icon: Headphones, text: 'Soporte técnico especializado' },
]

async function handleLogin() {
  error.value = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    router.push(authStore.isAdmin ? '/admin/products' : '/me')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input  { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.submit-btn   { @apply w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/views/LoginView.vue
git commit -m "feat: add LoginView with split-screen layout"
```

---

## Task 5: RegisterView — Split screen

**Files:**
- Create: `src/modules/auth/views/RegisterView.vue`

Mismo panel izquierdo que LoginView. Panel derecho con email, contraseña, confirmar contraseña. Tras registro exitoso → `/onboarding`.

- [ ] **Step 1: Crear src/modules/auth/views/RegisterView.vue**

```vue
<template>
  <div class="min-h-screen flex">
    <!-- Panel izquierdo (idéntico a LoginView) -->
    <div class="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
      <div class="absolute inset-0 opacity-10"
        style="background-image: radial-gradient(circle, #60a5fa 1px, transparent 1px); background-size: 32px 32px;" />
      <div class="absolute inset-0 bg-gradient-to-br from-brand-950/60 via-transparent to-slate-900/80" />

      <div class="relative z-10">
        <RouterLink to="/" class="flex items-center gap-2.5 mb-16">
          <div class="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center shadow-lg">
            <Snowflake class="h-5 w-5 text-white" />
          </div>
          <span class="text-2xl font-bold text-white tracking-tight">
            FS <span class="text-brand-400">Parts</span>
          </span>
        </RouterLink>

        <h1 class="text-4xl font-extrabold text-white leading-tight mb-4">
          Tu distribuidor<br />
          <span class="text-brand-400">HVAC/R</span> de confianza
        </h1>
        <p class="text-slate-400 text-lg mb-12">Compresores, válvulas, refrigerantes y más.</p>

        <div class="space-y-5">
          <div v-for="b in bullets" :key="b.text" class="flex items-center gap-3">
            <div class="w-8 h-8 bg-brand-700/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <component :is="b.icon" class="h-4 w-4 text-brand-400" />
            </div>
            <span class="text-slate-300 text-sm">{{ b.text }}</span>
          </div>
        </div>
      </div>

      <p class="relative z-10 text-slate-600 text-xs">© {{ new Date().getFullYear() }} FS Parts</p>
    </div>

    <!-- Panel derecho (formulario) -->
    <div class="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
      <div class="w-full max-w-sm">
        <!-- Logo móvil -->
        <div class="flex items-center gap-2 mb-8 lg:hidden">
          <div class="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
            <Snowflake class="h-4 w-4 text-white" />
          </div>
          <span class="text-xl font-bold text-slate-900">FS <span class="text-brand-700">Parts</span></span>
        </div>

        <h2 class="text-2xl font-extrabold text-slate-900 mb-1">Crear cuenta</h2>
        <p class="text-slate-500 text-sm mb-8">Regístrate gratis y accede al catálogo completo</p>

        <!-- Mensajes -->
        <Transition name="fade">
          <div v-if="alert" class="mb-5 px-4 py-3 rounded-xl text-sm font-medium border"
            :class="alert.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'">
            {{ alert.msg }}
          </div>
        </Transition>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="field-label">Correo electrónico</label>
            <input v-model="email" type="email" required autocomplete="email"
              placeholder="tu@correo.com" class="field-input" />
          </div>
          <div>
            <label class="field-label">Contraseña</label>
            <div class="relative">
              <input v-model="password" :type="showPwd ? 'text' : 'password'"
                required minlength="6" autocomplete="new-password"
                placeholder="Mínimo 6 caracteres" class="field-input pr-11" />
              <button type="button" @click="showPwd = !showPwd"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <Eye v-if="!showPwd" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label class="field-label">Confirmar contraseña</label>
            <input v-model="confirm" :type="showPwd ? 'text' : 'password'"
              required autocomplete="new-password"
              placeholder="Repite la contraseña" class="field-input" />
            <p v-if="confirm && confirm !== password" class="text-xs text-red-500 mt-1">
              Las contraseñas no coinciden
            </p>
          </div>
          <button type="submit" :disabled="loading || (!!confirm && confirm !== password)" class="submit-btn">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <span>{{ loading ? 'Creando cuenta...' : 'Registrarse' }}</span>
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?
          <RouterLink to="/login" class="font-semibold text-brand-700 hover:text-brand-800">Inicia sesión</RouterLink>
        </p>
        <p class="mt-3 text-center">
          <RouterLink to="/" class="text-xs text-slate-400 hover:text-slate-600">← Volver al catálogo</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Snowflake, Eye, EyeOff, Loader2, Package, Calculator, Headphones } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const router    = useRouter()
const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const confirm  = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const alert    = ref<{ type: 'error' | 'success'; msg: string } | null>(null)

const bullets = [
  { icon: Package,    text: '+5,000 productos en stock' },
  { icon: Calculator, text: 'Calculadora de carga térmica gratuita' },
  { icon: Headphones, text: 'Soporte técnico especializado' },
]

async function handleRegister() {
  if (password.value !== confirm.value) return
  alert.value = null
  loading.value = true
  try {
    await authStore.signUp(email.value, password.value)
    // Esperar brevemente a que onAuthStateChange actualice el estado
    await new Promise(r => setTimeout(r, 600))
    if (authStore.isAuthenticated) {
      // Email confirmation desactivado → usuario ya autenticado
      router.push('/onboarding')
    } else {
      // Email confirmation activado → mostrar mensaje
      alert.value = {
        type: 'success',
        msg: '¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.',
      }
    }
  } catch (e: unknown) {
    alert.value = {
      type: 'error',
      msg: e instanceof Error ? e.message : 'Error al crear la cuenta',
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input  { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.submit-btn   { @apply w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/views/RegisterView.vue
git commit -m "feat: add RegisterView with split-screen layout"
```

---

## Task 6: OnboardingView

**Files:**
- Create: `src/modules/auth/views/OnboardingView.vue`

Página centrada sobre fondo `slate-50`. Card blanca. Nombre (requerido), teléfono y empresa (opcionales). Botón "Continuar" guarda y va a `/me`. Link "Omitir" va a `/me` sin guardar.

- [ ] **Step 1: Crear src/modules/auth/views/OnboardingView.vue**

```vue
<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <div class="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center shadow-lg">
          <Snowflake class="h-5 w-5 text-white" />
        </div>
        <span class="text-2xl font-bold text-slate-900 tracking-tight">
          FS <span class="text-brand-700">Parts</span>
        </span>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div class="text-center mb-8">
          <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCircle class="h-6 w-6 text-brand-700" />
          </div>
          <h1 class="text-xl font-extrabold text-slate-900 mb-1">Cuéntanos sobre ti</h1>
          <p class="text-slate-500 text-sm">Solo tomará un momento</p>
        </div>

        <Transition name="fade">
          <div v-if="error" class="mb-5 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
            {{ error }}
          </div>
        </Transition>

        <form @submit.prevent="handleContinue" class="space-y-4">
          <div>
            <label class="field-label">Nombre completo <span class="text-red-400">*</span></label>
            <input v-model="form.fullName" type="text" required
              placeholder="Juan Pérez" class="field-input" />
          </div>
          <div>
            <label class="field-label">Teléfono <span class="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></label>
            <input v-model="form.phone" type="tel"
              placeholder="+57 300 000 0000" class="field-input" />
          </div>
          <div>
            <label class="field-label">Empresa <span class="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></label>
            <input v-model="form.company" type="text"
              placeholder="Mi empresa S.A.S." class="field-input" />
          </div>

          <div class="flex flex-col gap-3 pt-2">
            <button type="submit" :disabled="loading" class="submit-btn">
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              <span>{{ loading ? 'Guardando...' : 'Continuar →' }}</span>
            </button>
            <button type="button" @click="skip" class="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
              Omitir por ahora
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Snowflake, UserCircle, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const router    = useRouter()
const authStore = useAuthStore()

const form = reactive({ fullName: '', phone: '', company: '' })
const loading = ref(false)
const error   = ref<string | null>(null)

async function handleContinue() {
  error.value = null
  loading.value = true
  try {
    await authStore.updateProfile({
      fullName: form.fullName,
      phone:    form.phone   || undefined,
      company:  form.company || undefined,
    })
    router.push('/me')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al guardar el perfil'
  } finally {
    loading.value = false
  }
}

function skip() {
  router.push('/me')
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input  { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.submit-btn   { @apply w-full flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/views/OnboardingView.vue
git commit -m "feat: add OnboardingView for post-registration profile setup"
```

---

## Task 7: ProfileView — Sidebar + contenido

**Files:**
- Create: `src/modules/auth/views/ProfileView.vue`

Sidebar oscuro (`w-64`, `bg-slate-900`) fijo a la izquierda: avatar con iniciales, nombre, badge de rol, enlaces de navegación, botón Admin (solo si `isAdmin`), cerrar sesión. Área de contenido derecha: card con campos del perfil, modo edición/vista.

- [ ] **Step 1: Crear src/modules/auth/views/ProfileView.vue**

```vue
<template>
  <div class="min-h-screen flex bg-slate-50">
    <!-- Sidebar -->
    <aside class="w-64 bg-slate-900 flex flex-col flex-shrink-0">
      <!-- Logo -->
      <div class="px-6 py-5 border-b border-slate-800">
        <RouterLink to="/" class="flex items-center gap-2">
          <div class="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
            <Snowflake class="h-4 w-4 text-white" />
          </div>
          <span class="text-lg font-bold text-white">FS <span class="text-brand-400">Parts</span></span>
        </RouterLink>
      </div>

      <!-- Avatar + info -->
      <div class="px-6 py-6 border-b border-slate-800">
        <div class="w-14 h-14 bg-brand-700 rounded-full flex items-center justify-center text-white text-xl font-extrabold mb-3">
          {{ initials }}
        </div>
        <p class="text-white font-semibold text-sm leading-tight truncate">
          {{ authStore.profile?.fullName || authStore.user?.email || 'Usuario' }}
        </p>
        <p class="text-slate-400 text-xs mt-0.5 truncate">{{ authStore.user?.email }}</p>
        <span class="inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full" :class="roleBadge">
          {{ roleLabel }}
        </span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1">
        <RouterLink to="/catalog" class="nav-link">
          <Package class="h-4 w-4" /> Ver catálogo
        </RouterLink>
        <RouterLink to="/hvac-calculator" class="nav-link">
          <Calculator class="h-4 w-4" /> Calculadora HVAC
        </RouterLink>
      </nav>

      <!-- Admin button -->
      <div v-if="authStore.isAdmin" class="px-3 pb-3">
        <RouterLink to="/admin/products"
          class="flex items-center gap-2 w-full bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]">
          <ShieldCheck class="h-4 w-4" /> Panel Admin
        </RouterLink>
      </div>

      <!-- Sign out -->
      <div class="px-3 pb-4">
        <button @click="handleSignOut"
          class="flex items-center gap-2 w-full text-red-400 hover:text-red-300 hover:bg-red-950/30 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
          <LogOut class="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </aside>

    <!-- Contenido principal -->
    <main class="flex-1 p-8 overflow-auto">
      <div class="max-w-lg">
        <h1 class="text-2xl font-extrabold text-slate-900 mb-1">Mi perfil</h1>
        <p class="text-slate-500 text-sm mb-8">Gestiona tu información personal</p>

        <!-- Success message -->
        <Transition name="fade">
          <div v-if="saved" class="mb-6 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">
            Perfil actualizado correctamente
          </div>
        </Transition>

        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="font-bold text-slate-900">Información personal</h2>
            <button v-if="!editing" @click="startEdit" class="edit-btn">
              <Pencil class="h-3.5 w-3.5" /> Editar
            </button>
          </div>

          <div class="space-y-4">
            <!-- Email (siempre readonly) -->
            <div>
              <label class="field-label">Correo electrónico</label>
              <div class="field-readonly">{{ authStore.user?.email }}</div>
            </div>

            <!-- Nombre -->
            <div>
              <label class="field-label">Nombre completo</label>
              <input v-if="editing" v-model="form.fullName" type="text" class="field-input" placeholder="Tu nombre" />
              <div v-else class="field-readonly">{{ authStore.profile?.fullName || '—' }}</div>
            </div>

            <!-- Teléfono -->
            <div>
              <label class="field-label">Teléfono</label>
              <input v-if="editing" v-model="form.phone" type="tel" class="field-input" placeholder="+57 300 000 0000" />
              <div v-else class="field-readonly">{{ authStore.profile?.phone || '—' }}</div>
            </div>

            <!-- Empresa -->
            <div>
              <label class="field-label">Empresa</label>
              <input v-if="editing" v-model="form.company" type="text" class="field-input" placeholder="Nombre de empresa" />
              <div v-else class="field-readonly">{{ authStore.profile?.company || '—' }}</div>
            </div>

            <!-- Acciones edición -->
            <div v-if="editing" class="flex gap-3 pt-2">
              <button @click="saveEdit" :disabled="saving" class="save-btn">
                <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
                <span>{{ saving ? 'Guardando...' : 'Guardar cambios' }}</span>
              </button>
              <button @click="cancelEdit" class="cancel-btn">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  Snowflake, Package, Calculator, ShieldCheck,
  LogOut, Pencil, Loader2,
} from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const router    = useRouter()
const authStore = useAuthStore()

const editing = ref(false)
const saving  = ref(false)
const saved   = ref(false)
const form    = reactive({ fullName: '', phone: '', company: '' })

const initials = computed(() => {
  const name = authStore.profile?.fullName ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

const roleBadge = computed(() => ({
  'admin':       'bg-red-900/50 text-red-300',
  'technician':  'bg-blue-900/50 text-blue-300',
  'distributor': 'bg-purple-900/50 text-purple-300',
  'customer':    'bg-slate-700 text-slate-300',
}[authStore.profile?.role ?? 'customer'] ?? 'bg-slate-700 text-slate-300'))

const roleLabel = computed(() => ({
  admin:       'Administrador',
  technician:  'Técnico',
  distributor: 'Distribuidor',
  customer:    'Cliente',
}[authStore.profile?.role ?? 'customer'] ?? 'Cliente'))

function startEdit() {
  form.fullName = authStore.profile?.fullName ?? ''
  form.phone    = authStore.profile?.phone    ?? ''
  form.company  = authStore.profile?.company  ?? ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  saving.value = true
  try {
    await authStore.updateProfile({
      fullName: form.fullName || undefined,
      phone:    form.phone    || undefined,
      company:  form.company  || undefined,
    })
    editing.value = false
    saved.value   = true
    setTimeout(() => (saved.value = false), 3000)
  } finally {
    saving.value = false
  }
}

async function handleSignOut() {
  await authStore.signOut()
  router.push('/login')
}
</script>

<style scoped>
@reference "../../../style.css";
.nav-link      { @apply flex items-center gap-2.5 text-slate-400 hover:text-white hover:bg-slate-800 text-sm px-3 py-2 rounded-lg transition-all; }
.field-label   { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input   { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.field-readonly{ @apply text-sm text-slate-900 py-2.5 px-0; }
.edit-btn      { @apply flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all; }
.save-btn      { @apply flex items-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm active:scale-[0.99]; }
.cancel-btn    { @apply text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/views/ProfileView.vue
git commit -m "feat: add ProfileView with sidebar layout, edit profile, and admin button"
```

---

## Task 8: Eliminar AdminLoginView y push final

**Files:**
- Delete: `src/modules/auth/views/AdminLoginView.vue`

- [ ] **Step 1: Eliminar el archivo**

```bash
rm src/modules/auth/views/AdminLoginView.vue
```

- [ ] **Step 2: Verificar que el build sigue limpio**

```bash
npm run build 2>&1
```

Esperado: sin errores (el router ya no importa AdminLoginView).

- [ ] **Step 3: Commit y push**

```bash
git add -A
git commit -m "feat: complete auth & profile feature — login, register, onboarding, /me"
git push
```
