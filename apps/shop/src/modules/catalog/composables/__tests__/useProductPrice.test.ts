import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useProductPrice, resolveEffectivePrice } from '../useProductPrice'
import { useAuthStore } from '@fsparts/core'
import type { Product } from '@fsparts/core'

const BASE: Product = {
  id: 'p1', sku: 'T001', name: 'Test', slug: 'test', description: '',
  brand:       { id: 1, name: 'B', slug: 'b' },
  category:    { id: 1, name: 'C', slug: 'c', productLineId: 1 },
  productLine: { id: 1, code: 'L01', name: 'Line', description: '', icon: '', slug: 'l01' },
  priceCop: 100_000, priceUsd: undefined,
  priceWs1: 80_000, priceWs2: 70_000,
  priceWs3: 75_000, priceWs4: 65_000,
  stock: 10, isFeatured: false, isNew: false,
  images: [], specs: [], refrigerants: [],
}

function setRole(role: string | null) {
  const auth = useAuthStore()
  auth.profile = role
    ? { id: 'u1', full_name: null, email: 'u@test.co', phone: null,
        role: role as any, company: null, notes: null }
    : null
}

describe('useProductPrice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns base price for unauthenticated user', () => {
    setRole(null)
    const { effectivePrice, isDiscounted, tierLabel } = useProductPrice(ref(BASE))
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
    expect(tierLabel.value).toBeNull()
  })

  it('returns base price for regular customer', () => {
    setRole('customer')
    const { effectivePrice, isDiscounted } = useProductPrice(ref(BASE))
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
  })

  it('customer_ws1 qty 1 → WS1 price, base crossed out, bulk hint', () => {
    setRole('customer_ws1')
    const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } =
      useProductPrice(ref(BASE), ref(1))
    expect(effectivePrice.value).toBe(80_000)
    expect(basePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(true)
    expect(tierLabel.value).toBe('WS1')
    expect(bulkPrice.value).toBe(70_000)
  })

  it('customer_ws1 qty 10 → WS2 price, bulkPrice null (already top tier)', () => {
    setRole('customer_ws1')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(10))
    expect(effectivePrice.value).toBe(70_000)
    expect(tierLabel.value).toBe('WS2 ×10')
    expect(bulkPrice.value).toBeNull()
  })

  it('customer_ws3 qty 1 → WS3 price', () => {
    setRole('customer_ws3')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(1))
    expect(effectivePrice.value).toBe(75_000)
    expect(tierLabel.value).toBe('OEM')
    expect(bulkPrice.value).toBe(65_000)
  })

  it('customer_ws3 qty 10 → WS4 price', () => {
    setRole('customer_ws3')
    const { effectivePrice, tierLabel, bulkPrice } = useProductPrice(ref(BASE), ref(10))
    expect(effectivePrice.value).toBe(65_000)
    expect(tierLabel.value).toBe('OEM ×10')
    expect(bulkPrice.value).toBeNull()
  })

  it('falls back to base price when WS columns are null', () => {
    setRole('customer_ws1')
    const p = ref({ ...BASE, priceWs1: undefined, priceWs2: undefined })
    const { effectivePrice, isDiscounted } = useProductPrice(p)
    expect(effectivePrice.value).toBe(100_000)
    expect(isDiscounted.value).toBe(false)
  })

  it('price updates reactively when qty changes across threshold', () => {
    setRole('customer_ws1')
    const qty = ref(1)
    const { effectivePrice, tierLabel } = useProductPrice(ref(BASE), qty)
    expect(effectivePrice.value).toBe(80_000)
    expect(tierLabel.value).toBe('WS1')
    qty.value = 10
    expect(effectivePrice.value).toBe(70_000)
    expect(tierLabel.value).toBe('WS2 ×10')
  })

  it('returns null effectivePrice when product is null', () => {
    setRole('customer_ws1')
    const { effectivePrice, isDiscounted } = useProductPrice(ref(null))
    expect(effectivePrice.value).toBeNull()
    expect(isDiscounted.value).toBe(false)
  })
})

describe('resolveEffectivePrice (pure)', () => {
  it('returns base price with no role, no Vue context required', () => {
    const result = resolveEffectivePrice(BASE, 1, null)
    expect(result.effectivePrice).toBe(100_000)
    expect(result.isDiscounted).toBe(false)
  })

  it('customer_ws1 qty 1 resolves WS1 tier directly', () => {
    const result = resolveEffectivePrice(BASE, 1, 'customer_ws1')
    expect(result.effectivePrice).toBe(80_000)
    expect(result.tierLabel).toBe('WS1')
  })

  it('customer_ws3 qty 10 resolves WS4 bulk tier directly', () => {
    const result = resolveEffectivePrice(BASE, 10, 'customer_ws3')
    expect(result.effectivePrice).toBe(65_000)
    expect(result.tierLabel).toBe('OEM ×10')
  })
})
