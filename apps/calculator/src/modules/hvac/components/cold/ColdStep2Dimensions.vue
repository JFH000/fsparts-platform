<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Dimensiones y aislamiento</h2>
    <p class="text-sm text-slate-500 mb-6">Medidas interiores del cuarto frío y tipo de panel</p>

    <!-- Dimensions -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div>
        <label class="field-label">Largo</label>
        <div class="relative">
          <input v-model.number="form.length" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Ancho</label>
        <div class="relative">
          <input v-model.number="form.width" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Alto</label>
        <div class="relative">
          <input v-model.number="form.height" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="2.5" />
          <span class="unit">m</span>
        </div>
      </div>
    </div>

    <!-- Insulation thickness -->
    <div class="mb-6">
      <label class="field-label">Espesor del aislamiento</label>
      <div class="flex gap-2 flex-wrap">
        <button v-for="t in thicknesses" :key="t" @click="form.insulationThickness = t"
          class="chip" :class="form.insulationThickness === t ? 'chip-active' : 'chip-inactive'">
          {{ t }} mm
        </button>
      </div>
    </div>

    <!-- Insulation material -->
    <div class="mb-6">
      <label class="field-label">Material de aislamiento</label>
      <div class="grid grid-cols-2 gap-2">
        <button @click="form.insulationMaterial = 'polyurethane'"
          class="chip flex-col gap-0.5 py-3" :class="form.insulationMaterial === 'polyurethane' ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">Poliuretano</span>
          <span class="text-xs opacity-70">Recomendado</span>
        </button>
        <button @click="form.insulationMaterial = 'eps'"
          class="chip flex-col gap-0.5 py-3" :class="form.insulationMaterial === 'eps' ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">EPS</span>
          <span class="text-xs opacity-70">Poliestireno expandido</span>
        </button>
      </div>
    </div>

    <!-- Outdoor temp -->
    <div class="mb-8">
      <label class="field-label">Temperatura exterior de diseño</label>
      <div class="relative w-48">
        <input v-model.number="form.outdoorTemp" type="number" class="field-input pr-10" />
        <span class="unit">°C</span>
      </div>
      <p class="text-xs text-slate-400 mt-1">Temperatura del ambiente donde está instalado el cuarto</p>
    </div>

    <div v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="handleNext" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ColdInputs, InsulationThickness } from '../../utils/cold-calculator'

const props = defineProps<{ form: ColdInputs }>()
const emit  = defineEmits<{ next: []; back: [] }>()
const error = ref('')
const thicknesses: InsulationThickness[] = [50, 75, 100, 150, 200]

function handleNext() {
  if (!props.form.length || !props.form.width || !props.form.height) {
    error.value = 'Ingresa largo, ancho y alto del cuarto.'
    return
  }
  error.value = ''
  emit('next')
}
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
