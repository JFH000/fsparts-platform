import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '../cart.store'
import { useAuthStore } from '@fsparts/core'
import type { Product } from '@fsparts/core'

const PRODUCT: Product = {
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

describe('cart.store subtotal (tiered pricing)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('regular customer pays base priceCop', () => {
    setRole('customer')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(100_000)
  })

  it('customer_ws1 qty 1 pays WS1 tier, not base price', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(80_000)
  })

  it('customer_ws1 qty 10 pays WS2 bulk tier', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 10)
    expect(cart.subtotal).toBe(700_000)
  })

  it('customer_ws3 qty 1 pays OEM (WS3) tier', () => {
    setRole('customer_ws3')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.subtotal).toBe(75_000)
  })

  it('sums multiple lines, each at its own tiered price', () => {
    setRole('customer_ws1')
    const cart = useCartStore()
    cart.clearCart()
    const second: Product = { ...PRODUCT, id: 'p2', priceWs1: 40_000 }
    cart.addToCart(PRODUCT, 1)
    cart.addToCart(second, 1)
    expect(cart.subtotal).toBe(80_000 + 40_000)
  })

  it('lineUnitPrice matches subtotal / quantity for a single line', () => {
    setRole('customer_ws3')
    const cart = useCartStore()
    cart.clearCart()
    cart.addToCart(PRODUCT, 1)
    expect(cart.lineUnitPrice(cart.items[0])).toBe(75_000)
  })
})
