// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { AppToast } from '@fsparts/ui'
import router from './router'

const authState = reactive({
  isReady: false,
  isAuthenticated: false,
  isAdmin: false,
  user: null as { id: string } | null,
  profile: null,
  signOut: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import App from './App.vue'

describe('App gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    authState.isReady = false
    authState.isAuthenticated = false
    authState.isAdmin = false
    authState.user = null
  })

  it('shows a spinner while the auth store is not ready', async () => {
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('shows the login form when unauthenticated', async () => {
    authState.isReady = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Iniciar sesión')
  })

  it('shows a restricted-access message for an authenticated non-admin', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('Acceso restringido')
  })

  it('shows AdminLayout for an admin', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    authState.isAdmin = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('fsparts Dashboard')
  })

  it('renders AppToast in the admin state so admin views\' toasts are visible', async () => {
    authState.isReady = true
    authState.isAuthenticated = true
    authState.isAdmin = true
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.findComponent(AppToast).exists()).toBe(true)
  })
})
