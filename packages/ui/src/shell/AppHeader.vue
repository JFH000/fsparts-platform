<template>
  <header class="sticky top-0 z-40 bg-white border-b border-slate-200 h-14 md:h-16">
    <div class="mx-auto max-w-7xl h-full px-4 flex items-center gap-4">
      <div class="flex-shrink-0 flex items-center gap-3">
        <AppSwitcher :current-app-id="currentAppId" />
        <a href="/" class="flex items-center gap-2 no-underline">
          <img :src="logoUrl" alt="fsparts" class="h-8 w-8 md:h-9 md:w-9 object-contain flex-shrink-0" />
          <span class="font-semibold text-brand-700 text-sm md:text-base whitespace-nowrap">
            {{ appLabel }}
          </span>
        </a>
      </div>
      <div class="flex-1 min-w-0">
        <slot name="center" />
      </div>
      <div class="flex-shrink-0 flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppSwitcher from './AppSwitcher.vue'
import logoUrl from '../assets/logo.png'
import type { AppId } from './apps.config'

defineProps<{ appLabel: string; currentAppId: AppId }>()
</script>
