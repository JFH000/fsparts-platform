import { ref } from 'vue'

export type AuthModalMode = 'login' | 'register' | 'onboarding' | 'editProfile'

const mode = ref<AuthModalMode | null>(null)

export function useAuthModal() {
  function open(m: AuthModalMode) { mode.value = m }
  function close() { mode.value = null }
  function switchTo(m: AuthModalMode) { mode.value = m }
  return { mode, open, close, switchTo }
}
