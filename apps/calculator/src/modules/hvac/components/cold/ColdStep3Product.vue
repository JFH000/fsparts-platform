<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Producto almacenado</h2>
    <p class="text-sm text-slate-500 mb-6">Información para calcular la carga de enfriamiento inicial (pull-down)</p>

    <!-- Product type -->
    <div class="mb-6">
      <label class="field-label">Tipo de producto</label>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button v-for="opt in productOpts" :key="opt.value" @click="form.productType = opt.value"
          class="chip py-2.5 text-left" :class="form.productType === opt.value ? 'chip-active' : 'chip-inactive'">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Mass + entry temp + pull-down hours -->
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div>
        <label class="field-label">Masa del producto</label>
        <div class="relative">
          <input v-model.number="form.productMass" type="number" min="0" class="field-input pr-10" placeholder="0" />
          <span class="unit">kg</span>
        </div>
      </div>
      <div>
        <label class="field-label">Temperatura de entrada</label>
        <div class="relative">
          <input v-model.number="form.productEntryTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">A qué temperatura llega el producto</p>
      </div>
      <div>
        <label class="field-label">Tiempo de pull-down</label>
        <div class="relative">
          <input v-model.number="form.pullDownHours" type="number" min="1" class="field-input pr-8" />
          <span class="unit">h</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Horas para enfriar el producto</p>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColdInputs, ProductType } from '../../utils/cold-calculator'

defineProps<{ form: ColdInputs }>()
defineEmits<{ next: []; back: [] }>()

const productOpts: { value: ProductType; label: string }[] = [
  { value: 'fruits_veg', label: 'Frutas / Verduras' },
  { value: 'meat',       label: 'Carnes'            },
  { value: 'dairy',      label: 'Lácteos'           },
  { value: 'frozen',     label: 'Congelados'        },
  { value: 'flowers',    label: 'Flores'            },
  { value: 'other',      label: 'Otro'              },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150 cursor-pointer select-none active:scale-95; }
.chip-active   { @apply border-brand-600 bg-brand-100 text-brand-800 shadow-sm ring-1 ring-brand-400 ring-offset-1; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900; }
.back-btn { @apply text-slate-600 hover:text-slate-800 active:scale-95 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all duration-150 cursor-pointer; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-150 cursor-pointer; }
</style>
