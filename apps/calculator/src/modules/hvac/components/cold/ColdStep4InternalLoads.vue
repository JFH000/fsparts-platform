<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Cargas internas</h2>
    <p class="text-sm text-slate-500 mb-6">Personas que acceden al cuarto y uso de la puerta</p>

    <!-- Persons -->
    <div class="mb-6">
      <label class="field-label">Personas que acceden habitualmente</label>
      <div class="flex items-center gap-3">
        <button @click="form.persons = Math.max(0, form.persons - 1)"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">−</button>
        <span class="text-2xl font-bold text-slate-900 min-w-[3rem] text-center">{{ form.persons }}</span>
        <button @click="form.persons++"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">+</button>
        <span class="text-sm text-slate-400 ml-2">× 270 W por persona</span>
      </div>
    </div>

    <!-- Door frequency -->
    <div class="mb-8">
      <label class="field-label">Frecuencia de apertura de puerta</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in doorOpts" :key="opt.value" @click="form.doorFrequency = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.doorFrequency === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Ver resultado →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColdInputs, DoorFrequency } from '../../utils/cold-calculator'

defineProps<{ form: ColdInputs }>()
defineEmits<{ next: []; back: [] }>()

const doorOpts: { value: DoorFrequency; label: string; sub: string }[] = [
  { value: 'low',    label: 'Baja',   sub: '~2 aperturas/día'  },
  { value: 'medium', label: 'Media',  sub: '~6 aperturas/día'  },
  { value: 'high',   label: 'Alta',   sub: '~12 aperturas/día' },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150 cursor-pointer select-none active:scale-95; }
.chip-active   { @apply border-brand-600 bg-brand-100 text-brand-800 shadow-sm ring-1 ring-brand-400 ring-offset-1; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900; }
.back-btn { @apply text-slate-600 hover:text-slate-800 active:scale-95 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all duration-150 cursor-pointer; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-150 cursor-pointer; }
</style>
