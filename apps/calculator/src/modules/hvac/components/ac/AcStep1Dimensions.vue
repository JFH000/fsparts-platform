<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Dimensiones del espacio</h2>
    <p class="text-sm text-slate-500 mb-6">Ingresa las medidas del área a climatizar</p>

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
          <input v-model.number="form.height" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="2.7" />
          <span class="unit">m</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-8">
      <div>
        <label class="field-label">Área total de ventanas</label>
        <div class="relative">
          <input v-model.number="form.windowArea" type="number" min="0" step="0.1" class="field-input pr-12" placeholder="0" />
          <span class="unit">m²</span>
        </div>
      </div>
      <div>
        <label class="field-label">Orientación principal</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in orientations" :key="opt.value"
            @click="form.orientation = opt.value"
            class="chip"
            :class="form.orientation === opt.value ? 'chip-active' : 'chip-inactive'"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</div>

    <div class="flex justify-end">
      <button @click="handleNext" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AcInputs, Orientation } from '../../utils/ac-calculator'

const props = defineProps<{ form: AcInputs }>()
const emit  = defineEmits<{ next: [] }>()
const error = ref('')

const orientations: { value: Orientation; label: string }[] = [
  { value: 'norte', label: 'Norte' },
  { value: 'sur',   label: 'Sur'   },
  { value: 'este',  label: 'Este'  },
  { value: 'oeste', label: 'Oeste' },
]

function handleNext() {
  if (!props.form.length || !props.form.width || !props.form.height) {
    error.value = 'Ingresa largo, ancho y alto del espacio.'
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
.next-btn { @apply bg-brand-700 hover:bg-brand-800 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-150 cursor-pointer; }
</style>
