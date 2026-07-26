# Auth Modal Flow — Design Spec
**Date:** 2026-06-07
**Status:** Approved

## Overview

Reemplazar todas las rutas de autenticación y perfil (`/login`, `/register`, `/onboarding`, `/me`) por modales que aparecen sobre la página actual. El usuario nunca abandona la página en la que está para autenticarse o editar su perfil.

---

## Architecture

### State management: `useAuthModal` composable

Un único composable reactivo controla qué modal está abierto:

```ts
type AuthModalMode = 'login' | 'register' | 'onboarding' | 'editProfile' | null
```

- `mode: AuthModalMode` — modal activo (null = cerrado)
- `open(mode)` — abre el modal en el modo indicado
- `close()` — cierra el modal
- `switchTo(mode)` — cambia de modo sin cerrar (login ↔ register)

El composable vive en `src/modules/auth/composables/useAuthModal.ts` y se comparte como singleton (usando `ref` fuera del setup scope).

### Componentes nuevos

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `AuthModal.vue` | `src/modules/auth/components/` | Shell del modal: overlay blur, card centrada, botón X. Renderiza el slot correcto según `mode`. |
| `LoginForm.vue` | `src/modules/auth/components/` | Formulario de login extraído de `LoginView.vue` |
| `RegisterForm.vue` | `src/modules/auth/components/` | Formulario de registro extraído de `RegisterView.vue` |
| `OnboardingForm.vue` | `src/modules/auth/components/` | Formulario de onboarding extraído de `OnboardingView.vue` |
| `EditProfileForm.vue` | `src/modules/auth/components/` | Formulario de edición de perfil extraído de `ProfileView.vue` |
| `ProfileDropdown.vue` | `src/modules/auth/components/` | Dropdown del perfil: cabecera con nombre/email + acciones |

`AuthModal.vue` se monta **una sola vez** en `App.vue` vía `<Teleport to="body">`.

---

## Flujos

### Login
1. Usuario hace clic en "Ingresar" (navbar) → `authModal.open('login')`
2. Modal aparece con blur de fondo, formulario de login centrado
3. Login exitoso → `authModal.close()`, usuario queda en la página actual
4. Si el perfil no tiene `full_name` → `authModal.open('onboarding')` automáticamente
5. Admin → redirige a `/admin/products` (única excepción de navegación post-login)

### Registro
1. Clic en "Regístrate" dentro del modal login → `authModal.switchTo('register')`
2. Registro exitoso → automáticamente `authModal.switchTo('onboarding')`
3. Onboarding completo u omitido → `authModal.close()`

### Editar perfil
1. Usuario autenticado hace clic en el círculo de iniciales (navbar)
2. Se despliega `ProfileDropdown.vue` (posicionado bajo el avatar)
3. Clic en "Editar perfil" → `authModal.open('editProfile')`
4. Guardado → `authModal.close()`

### Cerrar sesión
- Clic en "Cerrar sesión" en el dropdown → `authStore.signOut()`, dropdown se cierra, usuario queda en la página actual

---

## AuthModal — Comportamiento visual

- **Overlay:** `rgba(15, 23, 42, 0.25)` con `backdrop-filter: blur(4px)`
- **Card:** fondo blanco, `border-radius: 1rem`, `box-shadow` pronunciado, `max-width: 400px`
- **Cierre:** botón X en esquina superior derecha + clic fuera de la card. Cierra en todos los modos. En onboarding, el botón "Omitir por ahora" también cierra el modal.
- **Transición:** fade + scale sutil (enter/leave)
- **Scroll lock:** `overflow: hidden` en `<body>` mientras el modal está abierto

---

## ProfileDropdown — Comportamiento

- Se abre al hacer clic en el avatar (círculo con iniciales)
- Se cierra al hacer clic fuera del dropdown
- Cabecera: avatar pequeño + nombre completo + email
- Acciones por ahora: "Editar perfil", "Cerrar sesión" (extensible con más opciones luego)
- Posición: alineado a la derecha del avatar, debajo del navbar
- El avatar muestra un borde sutil cuando el dropdown está abierto

---

## Rutas eliminadas

| Ruta | Motivo |
|---|---|
| `/login` | Reemplazada por `authModal.open('login')` |
| `/register` | Reemplazada por `authModal.open('register')` |
| `/onboarding` | Reemplazada por `authModal.open('onboarding')` |
| `/me` | Reemplazada por `authModal.open('editProfile')` |

El guard de router se simplifica: eliminar `publicOnly` y `requiresUser`. Solo queda la lógica de `requiresAuth` para `/admin`.

---

## Cambios en el navbar (`TheNavbar.vue`)

- Botón "Ingresar" (usuario anónimo) → llama `authModal.open('login')` en lugar de navegar a `/login`
- RouterLink al perfil (`/me`) → reemplazado por el componente `ProfileDropdown.vue`

---

## Archivos a eliminar

- `src/modules/auth/views/LoginView.vue`
- `src/modules/auth/views/RegisterView.vue`
- `src/modules/auth/views/OnboardingView.vue`
- `src/modules/auth/views/ProfileView.vue`

---

## Archivos a crear

- `src/modules/auth/composables/useAuthModal.ts`
- `src/modules/auth/components/AuthModal.vue`
- `src/modules/auth/components/LoginForm.vue`
- `src/modules/auth/components/RegisterForm.vue`
- `src/modules/auth/components/OnboardingForm.vue`
- `src/modules/auth/components/EditProfileForm.vue`
- `src/modules/auth/components/ProfileDropdown.vue`

---

## Archivos a modificar

- `src/App.vue` — montar `<AuthModal>` con Teleport
- `src/modules/shop/components/TheNavbar.vue` — botón Ingresar + avatar/dropdown
- `src/router/index.ts` — eliminar rutas auth, simplificar guards
