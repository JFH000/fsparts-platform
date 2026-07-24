<!-- apps/calculator/src/modules/hvac/components/EquipmentSuggestions.vue -->
<template>
  <div v-if="loading" class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
    <p class="text-sm text-slate-400">Buscando equipos recomendados…</p>
  </div>

  <div v-else-if="suggestions.length" class="rounded-2xl border border-slate-200 overflow-hidden mb-6">
    <div class="px-5 py-3 border-b border-slate-100">
      <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipos recomendados</p>
    </div>
    <div class="divide-y divide-slate-50">
      <div v-for="product in suggestions" :key="product.id" class="flex items-center justify-between gap-3 px-5 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">{{ product.name }}</p>
          <p class="text-xs text-slate-400">{{ capacityLabel(product) }} · {{ formatCurrency(product.priceCop ?? product.priceUsd ?? 0) }}</p>
        </div>
        <a :href="productUrl(product)" class="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">Ver producto →</a>
      </div>
    </div>
  </div>

  <div v-else class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
    <Wrench class="h-6 w-6 text-slate-300 mx-auto mb-2" aria-hidden="true" />
    <p class="text-sm font-semibold text-slate-400">Equipos recomendados</p>
    <p class="text-xs text-slate-300 mt-1">No encontramos equipos con esa capacidad en el catálogo</p>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { Wrench } from '@lucide/vue'
import { formatCurrency, type Product } from '@fsparts/core'
import { useEquipmentSuggestions } from '../composables/useEquipmentSuggestions'

const props = defineProps<{ targetTons: number }>()
const targetTonsRef = toRef(props, 'targetTons')
const { suggestions, loading } = useEquipmentSuggestions(targetTonsRef)

const shopUrl = import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org'

function productUrl(product: Product): string {
  return `${shopUrl}/product/${product.slug}`
}

function capacityLabel(product: Product): string {
  const spec = product.specs.find(s => s.key.toLowerCase() === 'capacidad')
  return spec ? `${spec.value} ${spec.unit ?? ''}`.trim() : ''
}
</script>
