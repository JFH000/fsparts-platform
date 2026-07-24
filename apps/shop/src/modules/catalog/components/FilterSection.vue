<template>
  <div class="mb-5 pb-5 border-b border-slate-100">
    <button
      class="w-full flex items-center justify-between mb-3 group"
      @click="open = !open"
    >
      <span class="text-sm font-semibold text-slate-800 flex items-center gap-2">
        {{ title }}
        <span v-if="count > 0" class="bg-brand-100 text-brand-700 text-xs rounded-full px-1.5 py-0.5 font-bold">{{ count }}</span>
      </span>
      <ChevronDown :class="['h-4 w-4 text-slate-400 transition-transform', open ? 'rotate-180' : '']" />
    </button>
    <div v-show="open" class="space-y-0.5">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from '@lucide/vue'

defineProps<{ title: string; count: number }>()
const open = ref(true)
</script>
