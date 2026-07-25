// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from './AppFooter.vue'

describe('AppFooter', () => {
  it('renders the default company name, description, and current-year copyright', () => {
    const wrapper = mount(AppFooter)
    const year = new Date().getFullYear()

    expect(wrapper.text()).toContain('FSP Parts')
    expect(wrapper.text()).toContain('Distribuidor especializado de repuestos HVAC/R — Colombia')
    expect(wrapper.text()).toContain(`© ${year} FSP Parts`)
  })

  it('renders the default quick links and legal links as placeholder anchors', () => {
    const wrapper = mount(AppFooter)

    for (const label of ['Inicio', 'Servicios', 'Nosotros', 'Blog', 'Contacto']) {
      const link = wrapper.findAll('a').find(a => a.text() === label)
      expect(link, `expected a link labeled "${label}"`).toBeTruthy()
      expect(link!.attributes('href')).toBe('#')
    }

    for (const label of ['Política de privacidad', 'Términos y condiciones', 'Cookies']) {
      const link = wrapper.findAll('a').find(a => a.text() === label)
      expect(link, `expected a link labeled "${label}"`).toBeTruthy()
      expect(link!.attributes('href')).toBe('#')
    }
  })

  it('renders default contact info and omits the address when not provided', () => {
    const wrapper = mount(AppFooter)

    expect(wrapper.find('a[href="mailto:contacto@fsparts.org"]').exists()).toBe(true)
    expect(wrapper.find('a[href="tel:+573000000000"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="footer-address"]').exists()).toBe(false)
  })

  it('renders the address when provided', () => {
    const wrapper = mount(AppFooter, {
      props: { address: 'Cra 10 #20-30, Bogotá' },
    })

    expect(wrapper.find('[data-testid="footer-address"]').text()).toContain('Cra 10 #20-30, Bogotá')
  })

  it('renders the default social icons with accessible labels', () => {
    const wrapper = mount(AppFooter)

    for (const label of ['Facebook', 'Instagram', 'LinkedIn', 'X', 'GitHub']) {
      expect(wrapper.find(`a[aria-label="${label}"]`).exists(), `expected a social link labeled "${label}"`).toBe(true)
    }
  })

  it('overrides defaults when props are passed', () => {
    const wrapper = mount(AppFooter, {
      props: {
        companyName: 'Acme Corp',
        email: 'hola@acme.test',
        quickLinks: [{ label: 'Solo Uno', href: '/solo-uno' }],
      },
    })

    expect(wrapper.text()).toContain('Acme Corp')
    expect(wrapper.find('a[href="mailto:hola@acme.test"]').exists()).toBe(true)
    expect(wrapper.findAll('a').find(a => a.text() === 'Solo Uno')?.attributes('href')).toBe('/solo-uno')
    expect(wrapper.findAll('a').some(a => a.text() === 'Inicio')).toBe(false)
  })

  it('emits subscribe with the typed email when the newsletter form is submitted', async () => {
    const wrapper = mount(AppFooter)

    await wrapper.find('input[type="email"]').setValue('lead@example.com')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('subscribe')).toEqual([['lead@example.com']])
  })

  describe('back-to-top button', () => {
    beforeEach(() => {
      window.scrollTo = vi.fn()
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('smooth-scrolls to the top when clicked', async () => {
      const wrapper = mount(AppFooter)

      await wrapper.find('[aria-label="Volver arriba"]').trigger('click')

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    })
  })
})
