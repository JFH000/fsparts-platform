<template>
  <span :class="classes"><slot /></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'blue' | 'green' | 'orange' | 'red' | 'slate' | 'purple' | 'teal'
  size?: 'xs' | 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'blue',
  size: 'sm',
})

const variants: Record<string, string> = {
  blue:   'bg-brand-100 text-brand-800',
  green:  'bg-emerald-100 text-emerald-800',
  orange: 'bg-orange-100 text-orange-800',
  red:    'bg-red-100 text-red-700',
  slate:  'bg-slate-100 text-slate-700',
  purple: 'bg-purple-100 text-purple-800',
  teal:   'bg-teal-100 text-teal-800',
}

const sizes: Record<string, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
}

const classes = computed(() => [
  'inline-flex items-center font-medium rounded-full whitespace-nowrap',
  variants[props.variant],
  sizes[props.size],
])
</script>
