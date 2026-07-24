<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Materiales y condiciones</h2>
    <p class="text-sm text-slate-500 mb-6">Define el entorno y las características constructivas</p>

    <!-- Temps -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label class="field-label">Temperatura exterior de diseño</label>
        <div class="relative">
          <input v-model.number="form.outdoorTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Ej: 32°C costa, 18°C Bogotá</p>
      </div>
      <div>
        <label class="field-label">Temperatura interior deseada</label>
        <div class="relative">
          <input v-model.number="form.indoorTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
      </div>
    </div>

    <p v-if="form.outdoorTemp <= form.indoorTemp" class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
      La temperatura exterior es igual o menor a la interior — la carga de enfriamiento será cero (no se requiere AC activo).
    </p>

    <!-- Wall insulation -->
    <div class="mb-6">
      <label class="field-label">Aislamiento de paredes</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in wallOpts" :key="opt.value" @click="form.wallInsulation = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.wallInsulation === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold text-sm">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <!-- Roof type -->
    <div class="mb-6">
      <label class="field-label">Tipo de techo</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in roofOpts" :key="opt.value" @click="form.roofType = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.roofType === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold text-sm">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <!-- Windows -->
    <div class="grid grid-cols-2 gap-6 mb-8">
      <div>
        <label class="field-label">Tipo de ventanas</label>
        <div class="flex flex-col gap-2">
          <button v-for="opt in windowOpts" :key="opt.value" @click="form.windowType = opt.value"
            class="chip text-left" :class="form.windowType === opt.value ? 'chip-active' : 'chip-inactive'">
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div>
        <label class="field-label">Exposición solar</label>
        <div class="flex flex-col gap-2">
          <button v-for="opt in exposureOpts" :key="opt.value" @click="form.solarExposure = opt.value"
            class="chip text-left" :class="form.solarExposure === opt.value ? 'chip-active' : 'chip-inactive'">
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AcInputs, WallInsulation, RoofType, WindowType, SolarExposure } from '../../utils/ac-calculator'

defineProps<{ form: AcInputs }>()
defineEmits<{ next: []; back: [] }>()

const wallOpts:     { value: WallInsulation;  label: string; sub: string }[] = [
  { value: 'none',  label: 'Sin aislamiento', sub: 'Ladrillo visto' },
  { value: 'basic', label: 'Básico',          sub: 'Bloque + repello' },
  { value: 'good',  label: 'Bueno',           sub: 'Con aislante' },
]
const roofOpts:     { value: RoofType;        label: string; sub: string }[] = [
  { value: 'exposed',      label: 'Losa expuesta', sub: 'Sol directo' },
  { value: 'false_ceiling', label: 'Cielo raso',   sub: 'Con cámara de aire' },
  { value: 'insulated',    label: 'Aislado',        sub: 'Con aislante térmico' },
]
const windowOpts:   { value: WindowType;      label: string }[] = [
  { value: 'single',     label: 'Vidrio simple' },
  { value: 'double',     label: 'Vidrio doble' },
  { value: 'solar_film', label: 'Con película solar' },
]
const exposureOpts: { value: SolarExposure;   label: string }[] = [
  { value: 'high',   label: 'Alta — sin sombra' },
  { value: 'medium', label: 'Media — parcialmente sombreado' },
  { value: 'low',    label: 'Baja — mayormente sombreado' },
  { value: 'shade',  label: 'Sombra total' },
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
