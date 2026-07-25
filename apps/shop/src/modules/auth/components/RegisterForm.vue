<template>
  <div class="p-8">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Snowflake class="h-6 w-6 text-brand-700" />
      </div>
      <h2 class="text-xl font-extrabold text-slate-900 mb-1">Crear cuenta</h2>
      <p class="text-slate-500 text-sm">Regístrate gratis y accede al catálogo completo</p>
    </div>

    <Transition name="fade">
      <div v-if="alert" class="mb-5 px-4 py-3 rounded-xl text-sm font-medium border"
        :class="alert.type === 'error'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'">
        {{ alert.msg }}
      </div>
    </Transition>

    <form @submit.prevent="handleRegister" class="space-y-4">
      <div>
        <label class="field-label">Correo electrónico</label>
        <input v-model="email" type="email" required autocomplete="email"
          placeholder="tu@correo.com" class="field-input" />
      </div>
      <div>
        <label class="field-label">Contraseña</label>
        <div class="relative">
          <input v-model="password" :type="showPwd ? 'text' : 'password'"
            required minlength="6" autocomplete="new-password"
            placeholder="Mínimo 6 caracteres" class="field-input pr-11" />
          <button type="button" @click="showPwd = !showPwd"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <Eye v-if="!showPwd" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div>
        <label class="field-label">Confirmar contraseña</label>
        <input v-model="confirm" :type="showPwd ? 'text' : 'password'"
          required autocomplete="new-password"
          placeholder="Repite la contraseña" class="field-input" />
        <p v-if="confirm && confirm !== password" class="text-xs text-red-500 mt-1">
          Las contraseñas no coinciden
        </p>
      </div>
      <button type="submit" :disabled="loading || (!!confirm && confirm !== password)" class="submit-btn">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
        <span>{{ loading ? 'Creando cuenta...' : 'Registrarse' }}</span>
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      ¿Ya tienes cuenta?
      <button type="button" @click="switchTo('login')"
        class="font-semibold text-brand-700 hover:text-brand-800">
        Inicia sesión
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Snowflake, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useAuthStore } from '@fsparts/core'
import { useAuthModal } from '@fsparts/ui'

const authStore          = useAuthStore()
const { switchTo } = useAuthModal()

const email    = ref('')
const password = ref('')
const confirm  = ref('')
const showPwd  = ref(false)
const loading  = ref(false)
const alert    = ref<{ type: 'error' | 'success'; msg: string } | null>(null)

async function handleRegister() {
  if (password.value !== confirm.value) return
  alert.value   = null
  loading.value = true
  try {
    await authStore.signUp(email.value, password.value)
    // Supabase puede requerir confirmación de email → usuario no queda autenticado
    await new Promise(r => setTimeout(r, 600))
    if (authStore.isAuthenticated) {
      switchTo('onboarding')
    } else {
      alert.value = {
        type: 'success',
        msg: '¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.',
      }
    }
  } catch (e: unknown) {
    alert.value = {
      type: 'error',
      msg: e instanceof Error ? e.message : 'Error al crear la cuenta',
    }
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
