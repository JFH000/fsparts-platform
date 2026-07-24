<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="mode"
        class="modal-overlay"
        @click.self="close"
      >
        <div class="modal-card">
          <button class="modal-close-btn" @click="close" aria-label="Cerrar">
            <X class="h-4 w-4" />
          </button>
          <LoginForm      v-if="mode === 'login'" />
          <RegisterForm   v-else-if="mode === 'register'" />
          <OnboardingForm v-else-if="mode === 'onboarding'" />
          <EditProfileForm v-else-if="mode === 'editProfile'" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { X } from '@lucide/vue'
import { useAuthModal } from '../composables/useAuthModal'
import LoginForm      from './LoginForm.vue'
import RegisterForm   from './RegisterForm.vue'
import OnboardingForm from './OnboardingForm.vue'
import EditProfileForm from './EditProfileForm.vue'

const { mode, close } = useAuthModal()

watch(mode, (val) => {
  if (val) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
  } else {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}, { immediate: true })
</script>

<style scoped>
@reference "../../../style.css";

.modal-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center p-4;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
}

.modal-card {
  @apply relative bg-white rounded-2xl shadow-2xl w-full max-w-sm;
  animation: modal-card-in 0.2s ease;
}

.modal-close-btn {
  @apply absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors;
}

@keyframes modal-card-in {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}

.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
