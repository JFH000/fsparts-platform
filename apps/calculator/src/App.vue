<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Calculadora" current-app-id="calculator">
      <template #actions>
        <span class="text-sm font-medium text-slate-600">Cuenta</span>
      </template>
    </AppHeader>
    <main class="flex-1">
      <RouterView />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { AppHeader, AppFooter, AppToast } from '@fsparts/ui'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()
onMounted(() => { authStore.init() })
</script>
