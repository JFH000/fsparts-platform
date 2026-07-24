<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Shop" current-app-id="shop">
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
    <AuthModal />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'
import AuthModal from './modules/auth/components/AuthModal.vue'
import ProfileDropdown from './modules/auth/components/ProfileDropdown.vue'
import { useAuthModal } from './modules/auth/composables/useAuthModal'

const authStore = useAuthStore()
const { open: openAuthModal } = useAuthModal()

onMounted(() => { authStore.init() })
</script>
