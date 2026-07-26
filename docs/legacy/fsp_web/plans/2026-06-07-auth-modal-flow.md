# Auth Modal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las rutas `/login`, `/register`, `/onboarding` y `/me` por modales con blur que aparecen sobre la página actual, y el avatar del navbar abre un dropdown de perfil.

**Architecture:** Un composable singleton `useAuthModal` controla el modo activo (`login | register | onboarding | editProfile | null`). Un único `AuthModal.vue` montado en `App.vue` vía `<Teleport to="body">` renderiza el formulario correcto según el modo. `ProfileDropdown.vue` se monta en el navbar en lugar del `RouterLink` a `/me`.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest + @vue/test-utils, Tailwind CSS v4, supabase-js

---

## File Map

### Crear
| Archivo | Responsabilidad |
|---|---|
| `src/modules/auth/composables/useAuthModal.ts` | Singleton: estado `mode`, funciones `open / close / switchTo` |
| `src/modules/auth/composables/__tests__/useAuthModal.test.ts` | Tests del composable |
| `src/modules/auth/components/AuthModal.vue` | Shell del modal: overlay blur, card, Teleport, `<Transition>` |
| `src/modules/auth/components/LoginForm.vue` | Formulario login extraído de LoginView |
| `src/modules/auth/components/RegisterForm.vue` | Formulario registro extraído de RegisterView |
| `src/modules/auth/components/OnboardingForm.vue` | Formulario onboarding extraído de OnboardingView |
| `src/modules/auth/components/EditProfileForm.vue` | Formulario edición de perfil extraído de ProfileView |
| `src/modules/auth/components/ProfileDropdown.vue` | Avatar + dropdown (cabecera usuario + acciones) |

### Modificar
| Archivo | Cambio |
|---|---|
| `src/modules/auth/stores/auth.store.ts` | Exportar `fetchProfile` en el return |
| `src/App.vue` | Montar `<AuthModal />` |
| `src/modules/shop/components/TheNavbar.vue` | Botón Ingresar → `authModal.open('login')`; avatar → `<ProfileDropdown />` |
| `src/router/index.ts` | Eliminar rutas auth; simplificar guards |

### Eliminar
- `src/modules/auth/views/LoginView.vue`
- `src/modules/auth/views/RegisterView.vue`
- `src/modules/auth/views/OnboardingView.vue`
- `src/modules/auth/views/ProfileView.vue`

---

## Task 1: Composable `useAuthModal`

**Files:**
- Create: `src/modules/auth/composables/useAuthModal.ts`
- Create: `src/modules/auth/composables/__tests__/useAuthModal.test.ts`

- [ ] **Step 1.1: Crear el test (falla primero)**

Crea el archivo `src/modules/auth/composables/__tests__/useAuthModal.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthModal } from '../useAuthModal'

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

- [ ] **Step 1.2: Correr test — debe fallar**

```bash
npm run test -- useAuthModal
```

Esperado: `Error: Cannot find module '../useAuthModal'`

- [ ] **Step 1.3: Implementar el composable**

Crea `src/modules/auth/composables/useAuthModal.ts`:

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

- [ ] **Step 1.4: Correr test — debe pasar**

```bash
npm run test -- useAuthModal
```

Esperado: `5 passed`

- [ ] **Step 1.5: Commit**

```bash
git add src/modules/auth/composables/
git commit -m "feat: add useAuthModal composable"
```

---

## Task 2: Exportar `fetchProfile` del auth store

**Files:**
- Modify: `src/modules/auth/stores/auth.store.ts`

El composable `LoginForm` necesitará llamar `fetchProfile` explícitamente después de `signIn` para garantizar que el perfil esté cargado antes de decidir qué paso mostrar.

- [ ] **Step 2.1: Agregar `fetchProfile` al return del store**

En `src/modules/auth/stores/auth.store.ts`, línea 88, cambia el `return`:

```ts
// antes:
return {
  user, profile, role, isReady,
  isAuthenticated, isAdmin,
  init, signIn, signUp, signOut, updateProfile,
}

// después:
return {
  user, profile, role, isReady,
  isAuthenticated, isAdmin,
  init, signIn, signUp, signOut, updateProfile, fetchProfile,
}
```

- [ ] **Step 2.2: Verificar que no hay errores de TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 2.3: Commit**

```bash
git add src/modules/auth/stores/auth.store.ts
git commit -m "feat: expose fetchProfile from auth store"
```

---

## Task 3: `AuthModal.vue` — shell del modal

**Files:**
- Create: `src/modules/auth/components/AuthModal.vue`

- [ ] **Step 3.1: Crear el componente**

Crea `src/modules/auth/components/AuthModal.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="mode"
        class="modal-overlay"
        @click.self="close"
      >
        <div class="modal-card">
          <button class="modal-close-btn" @click="close" aria-label="Cerrar">
            <X class="h-4 w-4" />
          </button>
          <LoginForm      v-if="mode === 'login'" />
          <RegisterForm   v-else-if="mode === 'register'" />
          <OnboardingForm v-else-if="mode === 'onboarding'" />
          <EditProfileForm v-else-if="mode === 'editProfile'" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { X } from '@lucide/vue'
import { useAuthModal } from '../composables/useAuthModal'
import LoginForm      from './LoginForm.vue'
import RegisterForm   from './RegisterForm.vue'
import OnboardingForm from './OnboardingForm.vue'
import EditProfileForm from './EditProfileForm.vue'

const { mode, close } = useAuthModal()

watch(mode, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
}, { immediate: true })
</script>

<style scoped>
@reference "../../../style.css";

.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center p-4;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
}

.modal-card {
  @apply relative bg-white rounded-2xl shadow-2xl w-full max-w-sm;
  animation: modal-card-in 0.2s ease;
}

.modal-close-btn {
  @apply absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors;
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

Nota: los componentes hijos (`LoginForm`, etc.) aún no existen — los crearemos en las tareas siguientes. El componente compilará con error hasta Task 4.

- [ ] **Step 3.2: Commit**

```bash
git add src/modules/auth/components/AuthModal.vue
git commit -m "feat: add AuthModal shell with blur overlay and Teleport"
```

---

## Task 4: `LoginForm.vue`

**Files:**
- Create: `src/modules/auth/components/LoginForm.vue`

Lógica post-login:
1. Llama `authStore.fetchProfile(user.id)` para garantizar que el perfil esté cargado.
2. Admin → cierra modal y navega a `/admin/products`.
3. Sin `full_name` → `switchTo('onboarding')`.
4. Normal → `close()`.

- [ ] **Step 4.1: Crear el componente**

Crea `src/modules/auth/components/LoginForm.vue`:

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
      <button type="button" @click="switchTo('register')"
        class="font-semibold text-brand-700 hover:text-brand-800">
        Regístrate
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore      = useAuthStore()
const { switchTo, close } = useAuthModal()
const router         = useRouter()

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
    // signIn dispara onAuthStateChange que inicia fetchProfile en paralelo;
    // lo llamamos explícitamente para asegurar que profile esté listo.
    if (authStore.user) await authStore.fetchProfile(authStore.user.id)

    if (authStore.isAdmin) {
      close()
      router.push('/admin/products')
    } else if (!authStore.profile?.full_name) {
      switchTo('onboarding')
    } else {
      close()
    }
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

- [ ] **Step 4.2: Commit**

```bash
git add src/modules/auth/components/LoginForm.vue
git commit -m "feat: add LoginForm component"
```

---

## Task 5: `RegisterForm.vue`

**Files:**
- Create: `src/modules/auth/components/RegisterForm.vue`

Mantiene la confirmación de contraseña del RegisterView original. Post-registro: si el usuario queda autenticado inmediatamente → `switchTo('onboarding')`; si Supabase requiere confirmación de email → muestra mensaje de éxito y cierra.

- [ ] **Step 5.1: Crear el componente**

Crea `src/modules/auth/components/RegisterForm.vue`:

```vue
<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Snowflake class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Crear cuenta</h2>
      <p class="text-slate-500 text-sm">Regístrate gratis y accede al catálogo completo</p>
    </div>

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
      <button type="button" @click="switchTo('login')"
        class="font-semibold text-brand-700 hover:text-brand-800">
        Inicia sesión
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore          = useAuthStore()
const { switchTo, close } = useAuthModal()

const email    = ref('')
const password = ref('')
const confirm  = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const alert    = ref<{ type: 'error' | 'success'; msg: string } | null>(null)

async function handleRegister() {
  if (password.value !== confirm.value) return
  alert.value   = null
  loading.value = true
  try {
    await authStore.signUp(email.value, password.value)
    // Supabase puede requerir confirmación de email → usuario no queda autenticado
    await new Promise(r => setTimeout(r, 600))
    if (authStore.isAuthenticated) {
      switchTo('onboarding')
    } else {
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

- [ ] **Step 5.2: Commit**

```bash
git add src/modules/auth/components/RegisterForm.vue
git commit -m "feat: add RegisterForm component"
```

---

## Task 6: `OnboardingForm.vue`

**Files:**
- Create: `src/modules/auth/components/OnboardingForm.vue`

Post-guardado o skip → `close()`.

- [ ] **Step 6.1: Crear el componente**

Crea `src/modules/auth/components/OnboardingForm.vue`:

```vue
<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <UserCircle class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Cuéntanos sobre ti</h2>
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
        <input v-model="form.full_name" type="text" required
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
        <button type="button" @click="close"
          class="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
          Omitir por ahora
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { UserCircle, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore = useAuthStore()
const { close } = useAuthModal()

const form    = reactive({ full_name: '', phone: '', company: '' })
const loading = ref(false)
const error   = ref<string | null>(null)

async function handleContinue() {
  error.value   = null
  loading.value = true
  try {
    await authStore.updateProfile({
      full_name: form.full_name,
      phone:     form.phone   || undefined,
      company:   form.company || undefined,
    })
    close()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al guardar el perfil'
  } finally {
    loading.value = false
  }
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

- [ ] **Step 6.2: Commit**

```bash
git add src/modules/auth/components/OnboardingForm.vue
git commit -m "feat: add OnboardingForm component"
```

---

## Task 7: `EditProfileForm.vue`

**Files:**
- Create: `src/modules/auth/components/EditProfileForm.vue`

Carga los datos del perfil al montarse. Post-guardado: muestra éxito 1.5 s y luego cierra.

- [ ] **Step 7.1: Crear el componente**

Crea `src/modules/auth/components/EditProfileForm.vue`:

```vue
<template>
  <div class="p-8">
    <div class="text-center mb-6">
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Mi perfil</h2>
      <p class="text-slate-500 text-sm">Edita tu información personal</p>
    </div>

    <Transition name="fade">
      <div v-if="saved" class="mb-5 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">
        Perfil actualizado correctamente
      </div>
    </Transition>

    <form @submit.prevent="handleSave" class="space-y-4">
      <div>
        <label class="field-label">Correo electrónico</label>
        <div class="field-readonly">{{ authStore.user?.email }}</div>
      </div>
      <div>
        <label class="field-label">Nombre completo</label>
        <input v-model="form.full_name" type="text" class="field-input" placeholder="Tu nombre" />
      </div>
      <div>
        <label class="field-label">Teléfono</label>
        <input v-model="form.phone" type="tel" class="field-input" placeholder="+57 300 000 0000" />
      </div>
      <div>
        <label class="field-label">Empresa</label>
        <input v-model="form.company" type="text" class="field-input" placeholder="Nombre de empresa" />
      </div>
      <button type="submit" :disabled="saving" class="submit-btn">
        <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
        <span>{{ saving ? 'Guardando...' : 'Guardar cambios' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Loader2 } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore = useAuthStore()
const { close } = useAuthModal()

const form   = reactive({ full_name: '', phone: '', company: '' })
const saving = ref(false)
const saved  = ref(false)

onMounted(() => {
  form.full_name = authStore.profile?.full_name ?? ''
  form.phone     = authStore.profile?.phone     ?? ''
  form.company   = authStore.profile?.company   ?? ''
})

async function handleSave() {
  saving.value = true
  try {
    await authStore.updateProfile({
      full_name: form.full_name || undefined,
      phone:     form.phone     || undefined,
      company:   form.company   || undefined,
    })
    saved.value = true
    setTimeout(() => { saved.value = false; close() }, 1500)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label   { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input   { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.field-readonly{ @apply text-sm text-slate-900 py-2.5 px-0; }
.submit-btn    { @apply w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 7.2: Commit**

```bash
git add src/modules/auth/components/EditProfileForm.vue
git commit -m "feat: add EditProfileForm component"
```

---

## Task 8: `ProfileDropdown.vue`

**Files:**
- Create: `src/modules/auth/components/ProfileDropdown.vue`

Detecta clic fuera con un listener en `document`. El avatar muestra un ring cuando el dropdown está abierto.

- [ ] **Step 8.1: Crear el componente**

Crea `src/modules/auth/components/ProfileDropdown.vue`:

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
      <div v-if="isOpen" class="dropdown-menu">
        <!-- Cabecera usuario -->
        <div class="dropdown-header">
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
        <div class="dropdown-body">
          <button class="dropdown-item" @click="onEditProfile">
            <Pencil class="h-3.5 w-3.5 flex-shrink-0" />
            Editar perfil
          </button>
          <div class="dropdown-divider" />
          <button class="dropdown-item dropdown-item--danger" @click="onSignOut">
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
import { Pencil, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '../composables/useAuthModal'

const authStore          = useAuthStore()
const { open }           = useAuthModal()

const isOpen       = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitials = computed(() => {
  const name = authStore.profile?.full_name ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

function toggle() { isOpen.value = !isOpen.value }

function handleOutsideClick(e: MouseEvent) {
  if (!containerRef.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

function onEditProfile() {
  isOpen.value = false
  open('editProfile')
}

async function onSignOut() {
  isOpen.value = false
  await authStore.signOut()
}
</script>

<style scoped>
@reference "../../../style.css";

.dropdown-menu {
  @apply absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden;
}

.dropdown-header {
  @apply flex items-center gap-3 px-4 py-3 border-b border-slate-100;
}

.dropdown-body {
  @apply p-1.5;
}

.dropdown-item {
  @apply flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors;
}

.dropdown-item--danger {
  @apply text-red-500 hover:bg-red-50;
}

.dropdown-divider {
  @apply h-px bg-slate-100 my-1;
}

.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }
</style>
```

- [ ] **Step 8.2: Commit**

```bash
git add src/modules/auth/components/ProfileDropdown.vue
git commit -m "feat: add ProfileDropdown component"
```

---

## Task 9: Conectar `AuthModal` en `App.vue`

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 9.1: Agregar `<AuthModal />` al template**

Reemplaza el contenido completo de `src/App.vue`:

```vue
<template>
  <Analytics />
  <SpeedInsights />
  <RouterView />
  <AuthModal />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Analytics } from '@vercel/analytics/vue'
import { SpeedInsights } from '@vercel/speed-insights/vue'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import AuthModal from '@/modules/auth/components/AuthModal.vue'

const catalogStore = useCatalogStore()
const authStore    = useAuthStore()

onMounted(() => {
  catalogStore.initialize()
  authStore.init()
})
</script>
```

- [ ] **Step 9.2: Verificar sin errores**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 9.3: Commit**

```bash
git add src/App.vue
git commit -m "feat: mount AuthModal in App root"
```

---

## Task 10: Actualizar `TheNavbar.vue`

**Files:**
- Modify: `src/modules/shop/components/TheNavbar.vue`

Reemplazar:
1. `RouterLink to="/login"` → `<button @click="authModal.open('login')">`
2. `RouterLink to="/me"` con el círculo de iniciales → `<ProfileDropdown />`

- [ ] **Step 10.1: Reemplazar el bloque `<!-- Auth -->` del template**

En `src/modules/shop/components/TheNavbar.vue`, localiza el bloque `<!-- Auth -->` (líneas 70–85) y reemplázalo:

```html
<!-- Auth -->
<button
  v-if="!authStore.isAuthenticated"
  @click="authModal.open('login')"
  class="hidden sm:flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap font-medium"
>
  <User class="h-4 w-4" />
  Ingresar
</button>
<ProfileDropdown v-else class="hidden sm:block" />
```

- [ ] **Step 10.2: Actualizar el `<script setup>` del navbar**

Agrega los imports y el composable. El bloque `<script setup>` completo queda:

```ts
import { ref, shallowRef, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { Search, ShoppingCart, Calculator, ChevronRight, Wrench, Settings2, Gauge, Filter, Thermometer, Layers, Cpu, User } from '@lucide/vue'
import { useCartStore } from '@/modules/cart/stores/cart.store'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'
import ProfileDropdown from '@/modules/auth/components/ProfileDropdown.vue'

const cartStore    = useCartStore()
const catalogStore = useCatalogStore()
const authStore    = useAuthStore()
const authModal    = useAuthModal()

const router = useRouter()
const route  = useRoute()

const { y } = useWindowScroll()
const scrolled = shallowRef(false)
watch(y, val => { scrolled.value = val > 10 })

const searchValue  = ref('')
const selectedLine = ref('')
const activeLine   = ref('')

function handleSearch() {
  if (!searchValue.value.trim()) return
  router.push({ path: '/catalog', query: { q: searchValue.value, line: selectedLine.value || undefined } })
}

function isActiveLine(code: string) { return activeLine.value === code || route.query.line === code }
function setActiveLine(code: string) { activeLine.value = code }

const ICON_MAP: Record<string, unknown> = { Wrench, Settings2, Gauge, Filter, Thermometer, Layers, Cpu }
function lineIcon(name: string) { return ICON_MAP[name] ?? Wrench }
```

Nota: elimina también el `computed` de `userInitials` que ya no se usa (estaba en el navbar original).

- [ ] **Step 10.3: Commit**

```bash
git add src/modules/shop/components/TheNavbar.vue
git commit -m "feat: wire auth modal and profile dropdown in navbar"
```

---

## Task 11: Limpiar router y eliminar views obsoletas

**Files:**
- Modify: `src/router/index.ts`
- Delete: `src/modules/auth/views/LoginView.vue`
- Delete: `src/modules/auth/views/RegisterView.vue`
- Delete: `src/modules/auth/views/OnboardingView.vue`
- Delete: `src/modules/auth/views/ProfileView.vue`

- [ ] **Step 11.1: Reemplazar `src/router/index.ts` completo**

```ts
import { createRouter, createWebHistory } from 'vue-router'
import ShopLayout from '@/layouts/ShopLayout.vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useAuthModal } from '@/modules/auth/composables/useAuthModal'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Shop ──────────────────────────────────────────────────────
    {
      path: '/',
      component: ShopLayout,
      children: [
        { path: '',                name: 'landing',        component: () => import('@/modules/landing/views/LandingView.vue') },
        { path: 'catalog',         name: 'catalog',        component: () => import('@/modules/catalog/views/CatalogView.vue') },
        { path: 'product/:id',     name: 'product-detail', component: () => import('@/modules/catalog/views/ProductDetailView.vue') },
        { path: 'cart',            name: 'cart',           component: () => import('@/modules/cart/views/CartView.vue') },
        { path: 'checkout',        name: 'checkout',       component: () => import('@/modules/cart/views/CartView.vue') },
        { path: 'hvac-calculator', name: 'hvac-calculator',component: () => import('@/modules/hvac/views/HvacCalculatorView.vue') },
      ],
    },

    // ── Admin panel ───────────────────────────────────────────────
    {
      path: '/admin',
      component: () => import('@/modules/admin/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '',                  redirect: '/admin/products' },
        { path: 'products',          name: 'admin-products',    component: () => import('@/modules/admin/views/AdminProductsView.vue') },
        { path: 'products/new',      name: 'admin-product-new', component: () => import('@/modules/admin/views/AdminProductFormView.vue') },
        { path: 'products/:id/edit', name: 'admin-product-edit',component: () => import('@/modules/admin/views/AdminProductFormView.vue') },
        { path: 'catalog',           name: 'admin-catalog',     component: () => import('@/modules/admin/views/AdminCatalogView.vue') },
        { path: 'settings',          name: 'admin-settings',    component: () => import('@/modules/admin/views/AdminSettingsView.vue') },
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

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Cancela la navegación y abre el modal de login
      const { open } = useAuthModal()
      open('login')
      return false
    }
    if (!authStore.isAdmin) return { name: 'landing' }
  }

  return true
})

export default router
```

- [ ] **Step 11.2: Eliminar las views obsoletas**

Usando la herramienta Bash (no PowerShell):

```bash
rm "src/modules/auth/views/LoginView.vue" \
   "src/modules/auth/views/RegisterView.vue" \
   "src/modules/auth/views/OnboardingView.vue" \
   "src/modules/auth/views/ProfileView.vue"
```

- [ ] **Step 11.3: Verificar que no hay referencias rotas**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 11.4: Correr todos los tests**

```bash
npm run test
```

Esperado: todos pasan.

- [ ] **Step 11.5: Commit final**

```bash
git add -A
git commit -m "feat: replace auth routes with modal system, remove obsolete views"
```

---

## Verificación manual

Una vez completadas todas las tareas, verificar en el navegador (`npm run dev`):

1. **Login:** Hacer clic en "Ingresar" → aparece modal con blur. Ingresar credenciales → modal se cierra, usuario queda en la misma página.
2. **Registro:** Dentro del modal de login, clic en "Regístrate" → cambia al formulario de registro sin cerrar el modal.
3. **Onboarding:** Tras registrarse → modal cambia a onboarding automáticamente.
4. **Dropdown:** Hacer clic en el círculo de iniciales → dropdown con nombre, email y acciones.
5. **Editar perfil:** Clic en "Editar perfil" → modal con formulario prellenado → guardar cierra el modal.
6. **Cerrar sesión:** Clic en "Cerrar sesión" → usuario queda en la página actual, navbar vuelve a mostrar "Ingresar".
7. **Admin:** Intentar ir a `/admin` sin sesión → modal de login aparece, navegación cancelada.
8. **Cierre:** Clic fuera de la card o en X → modal se cierra.
