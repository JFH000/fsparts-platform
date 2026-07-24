<template>
  <component
    :is="to ? 'RouterLink' : 'button'"
    :to="to"
    :type="!to ? type : undefined"
    :disabled="!to && (disabled || loading)"
    :class="classes"
    v-bind="$attrs"
  >
    <span v-if="loading" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot v-else-if="$slots.icon && iconPos === 'left'" name="icon" />
    <span v-if="$slots.default"><slot /></span>
    <slot v-else-if="$slots.icon && iconPos === 'right'" name="icon" />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  disabled?: boolean
  to?: string
  type?: 'button' | 'submit' | 'reset'
  iconPos?: 'left' | 'right'
  full?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
  iconPos: 'left',
  full: false,
})

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 no-underline'

const variants: Record<string, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
  outline:   'border border-brand-700 text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  ghost:     'text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  accent:    'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-sm',
}

const sizes: Record<string, string> = {
  xs: 'text-xs px-2.5 py-1.5',
  sm: 'text-sm px-3 py-2',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-5 py-3',
  xl: 'text-lg px-7 py-4',
}

const classes = computed(() => [
  base,
  variants[props.variant],
  sizes[props.size],
  props.full ? 'w-full' : '',
])
</script>
