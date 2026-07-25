<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <UserCircle class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Cuéntanos sobre ti</h2>
      <p class="text-slate-500 text-sm">Solo tomará un momento</p>
    </div>

    <Transition name="fade">
      <div v-if="error" class="mb-5 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
        {{ error }}
      </div>
    </Transition>

    <form @submit.prevent="handleContinue" class="space-y-4">
      <div>
        <label class="field-label">Nombre completo <span class="text-red-400">*</span></label>
        <input v-model="form.full_name" type="text" required
          placeholder="Juan Pérez" class="field-input" />
      </div>
      <div>
        <label class="field-label">Teléfono <span class="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></label>
        <input v-model="form.phone" type="tel"
          placeholder="+57 300 000 0000" class="field-input" />
      </div>
      <div>
        <label class="field-label">Empresa <span class="text-slate-300 font-normal normal-case tracking-normal">(opcional)</span></label>
        <input v-model="form.company" type="text"
          placeholder="Mi empresa S.A.S." class="field-input" />
      </div>

      <div class="flex flex-col gap-3 pt-2">
        <button type="submit" :disabled="loading" class="submit-btn">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <span>{{ loading ? 'Guardando...' : 'Continuar →' }}</span>
        </button>
        <button type="button" @click="close"
          class="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
          Omitir por ahora
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { UserCircle, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '@fsparts/ui'

const authStore = useAuthStore()
const { close } = useAuthModal()

const form    = reactive({ full_name: '', phone: '', company: '' })
const loading = ref(false)
const error   = ref<string | null>(null)

async function handleContinue() {
  error.value   = null
  loading.value = true
  try {
    await authStore.updateProfile({
      full_name: form.full_name,
      phone:     form.phone   || undefined,
      company:   form.company || undefined,
    })
    close()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al guardar el perfil'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input  { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.submit-btn   { @apply w-full flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
