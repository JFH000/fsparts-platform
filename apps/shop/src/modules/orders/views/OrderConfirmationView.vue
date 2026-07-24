<template>
  <div class="max-w-2xl mx-auto px-4 py-16 text-center">
    <div v-if="loading" class="py-20">
      <AppSpinner size="lg" class="text-brand-600 mx-auto mb-4" />
      <p class="text-slate-500">Confirmando tu pago…</p>
    </div>

    <div v-else-if="order">
      <div class="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Check class="h-8 w-8 text-emerald-600" />
      </div>
      <h1 class="text-2xl font-bold text-slate-900 mb-2">¡Gracias por tu compra!</h1>
      <p v-if="order.status === 'pending_payment'" class="text-slate-500 mb-8">
        Tu pago está siendo procesado. Te notificaremos apenas se confirme.
      </p>
      <p v-else class="text-slate-500 mb-8">
        Pedido confirmado. Puedes ver el detalle en tus pedidos.
      </p>

      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left mb-8">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-slate-500">Total</span>
          <span class="font-extrabold text-slate-900 text-lg">{{ formatCurrency(order.subtotal) }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="item in order.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
            <span>{{ item.name }} ×{{ item.quantity }}</span>
            <span>{{ formatCurrency(item.line_total) }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center gap-4">
        <RouterLink to="/orders" class="bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          Ver mis pedidos
        </RouterLink>
        <RouterLink to="/catalog" class="text-brand-700 hover:text-brand-800 font-medium">
          Seguir comprando
        </RouterLink>
      </div>
    </div>

    <div v-else class="py-20">
      <p class="text-slate-500 mb-4">No encontramos información de este pedido.</p>
      <RouterLink to="/catalog" class="text-brand-700 font-semibold hover:text-brand-800">Ver catálogo</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Check } from '@lucide/vue'
import { AppSpinner } from '@fsparts/ui'
import { fetchOrderBySessionId } from '../services/orders.service'
import { formatCurrency } from '@fsparts/core'
import type { Order } from '@fsparts/core'
import { useCartStore } from '@/modules/cart/stores/cart.store'

const route   = useRoute()
const order   = ref<Order | null>(null)
const loading = ref(true)

const MAX_POLLS      = 5
const POLL_INTERVAL  = 2000
let pollTimer: ReturnType<typeof setTimeout> | null = null
let polls = 0

async function poll() {
  const sessionId = route.query.session_id as string | undefined
  if (!sessionId) { loading.value = false; return }
  try {
    const result = await fetchOrderBySessionId(sessionId)
    order.value = result
    if (result && result.status !== 'pending_payment') {
      loading.value = false
      useCartStore().clearCart()
      return
    }
    polls++
    if (polls >= MAX_POLLS) { loading.value = false; return }
    pollTimer = setTimeout(poll, POLL_INTERVAL)
  } catch {
    loading.value = false
  }
}

onMounted(poll)
onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>
