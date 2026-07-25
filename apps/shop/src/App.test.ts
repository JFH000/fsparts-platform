// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useCartStore } from './modules/cart/stores/cart.store'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('Shop')
  })

  it('opens the cart drawer when the cart button is clicked', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })
    const cartStore = useCartStore()

    await wrapper.find('[aria-label="Carrito"]').trigger('click')

    expect(cartStore.isDrawerOpen).toBe(true)
  })
})
