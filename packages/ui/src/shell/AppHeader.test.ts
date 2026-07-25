// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppHeader from './AppHeader.vue'

describe('AppHeader', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the fsparts logo', () => {
    const wrapper = mount(AppHeader, {
      props: { appLabel: 'Shop', currentAppId: 'shop' },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBeTruthy()
    expect(img.attributes('src')).toBeTruthy()
  })

  it('still shows the brand text alongside the logo', () => {
    const wrapper = mount(AppHeader, {
      props: { appLabel: 'Shop', currentAppId: 'shop' },
    })

    expect(wrapper.text()).toContain('fsparts Shop')
  })
})
