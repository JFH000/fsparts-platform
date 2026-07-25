// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const authState = reactive({
  user: null as { id: string } | null,
  signIn: vi.fn().mockResolvedValue(undefined),
  fetchProfile: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import LoginForm from './LoginForm.vue'
import { useAuthModal } from './useAuthModal'

describe('LoginForm', () => {
  beforeEach(() => {
    authState.user = null
    authState.signIn.mockClear()
    authState.fetchProfile.mockClear()
    useAuthModal().open('login')
  })

  it('signs in with the entered email and password', async () => {
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(authState.signIn).toHaveBeenCalledWith('user@test.co', 'secret123')
  })

  it('closes the auth modal after a successful login', async () => {
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(useAuthModal().mode.value).toBeNull()
  })

  it('shows an error message when sign-in fails', async () => {
    authState.signIn.mockRejectedValueOnce(new Error('Credenciales inválidas'))
    const wrapper = mount(LoginForm)

    await wrapper.find('input[type="email"]').setValue('user@test.co')
    await wrapper.find('input[type="password"]').setValue('wrong')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Credenciales inválidas')
  })
})
