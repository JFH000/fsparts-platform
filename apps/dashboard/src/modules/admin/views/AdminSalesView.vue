<template>
  <div class="p-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Ventas</h1>
      <p class="text-sm text-slate-500 mt-0.5">{{ filtered.length }} pedidos</p>
    </div>

    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          v-model="searchQuery"
          placeholder="Buscar por cliente o teléfono..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>
      <div class="flex flex-wrap gap-1.5" role="list" aria-label="Filtrar por estado">
        <button
          v-for="f in statusFilters"
          :key="f.value"
          @click="activeStatus = f.value"
          :aria-pressed="activeStatus === f.value"
          :class="[
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            activeStatus === f.value
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700',
          ]"
        >
          {{ f.label }}
          <span class="ml-1 font-normal opacity-60">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <AppSpinner size="lg" class="text-brand-600" />
    </div>

    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="loadOrders" class="text-xs text-brand-600 underline hover:text-brand-700">Reintentar</button>
    </div>

    <div v-else class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Cliente</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Fecha</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden md:table-cell">Items</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Total</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Estado</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr
            v-for="o in filtered"
            :key="o.id"
            @click="openPanel(o)"
            class="hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <td class="px-5 py-3.5">
              <p class="font-semibold text-slate-900">{{ o.shipping_name }}</p>
              <p class="text-xs text-slate-400">{{ o.shipping_phone }}</p>
            </td>
            <td class="px-5 py-3.5 text-slate-600 text-sm">{{ formatDate(o.created_at) }}</td>
            <td class="px-5 py-3.5 text-slate-600 text-sm hidden md:table-cell">{{ o.items.length }}</td>
            <td class="px-5 py-3.5 font-bold text-slate-900">{{ formatCurrency(o.subtotal) }}</td>
            <td class="px-5 py-3.5"><OrderStatusBadge :status="o.status" /></td>
            <td class="px-5 py-3.5"><ChevronRight class="h-4 w-4 text-slate-300" /></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length && !loading" class="py-16 text-center text-slate-400 text-sm">
        No se encontraron pedidos
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selected" class="fixed inset-0 bg-black/30 z-50" @click="closePanel" aria-hidden="true" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="selected"
          role="dialog"
          aria-modal="true"
          class="fixed top-0 right-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col"
        >
          <div class="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
            <div>
              <p class="font-bold text-slate-900">{{ selected.shipping_name }}</p>
              <p class="text-xs text-slate-400 font-mono">{{ selected.id }}</p>
            </div>
            <button @click="closePanel" aria-label="Cerrar panel" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <div class="space-y-2 pb-5 border-b border-slate-100">
              <div v-for="item in selected.items" :key="item.product_id" class="flex justify-between text-sm text-slate-600">
                <span>{{ item.name }} ×{{ item.quantity }}</span>
                <span class="font-medium">{{ formatCurrency(item.line_total) }}</span>
              </div>
              <div class="flex justify-between font-bold text-slate-900 pt-2">
                <span>Total</span>
                <span>{{ formatCurrency(selected.subtotal) }}</span>
              </div>
            </div>

            <dl class="space-y-2 text-sm">
              <div v-if="selected.shipping_company">
                <dt class="text-slate-400 text-xs">Facturación</dt>
                <dd class="text-slate-900">
                  {{ selected.shipping_company }}<span v-if="selected.shipping_tax_id"> · NIT {{ selected.shipping_tax_id }}</span>
                </dd>
              </div>
              <div>
                <dt class="text-slate-400 text-xs">Envío</dt>
                <dd class="font-medium text-slate-900">{{ selected.shipping_address }}, {{ selected.shipping_city }}</dd>
              </div>
              <div v-if="selected.shipping_notes">
                <dt class="text-slate-400 text-xs">Notas</dt>
                <dd class="text-slate-700">{{ selected.shipping_notes }}</dd>
              </div>
              <div>
                <dt class="text-slate-400 text-xs">Teléfono</dt>
                <dd class="text-slate-900">{{ selected.shipping_phone }}</dd>
              </div>
              <div v-if="selected.stripe_payment_intent_id">
                <dt class="text-slate-400 text-xs">Stripe</dt>
                <dd class="font-mono text-xs text-slate-500">{{ selected.stripe_payment_intent_id }}</dd>
              </div>
            </dl>

            <div class="border-t border-slate-100 pt-5">
              <label for="panel-status" class="block text-xs font-semibold text-slate-500 mb-1.5">Estado</label>
              <select
                id="panel-status"
                v-model="panelStatus"
                class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="paid">Pagado</option>
                <option value="preparing">Preparando</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div class="p-6 border-t border-slate-100 flex-shrink-0">
            <p v-if="saveError" class="text-xs text-red-500 mb-3">{{ saveError }}</p>
            <button
              @click="saveStatus"
              :disabled="saving || panelStatus === selected.status"
              class="w-full bg-brand-700 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Guardando...' : 'Actualizar estado' }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, ChevronRight, X } from '@lucide/vue'
import { AppSpinner, OrderStatusBadge } from '@fsparts/ui'
import { listAllOrders, updateOrderStatus } from '../services/sales.service'
import { formatCurrency } from '@fsparts/core'
import type { Order, OrderStatus } from '@fsparts/core'

const orders       = ref<Order[]>([])
const loading      = ref(true)
const loadError    = ref<string | null>(null)
const searchQuery  = ref('')
const activeStatus = ref<OrderStatus | 'all'>('all')

const selected    = ref<Order | null>(null)
const panelStatus = ref<OrderStatus>('paid')
const saving      = ref(false)
const saveError   = ref<string | null>(null)

const VISIBLE_STATUSES: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered', 'cancelled']

const statusFilters = computed(() => {
  const visible = orders.value.filter(o => VISIBLE_STATUSES.includes(o.status))
  const count = (s: OrderStatus) => visible.filter(o => o.status === s).length
  return [
    { value: 'all'       as const, label: 'Todas',      count: visible.length },
    { value: 'paid'      as const, label: 'Pagado',     count: count('paid') },
    { value: 'preparing' as const, label: 'Preparando', count: count('preparing') },
    { value: 'shipped'   as const, label: 'Enviado',    count: count('shipped') },
    { value: 'delivered' as const, label: 'Entregado',  count: count('delivered') },
    { value: 'cancelled' as const, label: 'Cancelado',  count: count('cancelled') },
  ]
})

const filtered = computed(() => {
  let list = orders.value.filter(o => VISIBLE_STATUSES.includes(o.status))
  if (activeStatus.value !== 'all') {
    list = list.filter(o => o.status === activeStatus.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(o =>
      o.shipping_name.toLowerCase().includes(q) ||
      o.shipping_phone.toLowerCase().includes(q)
    )
  }
  return list
})

async function loadOrders() {
  loading.value   = true
  loadError.value = null
  try {
    orders.value = await listAllOrders()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openPanel(o: Order) {
  selected.value    = o
  panelStatus.value = o.status
  saveError.value   = null
}

function closePanel() {
  selected.value = null
}

async function saveStatus() {
  if (!selected.value) return
  saving.value    = true
  saveError.value = null
  try {
    await updateOrderStatus(selected.value.id, panelStatus.value)
    const idx = orders.value.findIndex(o => o.id === selected.value!.id)
    if (idx !== -1) orders.value[idx] = { ...orders.value[idx], status: panelStatus.value }
    closePanel()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(loadOrders)
</script>
