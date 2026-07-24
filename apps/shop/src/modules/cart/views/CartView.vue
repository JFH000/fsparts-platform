<template>
  <div class="max-w-6xl mx-auto px-4 py-10">
    <nav class="flex items-center gap-2 text-xs text-slate-400 mb-6">
      <RouterLink to="/" class="hover:text-brand-600">Inicio</RouterLink>
      <ChevronRight class="h-3 w-3" />
      <span class="text-slate-700 font-medium">Carrito de compras</span>
    </nav>

    <h1 class="text-2xl font-bold text-slate-900 mb-8">
      Carrito de compras
      <span class="text-base font-normal text-slate-400 ml-2">({{ cart.totalItems }} productos)</span>
    </h1>

    <div v-if="cart.items.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Items -->
      <div class="lg:col-span-2 space-y-4">
        <div
          v-for="item in cart.items"
          :key="item.product.id"
          class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex gap-4 items-center"
        >
          <RouterLink :to="`/product/${item.product.id}`">
            <img :src="item.product.images[0]" :alt="item.product.name" class="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
          </RouterLink>
          <div class="flex-1 min-w-0">
            <RouterLink :to="`/product/${item.product.id}`">
              <p class="font-semibold text-slate-900 hover:text-brand-700 transition-colors">{{ item.product.name }}</p>
            </RouterLink>
            <p class="text-xs text-slate-400 font-mono mt-0.5">{{ item.product.sku }}</p>
            <p class="text-xs text-brand-700 font-bold mt-1">{{ item.product.brand.name }}</p>
          </div>
          <div class="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button @click="cart.updateQuantity(item.product.id, item.quantity - 1)" :aria-label="`Disminuir cantidad de ${item.product.name}`" class="px-3 py-2 text-slate-500 hover:bg-slate-100 font-bold">−</button>
            <span class="px-4 text-sm font-semibold min-w-[2.5rem] text-center">{{ item.quantity }}</span>
            <button @click="cart.updateQuantity(item.product.id, item.quantity + 1)" :aria-label="`Aumentar cantidad de ${item.product.name}`" class="px-3 py-2 text-slate-500 hover:bg-slate-100 font-bold">+</button>
          </div>
          <p class="font-extrabold text-slate-900 w-24 text-right">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</p>
          <button @click="cart.removeFromCart(item.product.id)" :aria-label="`Eliminar ${item.product.name} del carrito`" class="text-slate-300 hover:text-red-400 transition-colors ml-1">
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Summary -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-32">
          <h2 class="font-bold text-slate-900 text-lg mb-5">Resumen del pedido</h2>

          <div class="space-y-3 mb-5 pb-5 border-b border-slate-100">
            <div v-for="item in cart.items" :key="item.product.id" class="flex justify-between text-sm text-slate-600">
              <span class="truncate max-w-[160px]">{{ item.product.name }} <span class="text-slate-400">×{{ item.quantity }}</span></span>
              <span class="font-medium flex-shrink-0">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</span>
            </div>
          </div>

          <div class="space-y-2 mb-5">
            <div class="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{{ formatCurrency(cart.subtotal) }}</span>
            </div>
            <div class="flex justify-between text-sm text-slate-600">
              <span>Envío</span>
              <span class="text-emerald-600 font-medium">Por cotizar</span>
            </div>
          </div>

          <div class="flex justify-between items-center font-extrabold text-slate-900 text-xl border-t border-slate-100 pt-4">
            <span>Total</span>
            <span>{{ formatCurrency(cart.subtotal) }}</span>
          </div>
          <p class="text-xs text-slate-400 text-right mb-6">COP · IVA incluido</p>

          <AppButton to="/checkout" variant="accent" size="lg" full class="mb-3">
            Proceder al checkout →
          </AppButton>
          <RouterLink to="/catalog" class="block text-center text-sm text-brand-700 hover:text-brand-800 font-medium">
            ← Seguir comprando
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Empty cart -->
    <div v-else class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
        <ShoppingCart class="h-10 w-10 text-slate-300" />
      </div>
      <h2 class="text-xl font-bold text-slate-700 mb-2">Tu carrito está vacío</h2>
      <p class="text-slate-400 mb-8">Explora nuestro catálogo y agrega productos</p>
      <RouterLink to="/catalog" class="bg-brand-700 hover:bg-brand-800 text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
        Ver catálogo
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, ShoppingCart, Trash2 } from '@lucide/vue'
import { AppButton } from '@fsparts/ui'
import { useCartStore } from '../stores/cart.store'
import { formatCurrency } from '@fsparts/core'

const cart = useCartStore()
</script>
