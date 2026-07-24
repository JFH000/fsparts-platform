<template>
  <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full', classes]">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderStatus } from '@fsparts/core'

const props = defineProps<{ status: OrderStatus }>()

const LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pendiente de pago',
  paid:            'Pagado',
  preparing:       'Preparando',
  shipped:         'Enviado',
  delivered:       'Entregado',
  cancelled:       'Cancelado',
}

const CLASSES: Record<OrderStatus, string> = {
  pending_payment: 'bg-slate-100 text-slate-500',
  paid:            'bg-blue-50 text-blue-700',
  preparing:       'bg-amber-50 text-amber-700',
  shipped:         'bg-teal-50 text-teal-700',
  delivered:       'bg-emerald-50 text-emerald-700',
  cancelled:       'bg-red-50 text-red-600',
}

const label   = computed(() => LABELS[props.status])
const classes = computed(() => CLASSES[props.status])
</script>
