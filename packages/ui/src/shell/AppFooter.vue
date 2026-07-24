<template>
  <footer class="border-t border-slate-200 bg-white">
    <div class="mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-slate-500">
      <span>&copy; {{ year }} FSP Parts. Todos los derechos reservados.</span>
      <span>Distribuidor especializado de repuestos HVAC/R — Colombia</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const year = computed(() => new Date().getFullYear())
</script>
