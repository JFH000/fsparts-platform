<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader app-label="Calculator" current-app-id="calculator">
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
import { useAuthStore } from "@fsparts/core";
import { AppFooter, AppHeader, AppToast } from "@fsparts/ui";
import { onMounted } from "vue";

const authStore = useAuthStore();
onMounted(() => {
  authStore.init();
});
</script>
