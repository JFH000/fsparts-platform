<template>
  <div ref="containerRef" class="relative">
    <!-- Avatar -->
    <button
      type="button"
      @click="toggle"
      class="flex items-center justify-center w-8 h-8 bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold rounded-full transition-all"
      :class="isOpen ? 'ring-2 ring-brand-400 ring-offset-1' : ''"
      :title="authStore.profile?.full_name || authStore.user?.email || 'Mi perfil'"
    >
      {{ userInitials }}
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden">
        <!-- Cabecera usuario -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div class="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0">
            {{ userInitials }}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 truncate">
              {{ authStore.profile?.full_name || 'Usuario' }}
            </p>
            <p class="text-xs text-slate-400 truncate">{{ authStore.user?.email }}</p>
          </div>
        </div>

        <!-- Acciones -->
        <div class="p-1.5">
          <slot name="extra-items" :close="closeMenu" />
          <div v-if="$slots['extra-items']" class="divider h-px bg-slate-100 my-1" />
          <button
            type="button"
            class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            @click="onSignOut"
          >
            <LogOut class="h-3.5 w-3.5 flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { LogOut } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()

const isOpen       = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const userInitials = computed(() => {
  const name = authStore.profile?.full_name ?? authStore.user?.email ?? '?'
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})

function toggle() { isOpen.value = !isOpen.value }
function closeMenu() { isOpen.value = false }

function handleOutsideClick(e: MouseEvent) {
  if (!containerRef.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

async function onSignOut() {
  closeMenu()
  await authStore.signOut()
}
</script>

<style scoped>
.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }
</style>
