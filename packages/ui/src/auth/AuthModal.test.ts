// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AuthModal from './AuthModal.vue'
import { useAuthModal } from './useAuthModal'

describe('AuthModal', () => {
  beforeEach(() => useAuthModal().close())

  it('renders nothing when mode is null', () => {
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: (props: { mode: string | null }) => h('div', { class: 'probe' }, props.mode ?? '') },
    })
    expect(wrapper.find('.probe').exists()).toBe(false)
  })

  it('renders the default slot with the current mode when open', () => {
    useAuthModal().open('login')
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: (props: { mode: string | null }) => h('div', { class: 'probe' }, props.mode ?? '') },
    })
    expect(wrapper.find('.probe').text()).toBe('login')
  })

  it('closes when the backdrop is clicked', async () => {
    useAuthModal().open('login')
    const wrapper = mount(AuthModal, {
      global: { stubs: { teleport: true } },
      slots: { default: () => h('div', 'content') },
    })
    await wrapper.find('[data-testid="auth-modal-overlay"]').trigger('click')
    expect(useAuthModal().mode.value).toBeNull()
  })
})
