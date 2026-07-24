<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <RouterLink to="/orders" class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 mb-6">
      <ArrowLeft class="h-4 w-4" /> Volver a mis pedidos
    </RouterLink>

    <div v-if="loading" class="py-20 text-center">
      <AppSpinner size="lg" class="text-brand-600 mx-auto" />
    </div>

    <div v-else-if="!order" class="text-center py-20">
      <p class="text-slate-500">No encontramos este pedido.</p>
    </div>

    <div v-else class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-bold text-slate-900">Pedido del {{ formatDate(order.created_at) }}</h1>
          <p class="text-xs text-slate-400 font-mono mt-0.5">{{ order.id }}</p>
        </div>
        <OrderStatusBadge :status="order.status" />
      </div>

      <div class="space-y-2 mb-6 pb-6 border-b border-slate-100">
        <div v-for="item in order.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
          <span>{{ item.name }} <span class="text-slate-400">×{{ item.quantity }}</span></span>
          <span class="font-medium">{{ formatCurrency(item.line_total) }}</span>
        </div>
      </div>

      <div class="flex justify-between items-center font-extrabold text-slate-900 text-lg mb-6">
        <span>Total</span>
        <span>{{ formatCurrency(order.subtotal) }}</span>
      </div>

      <div class="text-sm text-slate-600 space-y-1">
        <p class="font-semibold text-slate-900 mb-1">Envío</p>
        <p>{{ order.shipping_name }} · {{ order.shipping_phone }}</p>
        <p v-if="order.shipping_company" class="text-slate-500">
          {{ order.shipping_company }}<span v-if="order.shipping_tax_id"> · NIT {{ order.shipping_tax_id }}</span>
        </p>
        <p>{{ order.shipping_address }}, {{ order.shipping_city }}</p>
        <p v-if="order.shipping_notes" class="text-slate-400">{{ order.shipping_notes }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
import { fetchOrderById } from '../services/orders.service'
import { formatCurrency } from '@fsparts/core'
import type { Order } from '@fsparts/core'

const route   = useRoute()
const order   = ref<Order | null>(null)
const loading = ref(true)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(async () => {
  try {
    order.value = await fetchOrderById(route.params.id as string)
  } finally {
    loading.value = false
  }
})
</script>
