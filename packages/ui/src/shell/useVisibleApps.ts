import { computed } from 'vue'
import { useAuthStore } from '@fsparts/core'
import { APPS } from './apps.config'

export function useVisibleApps() {
  const auth = useAuthStore()
  const visibleApps = computed(() => APPS.filter((app) => !app.requiresAdmin || auth.isAdmin))
  return { visibleApps }
}
