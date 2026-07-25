// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import AdminProductsView from './modules/admin/views/AdminProductsView.vue'

describe('App', () => {
  it('mounts with the shared header and footer without throwing', async () => {
    const pinia = createPinia()
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', redirect: '/products' },
        { path: '/products', component: AdminProductsView },
      ],
    })
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: { plugins: [pinia, router] },
    })

    expect(wrapper.text()).toContain('fsparts Dashboard')
  })
})
