<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Resultado — Aire Acondicionado</h2>
    <p class="text-sm text-slate-500 mb-6">Carga térmica total con factor de seguridad del 10%</p>

    <!-- Primary result -->
    <div class="bg-brand-700 rounded-2xl p-6 mb-6 text-white">
      <p class="text-sm font-medium opacity-80 mb-1">Carga térmica total</p>
      <p class="text-5xl font-extrabold mb-1">{{ fmt(result.btuH) }} <span class="text-2xl font-semibold opacity-80">BTU/h</span></p>
      <div class="flex gap-6 mt-3 text-sm opacity-80">
        <span><strong class="text-white font-bold">{{ result.kw.toFixed(2) }}</strong> kW</span>
        <span><strong class="text-white font-bold">{{ result.tons.toFixed(2) }}</strong> TR</span>
      </div>
    </div>

    <!-- Breakdown -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-slate-100">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Desglose de cargas</p>
      </div>
      <div class="divide-y divide-slate-50">
        <ResultRow v-for="row in rows" :key="row.label" :label="row.label" :watts="row.value" :total="result.qSubtotal" />
        <div class="flex items-center gap-3 px-5 py-3 bg-slate-50">
          <span class="text-sm text-slate-500 flex-1">Factor de seguridad (10%)</span>
          <span class="text-sm font-semibold text-slate-700">+ {{ fmt(result.qTotal - result.qSubtotal) }} W</span>
        </div>
      </div>
    </div>

    <!-- Coming soon -->
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
      <Lock class="h-6 w-6 text-slate-300 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-400">Sugerencia de equipos</p>
      <p class="text-xs text-slate-300 mt-1">Próximamente</p>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('reset')" class="reset-btn">Calcular de nuevo</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { Lock } from '@lucide/vue'
import type { AcResult } from '../../utils/ac-calculator'

const props = defineProps<{ result: AcResult }>()
defineEmits<{ back: []; reset: [] }>()

const fmt = (n: number) => Math.round(n).toLocaleString('es-CO')

const rows = computed(() => [
  { label: 'Paredes',      value: props.result.qWalls },
  { label: 'Techo',        value: props.result.qRoof },
  { label: 'Ventanas',     value: props.result.qWindows },
  { label: 'Ganancia solar', value: props.result.qSolar },
  { label: 'Infiltración', value: props.result.qInfiltration },
  { label: 'Personas',     value: props.result.qOccupants },
  { label: 'Iluminación',  value: props.result.qLighting },
  { label: 'Equipos',      value: props.result.qEquipment },
].filter(r => r.value > 0))

const ResultRow = defineComponent({
  props: { label: String, watts: Number, total: Number },
  setup(p) {
    return () => {
      const pct = p.total! > 0 ? (p.watts! / p.total!) * 100 : 0
      return h('div', { class: 'flex items-center gap-3 px-5 py-3' }, [
        h('span', { class: 'text-sm text-slate-600 w-32 flex-shrink-0' }, p.label),
        h('div', { class: 'flex-1 h-2 bg-slate-100 rounded-full overflow-hidden' },
          h('div', { class: 'h-full bg-brand-400 rounded-full', style: `width:${pct.toFixed(1)}%` })),
        h('span', { class: 'text-sm font-semibold text-slate-700 w-24 text-right' }, `${Math.round(p.watts!).toLocaleString('es-CO')} W`),
        h('span', { class: 'text-xs text-slate-400 w-10 text-right' }, `${pct.toFixed(0)}%`),
      ])
    }
  },
})
</script>

<style scoped>
@reference "../../../../style.css";
.back-btn  { @apply text-slate-600 hover:text-slate-800 active:scale-95 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all duration-150 cursor-pointer; }
.reset-btn { @apply bg-slate-900 hover:bg-slate-700 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-150 cursor-pointer; }
</style>
