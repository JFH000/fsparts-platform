<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-8">Mis pedidos</h1>

    <div v-if="loading" class="py-20 text-center">
      <AppSpinner size="lg" class="text-brand-600 mx-auto" />
    </div>

    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="load" class="text-xs text-brand-600 underline hover:text-brand-700">Reintentar</button>
    </div>

    <div v-else-if="!orders.length" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
        <PackageSearch class="h-10 w-10 text-slate-300" />
      </div>
      <h2 class="text-xl font-bold text-slate-700 mb-2">Aún no tienes pedidos</h2>
      <p class="text-slate-400 mb-8">Explora nuestro catálogo y realiza tu primera compra</p>
      <RouterLink to="/catalog" class="bg-brand-700 hover:bg-brand-800 text-white font-bold px-8 py-3.5 rounded-xl transition-colors">
        Ver catálogo
      </RouterLink>
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="order in orders"
        :key="order.id"
        :to="`/orders/${order.id}`"
        class="block bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-brand-200 transition-colors"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-slate-900">Pedido del {{ formatDate(order.created_at) }}</span>
          <OrderStatusBadge :status="order.status" />
        </div>
        <div class="flex items-center justify-between text-sm text-slate-500">
          <span>{{ order.items.length }} producto{{ order.items.length === 1 ? '' : 's' }}</span>
          <span class="font-bold text-slate-900">{{ formatCurrency(order.subtotal) }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PackageSearch } from '@lucide/vue'
import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
import { listMyOrders } from '../services/orders.service'
import { formatCurrency } from '@fsparts/core'
import type { Order } from '@fsparts/core'

const orders    = ref<Order[]>([])
const loading   = ref(true)
const loadError = ref<string | null>(null)

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    orders.value = await listMyOrders()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>
