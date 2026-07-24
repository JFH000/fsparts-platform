<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div
        v-if="cart.isDrawerOpen"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        @click="cart.closeDrawer()"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide-right">
      <div
        v-if="cart.isDrawerOpen"
        class="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 class="font-bold text-slate-900 text-lg flex items-center gap-2">
            <ShoppingCart class="h-5 w-5 text-brand-700" />
            Carrito
            <span class="bg-brand-100 text-brand-800 text-xs font-bold px-2 py-0.5 rounded-full">{{ cart.totalItems }}</span>
          </h2>
          <button @click="cart.closeDrawer()" class="text-slate-400 hover:text-slate-700 transition-colors">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Items -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div v-if="cart.items.length === 0" class="flex flex-col items-center justify-center h-full text-center py-12">
            <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <ShoppingCart class="h-8 w-8 text-slate-300" />
            </div>
            <p class="text-slate-500 font-medium mb-1">Tu carrito está vacío</p>
            <p class="text-slate-400 text-sm mb-6">Agrega productos desde el catálogo</p>
            <button
              @click="cart.closeDrawer()"
              class="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Ver catálogo →
            </button>
          </div>

          <div
            v-for="item in cart.items"
            :key="item.product.id"
            class="flex gap-3 bg-slate-50 rounded-xl p-3 group"
          >
            <RouterLink :to="`/product/${item.product.id}`" @click="cart.closeDrawer()" class="flex-shrink-0">
              <img
                :src="item.product.images[0]"
                :alt="item.product.name"
                class="w-14 h-14 object-cover rounded-lg"
              />
            </RouterLink>
            <div class="flex-1 min-w-0">
              <RouterLink :to="`/product/${item.product.id}`" @click="cart.closeDrawer()">
                <p class="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-brand-700">{{ item.product.name }}</p>
              </RouterLink>
              <p class="text-xs text-slate-400 font-mono">{{ item.product.sku }}</p>
              <p class="text-xs text-brand-700 font-bold mt-1">{{ formatCurrency(cart.lineUnitPrice(item)) }}</p>
            </div>
            <div class="flex flex-col items-end justify-between flex-shrink-0">
              <button
                @click="cart.removeFromCart(item.product.id)"
                :aria-label="`Eliminar ${item.product.name} del carrito`"
                class="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X class="h-4 w-4" />
              </button>
              <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                <button @click="cart.updateQuantity(item.product.id, item.quantity - 1)" :aria-label="`Disminuir cantidad de ${item.product.name}`" class="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm font-bold">−</button>
                <span class="px-2 text-xs font-semibold">{{ item.quantity }}</span>
                <button @click="cart.updateQuantity(item.product.id, item.quantity + 1)" :aria-label="`Aumentar cantidad de ${item.product.name}`" class="px-2 py-1 text-slate-500 hover:bg-slate-50 text-sm font-bold">+</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="cart.items.length > 0" class="px-5 py-5 border-t border-slate-100 bg-white">
          <div class="flex justify-between items-center mb-1">
            <span class="text-slate-600">Subtotal</span>
            <span class="text-xl font-extrabold text-slate-900">{{ formatCurrency(cart.subtotal) }}</span>
          </div>
          <p class="text-xs text-slate-400 text-right mb-4">COP · IVA incluido</p>
          <AppButton to="/cart" variant="primary" size="lg" full class="mb-2" @click="cart.closeDrawer()">
            Ver carrito completo
          </AppButton>
          <AppButton to="/checkout" variant="accent" size="lg" full @click="cart.closeDrawer()">
            Comprar ahora →
          </AppButton>
          <button @click="cart.clearCart()" class="w-full text-center text-xs text-slate-400 hover:text-red-400 mt-3 transition-colors">
            Vaciar carrito
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ShoppingCart, X } from '@lucide/vue'
import { AppButton } from '@fsparts/ui'
import { useCartStore } from '../stores/cart.store'
import { formatCurrency } from '@fsparts/core'

const cart = useCartStore()
</script>
