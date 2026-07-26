<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-label="Apps de fsparts"
      @click="isOpen = !isOpen"
    >
      <LayoutGrid class="h-5 w-5" />
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg py-2 z-50"
    >
      <a
        v-for="app in visibleApps"
        :key="app.id"
        :href="app.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex flex-col gap-0.5 px-4 py-2.5 no-underline hover:bg-slate-50"
        :class="app.id === currentAppId ? 'bg-brand-50' : ''"
      >
        <span class="text-sm font-semibold text-slate-900">{{ app.name }}</span>
        <span class="text-xs text-slate-500">{{ app.description }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { LayoutGrid } from '@lucide/vue'
import { useVisibleApps } from './useVisibleApps'
import type { AppId } from './apps.config'

defineProps<{ currentAppId: AppId }>()

const isOpen = ref(false)
const { visibleApps } = useVisibleApps()

const root = useTemplateRef<HTMLElement>('root')
onClickOutside(root, () => { isOpen.value = false })
</script>
