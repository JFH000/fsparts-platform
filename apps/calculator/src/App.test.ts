// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { ProfileDropdown } from '@fsparts/ui'

const authState = reactive({
  isAuthenticated: false,
  user: null as { id: string } | null,
  profile: null,
  init: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import router from './router'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => { authState.isAuthenticated = false })

  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).toContain('Aire Acondicionado')
  })

  it('shows a login button in the header when unauthenticated', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).toContain('Iniciar sesión')
  })

  it('shows the profile dropdown instead of the login button when authenticated', async () => {
    authState.isAuthenticated = true
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.text()).not.toContain('Iniciar sesión')
    expect(wrapper.findComponent(ProfileDropdown).find('button').text()).toBe('?')
  })
})
