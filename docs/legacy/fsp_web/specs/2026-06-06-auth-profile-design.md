# Auth & Perfil de Usuario — Design Spec

**Goal:** Implementar login/register general para todos los usuarios, onboarding post-registro, y página de perfil `/me` con acceso al panel admin para administradores.

**Architecture:** Frontend-only con Supabase Auth. Nuevas vistas en `src/modules/auth/views/`. El auth store se extiende mínimamente para soportar perfil completo. `/admin/login` se elimina y es reemplazado por `/login`.

**Tech Stack:** Vue 3 SFC, Pinia, Supabase (auth + user_profiles), Vue Router, Tailwind CSS 4, Lucide icons.

---

## Rutas

| Ruta | Componente | Guard | Comportamiento post-acción |
|---|---|---|---|
| `/login` | `LoginView.vue` | público (redirige a `/me` si ya autenticado) | login → admin va a `/admin/products`, customer va a `/me` |
| `/register` | `RegisterView.vue` | público (redirige a `/me` si ya autenticado) | register → va a `/onboarding` |
| `/onboarding` | `OnboardingView.vue` | requiere auth | guardar perfil → va a `/me` |
| `/me` | `ProfileView.vue` | requiere auth | — |

`/admin/login` se elimina del router. El guard de rutas admin redirige a `/login` (no a `admin-login`).

---

## Vistas

### `LoginView.vue` — Split screen

Layout 50/50 en desktop, columna en móvil:

**Panel izquierdo** (fondo `slate-900`, dot-grid background):
- Logo FS Parts (icono + texto)
- Headline: "Tu distribuidor HVAC/R de confianza"
- 3 bullets con iconos: catálogo, calculadora, soporte técnico

**Panel derecho** (fondo blanco):
- Título "Iniciar sesión"
- Campo email (type email, requerido)
- Campo contraseña con toggle de visibilidad
- Botón "Ingresar" (brand-700, full-width)
- Mensaje de error inline si falla
- Link "¿No tienes cuenta? Regístrate" → `/register`
- Link "Volver al catálogo" → `/`

### `RegisterView.vue` — Split screen (mismo layout)

**Panel derecho:**
- Título "Crear cuenta"
- Campo email (requerido)
- Campo contraseña (requerido, mín. 6 caracteres)
- Campo confirmar contraseña (validación cliente)
- Botón "Registrarse"
- Mensaje de error inline
- Link "¿Ya tienes cuenta? Inicia sesión" → `/login`

### `OnboardingView.vue` — Página centrada

Página fondo `slate-50`, card blanca centrada. Una sola pantalla (no wizard):
- Título "Cuéntanos sobre ti"
- Subtítulo "Solo tomará un momento"
- Campo Nombre completo (requerido)
- Campo Teléfono (opcional, type tel)
- Campo Empresa (opcional)
- Botón "Continuar" → llama `authStore.updateProfile()` → redirige a `/me`
- Link "Omitir por ahora" → redirige a `/me` sin guardar (no causa loop: el guard de `/onboarding` solo exige auth, no perfil completo)

### `ProfileView.vue` — Sidebar + contenido

Layout con sidebar fijo izquierdo, área de contenido derecha.

**Sidebar** (`w-56`, fondo `slate-900`, texto blanco):
- Avatar circular con iniciales del nombre (fondo `brand-700`)
- Nombre completo
- Badge de rol: `admin` → badge rojo/oscuro, `customer` → badge slate
- Separador
- Enlace "Ver catálogo" → `/catalog`
- Enlace "Calculadora HVAC" → `/hvac-calculator`
- **Botón "Panel Admin"** (fondo `accent-500`, naranja) — visible SOLO si `isAdmin` → `/admin/products`
- Separador
- Botón "Cerrar sesión" (rojo suave) al fondo del sidebar

**Área de contenido:**
- Card "Mi perfil" con campos:
  - Nombre completo
  - Email (siempre readonly — viene de Supabase Auth)
  - Teléfono
  - Empresa
- Por defecto readonly (estilo display). Botón "Editar" top-right de la card.
- En modo edición: campos se vuelven inputs. Botones "Guardar" / "Cancelar".
- Guardar llama `authStore.updateProfile()` y muestra feedback de éxito.

---

## Auth Store — Cambios

Archivo: `src/modules/auth/stores/auth.store.ts`

**Agregar:**
```typescript
const profile = ref<UserProfile | null>(null)

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (data) profile.value = data
}

async function updateProfile(data: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>) {
  if (!user.value) return
  await supabase
    .from('user_profiles')
    .upsert({ id: user.value.id, email: user.value.email, ...data })
  await fetchProfile(user.value.id)
}
```

**Modificar `init()`:** llamar `fetchProfile()` además de `fetchRole()`. Unificar en un solo select `*` en lugar de dos llamadas.

**Exponer:** `profile` en el return del store.

---

## Router — Cambios

Archivo: `src/router/index.ts`

1. Agregar rutas `/login`, `/register`, `/onboarding`, `/me` (sin layout de shop, layout propio centrado)
2. Eliminar ruta `admin-login` (`/admin/login`)
3. Guard de rutas admin: cambiar `return { name: 'admin-login' }` → `return { name: 'login' }`
4. Guard para rutas auth-only (`/onboarding`, `/me`): si no autenticado → `/login`
5. Guard para rutas públicas-solo (`/login`, `/register`): si ya autenticado → `/me`

---

## Supabase — user_profiles

La tabla ya existe con RLS configurada. El store hace `upsert` al guardar perfil. No se requieren cambios de schema.

Al registrarse un usuario nuevo, Supabase crea el registro en `auth.users` pero NO crea automáticamente una fila en `user_profiles`. El onboarding hace el upsert inicial con role `customer` por defecto.

---

## Archivos a crear / modificar

**Crear:**
- `src/modules/auth/views/LoginView.vue`
- `src/modules/auth/views/RegisterView.vue`
- `src/modules/auth/views/OnboardingView.vue`
- `src/modules/auth/views/ProfileView.vue`

**Modificar:**
- `src/modules/auth/stores/auth.store.ts` — agregar `profile`, `fetchProfile`, `updateProfile`
- `src/router/index.ts` — rutas nuevas, eliminar admin-login, actualizar guards
- `src/modules/auth/views/AdminLoginView.vue` — eliminar archivo

---

## Comportamiento de errores

- Email ya registrado en register → mensaje "Este email ya está en uso"
- Credenciales incorrectas en login → mensaje "Email o contraseña incorrectos"
- Error de red → mensaje genérico "Error de conexión, intenta de nuevo"
- Todos los errores se muestran inline bajo el formulario, no como alertas del navegador
