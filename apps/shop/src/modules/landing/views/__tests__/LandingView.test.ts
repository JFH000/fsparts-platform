// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'

vi.mock('../../composables/useLandingMotion', () => ({ useLandingMotion: vi.fn() }))

async function mountView() {
  const { default: LandingView } = await import('../LandingView.vue')
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'landing', component: LandingView },
      { path: '/catalog', name: 'catalog', component: { template: '<div />' } },
    ],
  })
  router.push('/')
  await router.isReady()

  return mount(LandingView, {
    global: { plugins: [router], stubs: { HeroBlueprint: true } },
  })
}

describe('LandingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the hero heading and every product line from the catalog store', async () => {
    const wrapper = await mountView()
    const catalogStore = useCatalogStore()

    expect(wrapper.text()).toContain('Tu distribuidor')
    for (const line of catalogStore.productLines) {
      expect(wrapper.text()).toContain(line.name)
    }
  })

  it('navigates to /catalog with the typed search query on submit', async () => {
    const wrapper = await mountView()
    const pushSpy = vi.spyOn(wrapper.vm.$router, 'push')

    await wrapper.find('input[aria-label="Buscar productos"]').setValue('compresor')
    await wrapper.find('form').trigger('submit.prevent')

    expect(pushSpy).toHaveBeenCalledWith({ path: '/catalog', query: { q: 'compresor' } })
  })

  it('does not navigate when the search query is empty', async () => {
    const wrapper = await mountView()
    const pushSpy = vi.spyOn(wrapper.vm.$router, 'push')

    await wrapper.find('form').trigger('submit.prevent')

    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('links the calculator CTA to the configured calculator URL', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('a[href*="calculator"]').exists()).toBe(true)
  })

  it('renders all four trust-bar benefits', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Envío rápido')
    expect(wrapper.text()).toContain('Garantía total')
    expect(wrapper.text()).toContain('Soporte técnico')
    expect(wrapper.text()).toContain('Distribuidor oficial')
  })
})
