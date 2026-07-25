<template>
  <div class="p-8">
    <div class="text-center mb-6">
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Mi perfil</h2>
      <p class="text-slate-500 text-sm">Edita tu información personal</p>
    </div>

    <Transition name="fade">
      <div v-if="saved" class="mb-5 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">
        Perfil actualizado correctamente
      </div>
    </Transition>

    <form @submit.prevent="handleSave" class="space-y-4">
      <div>
        <label class="field-label">Correo electrónico</label>
        <div class="field-readonly">{{ authStore.user?.email }}</div>
      </div>
      <div>
        <label class="field-label">Nombre completo</label>
        <input v-model="form.full_name" type="text" class="field-input" placeholder="Tu nombre" />
      </div>
      <div>
        <label class="field-label">Teléfono</label>
        <input v-model="form.phone" type="tel" class="field-input" placeholder="+57 300 000 0000" />
      </div>
      <div>
        <label class="field-label">Empresa</label>
        <input v-model="form.company" type="text" class="field-input" placeholder="Nombre de empresa" />
      </div>
      <button type="submit" :disabled="saving" class="submit-btn">
        <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
        <span>{{ saving ? 'Guardando...' : 'Guardar cambios' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '@fsparts/ui'

const authStore = useAuthStore()
const { close } = useAuthModal()

const form   = reactive({ full_name: '', phone: '', company: '' })
const saving = ref(false)
const saved  = ref(false)

onMounted(() => {
  form.full_name = authStore.profile?.full_name ?? ''
  form.phone     = authStore.profile?.phone     ?? ''
  form.company   = authStore.profile?.company   ?? ''
})

async function handleSave() {
  saving.value = true
  try {
    await authStore.updateProfile({
      full_name: form.full_name || undefined,
      phone:     form.phone     || undefined,
      company:   form.company   || undefined,
    })
    saved.value = true
    setTimeout(() => { saved.value = false; close() }, 1500)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label   { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input   { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.field-readonly{ @apply text-sm text-slate-900 py-2.5 px-0; }
.submit-btn    { @apply w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
