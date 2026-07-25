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
    <CartDrawer />
  </div>
</template>

<script setup lang="ts">
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
</script>
