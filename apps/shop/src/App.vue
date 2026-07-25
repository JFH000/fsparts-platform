<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Shop" current-app-id="shop">
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
</script>
