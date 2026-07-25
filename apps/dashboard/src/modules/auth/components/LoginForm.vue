<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Snowflake class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Iniciar sesión</h2>
      <p class="text-slate-500 text-sm">Accede a tu cuenta para continuar</p>
    </div>

    <Transition name="fade">
      <div v-if="error" class="mb-5 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
        {{ error }}
      </div>
    </Transition>

    <form @submit.prevent="handleLogin" class="space-y-4">
      <div>
        <label class="field-label">Correo electrónico</label>
        <input v-model="email" type="email" required autocomplete="email"
          placeholder="tu@correo.com" class="field-input" />
      </div>
      <div>
        <label class="field-label">Contraseña</label>
        <div class="relative">
          <input v-model="password" :type="showPwd ? 'text' : 'password'"
            required autocomplete="current-password" placeholder="••••••••"
            class="field-input pr-11" />
          <button type="button" @click="showPwd = !showPwd"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <Eye v-if="!showPwd" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
      <button type="submit" :disabled="loading" class="submit-btn">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <span>{{ loading ? 'Ingresando...' : 'Ingresar' }}</span>
      </button>
    </form>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'

const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const error    = ref<string | null>(null)

async function handleLogin() {
  error.value   = null
  loading.value = true
  try {
    await authStore.signIn(email.value, password.value)
    if (authStore.user) await authStore.fetchProfile(authStore.user.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Email o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input  { @apply w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.submit-btn   { @apply w-full mt-2 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
