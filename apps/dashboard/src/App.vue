<template>
  <AdminLayout v-if="authStore.isReady && authStore.isAuthenticated && authStore.isAdmin" />

  <div v-else class="min-h-screen flex flex-col">
    <AppHeader app-label="Dashboard" current-app-id="dashboard">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
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
import { AppHeader, AppFooter, AppToast, AppSpinner } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import LoginForm from './modules/auth/components/LoginForm.vue'
import AdminLayout from './modules/admin/layouts/AdminLayout.vue'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
