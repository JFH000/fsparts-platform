<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Tipo de aplicación</h2>
    <p class="text-sm text-slate-500 mb-6">Selecciona el uso del cuarto frío</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <button
        @click="selectType('conservation')"
        class="group flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all duration-150 cursor-pointer active:scale-[0.97]"
        :class="form.type === 'conservation'
          ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-400 ring-offset-1'
          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md'"
      >
        <Thermometer class="h-6 w-6" :class="form.type === 'conservation' ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600'" />
        <div>
          <p class="font-bold text-slate-900">Conservación</p>
          <p class="text-sm text-slate-500 mt-0.5">Frutas, verduras, carnes, lácteos — 0°C a 8°C</p>
        </div>
      </button>

      <button
        @click="selectType('freezing')"
        class="group flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all duration-150 cursor-pointer active:scale-[0.97]"
        :class="form.type === 'freezing'
          ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-400 ring-offset-1'
          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md'"
      >
        <Snowflake class="h-6 w-6" :class="form.type === 'freezing' ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600'" />
        <div>
          <p class="font-bold text-slate-900">Congelación</p>
          <p class="text-sm text-slate-500 mt-0.5">Congelados, helados — −18°C a −25°C</p>
        </div>
      </button>
    </div>

    <!-- Indoor temp -->
    <div class="mb-8">
      <label class="field-label">Temperatura interior de diseño</label>
      <div class="relative w-48">
        <input v-model.number="form.indoorTemp" type="number" class="field-input pr-10" />
        <span class="unit">°C</span>
      </div>
      <p class="text-xs text-slate-400 mt-1">Rango típico: {{ form.type === 'conservation' ? '0°C a 8°C' : '−18°C a −25°C' }}</p>
    </div>

    <div class="flex justify-end">
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Thermometer, Snowflake } from '@lucide/vue'
import type { ColdInputs, ColdType } from '../../utils/cold-calculator'

const props = defineProps<{ form: ColdInputs }>()
defineEmits<{ next: [] }>()

function selectType(type: ColdType) {
  props.form.type = type
  props.form.indoorTemp = type === 'conservation' ? 4 : -18
}
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-150 cursor-pointer; }
</style>
