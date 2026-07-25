// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const authState = reactive({
  profile: { full_name: 'Juana Pérez', email: 'juana@test.co' } as { full_name: string | null; email: string } | null,
  user: { id: 'u1', email: 'juana@test.co' } as { id: string; email: string } | null,
  signOut: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@fsparts/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fsparts/core')>()
  return { ...actual, useAuthStore: () => authState }
})

import ProfileDropdown from './ProfileDropdown.vue'

describe('ProfileDropdown', () => {
  beforeEach(() => authState.signOut.mockClear())

  it('shows the user initials on the avatar button', () => {
    const wrapper = mount(ProfileDropdown)
    expect(wrapper.find('button').text()).toBe('JP')
  })

  it('opens the dropdown with the user name and no divider when there are no extra items', async () => {
    const wrapper = mount(ProfileDropdown)
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Juana Pérez')
    expect(wrapper.text()).toContain('Cerrar sesión')
    expect(wrapper.find('.divider').exists()).toBe(false)
  })

  it('renders extra-items slot content with a divider when provided', async () => {
    const wrapper = mount(ProfileDropdown, {
      slots: { 'extra-items': '<button class="probe">Mis pedidos</button>' },
    })
    await wrapper.find('button').trigger('click')

    expect(wrapper.find('.probe').exists()).toBe(true)
    expect(wrapper.find('.divider').exists()).toBe(true)
  })

  it('calls signOut when "Cerrar sesión" is clicked', async () => {
    const wrapper = mount(ProfileDropdown)
    await wrapper.find('button').trigger('click')
    const signOutBtn = wrapper.findAll('button').find(b => b.text() === 'Cerrar sesión')
    await signOutBtn!.trigger('click')

    expect(authState.signOut).toHaveBeenCalled()
  })
})
