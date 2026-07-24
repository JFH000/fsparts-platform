<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
    <h1 class="text-3xl font-bold text-slate-900 mb-2 text-center">Calculadora de Carga Térmica</h1>
    <p class="text-slate-500 mb-10 text-center">Selecciona el tipo de cálculo</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
      <button
        @click="$emit('select', 'ac')"
        class="group flex flex-col items-center gap-4 bg-white border-2 border-slate-200 hover:border-brand-500 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:shadow-md rounded-2xl p-8 transition-all duration-150 text-left cursor-pointer"
      >
        <div class="w-16 h-16 bg-brand-50 group-hover:bg-brand-100 rounded-2xl flex items-center justify-center transition-colors">
          <AirVent class="h-8 w-8 text-brand-700" />
        </div>
        <div>
          <p class="text-lg font-bold text-slate-900">Aire Acondicionado</p>
          <p class="text-sm text-slate-500 mt-1">Calcula la carga para habitaciones, oficinas y espacios a climatizar</p>
        </div>
      </button>

      <button
        @click="$emit('select', 'cold')"
        class="group flex flex-col items-center gap-4 bg-white border-2 border-slate-200 hover:border-blue-400 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:shadow-md rounded-2xl p-8 transition-all duration-150 text-left cursor-pointer"
      >
        <div class="w-16 h-16 bg-blue-50 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center transition-colors">
          <Snowflake class="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <p class="text-lg font-bold text-slate-900">Cuarto Frío</p>
          <p class="text-sm text-slate-500 mt-1">Calcula la carga para cámaras de conservación y congelación industrial</p>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AirVent, Snowflake } from '@lucide/vue'
defineEmits<{ select: ['ac' | 'cold'] }>()
</script>
