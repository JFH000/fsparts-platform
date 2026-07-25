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
