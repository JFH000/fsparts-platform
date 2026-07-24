// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { Product, ProductSpec } from '@fsparts/core'

const fetchProductsMock = vi.fn()

vi.mock('@fsparts/core', () => ({
  fetchProducts: (...args: unknown[]) => fetchProductsMock(...args),
}))

import { useEquipmentSuggestions } from './useEquipmentSuggestions'

function makeProduct(opts: { id: string; specs?: ProductSpec[]; lineCode?: string }): Product {
  return {
    id: opts.id,
    sku: opts.id,
    name: opts.id,
    slug: opts.id,
    description: '',
    brand: { id: 1, name: 'Brand', slug: 'brand' },
    category: { id: 1, name: 'Cat', slug: 'cat', productLineId: 2 },
    productLine: {
      id: 2,
      code: opts.lineCode ?? 'L06',
      name: 'Compresores',
      description: '',
      icon: 'Settings2',
      slug: 'compresores',
    },
    stock: 10,
    isFeatured: false,
    images: [],
    specs: opts.specs ?? [],
    refrigerants: [],
  }
}

describe('useEquipmentSuggestions', () => {
  it('filters to the Compresores product line (L06)', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'compressor', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
      makeProduct({ id: 'valve', lineCode: 'L10', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['compressor'])
  })

  it('excludes products without a parseable capacity spec', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'no-spec' }),
      makeProduct({ id: 'has-spec', specs: [{ key: 'Capacidad', value: '5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['has-spec'])
  })

  it('excludes candidates outside the 0.5x-2x sanity bound', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'too-small', specs: [{ key: 'Capacidad', value: '1',  unit: 'TR' }] }),
      makeProduct({ id: 'in-range',  specs: [{ key: 'Capacidad', value: '4',  unit: 'TR' }] }),
      makeProduct({ id: 'too-big',   specs: [{ key: 'Capacidad', value: '20', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['in-range'])
  })

  it('sorts by closeness to the target and caps at 3 results', async () => {
    fetchProductsMock.mockResolvedValue([
      makeProduct({ id: 'far',     specs: [{ key: 'Capacidad', value: '8',   unit: 'TR' }] }),
      makeProduct({ id: 'closest', specs: [{ key: 'Capacidad', value: '5',   unit: 'TR' }] }),
      makeProduct({ id: 'near',    specs: [{ key: 'Capacidad', value: '6',   unit: 'TR' }] }),
      makeProduct({ id: 'nearer',  specs: [{ key: 'Capacidad', value: '4.5', unit: 'TR' }] }),
    ])

    const { suggestions } = useEquipmentSuggestions(ref(5))
    await flushPromises()

    expect(suggestions.value.map(p => p.id)).toEqual(['closest', 'nearer', 'near'])
  })
})
