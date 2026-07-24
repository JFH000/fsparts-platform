<template>
  <div class="flex items-center gap-2 mb-8 flex-wrap">
    <template v-for="(label, i) in steps" :key="i">
      <button
        class="flex items-center gap-2 min-w-0"
        :disabled="i >= current"
        @click="i < current && $emit('go', i)"
      >
        <span
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
          :class="i === current
            ? 'bg-brand-700 text-white'
            : i < current
              ? 'bg-brand-100 text-brand-700 cursor-pointer'
              : 'bg-slate-100 text-slate-400'"
        >{{ i + 1 }}</span>
        <span
          class="text-sm whitespace-nowrap transition-colors"
          :class="i === current ? 'text-slate-800 font-semibold' : i < current ? 'text-brand-600' : 'text-slate-400'"
        >{{ label }}</span>
      </button>
      <div
        v-if="i < steps.length - 1"
        class="flex-1 h-px min-w-4 transition-colors"
        :class="i < current ? 'bg-brand-200' : 'bg-slate-100'"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ steps: string[]; current: number }>()
defineEmits<{ go: [number] }>()
</script>
