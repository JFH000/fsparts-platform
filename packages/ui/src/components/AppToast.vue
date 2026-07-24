<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl max-w-sm"
        >
          <CheckCircle class="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <span class="flex-1 text-slate-100">{{ toast.message }}</span>
          <RouterLink
            v-if="toast.href"
            :to="toast.href"
            class="font-semibold text-brand-400 hover:text-brand-300 whitespace-nowrap transition-colors"
          >{{ toast.linkLabel ?? 'Ver' }} →</RouterLink>
          <button
            @click="dismiss(toast.id)"
            class="text-slate-500 hover:text-white transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckCircle, X } from '@lucide/vue'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.2s ease-out;
}
.toast-leave-active {
  transition: all 0.18s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.15s;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
