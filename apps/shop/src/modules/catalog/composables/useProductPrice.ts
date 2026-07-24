import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@fsparts/core'
import type { Product, UserRole } from '@fsparts/core'

export interface PriceResult {
  effectivePrice: ComputedRef<number | null>
  basePrice:      ComputedRef<number | null>
  isDiscounted:   ComputedRef<boolean>
  tierLabel:      ComputedRef<string | null>
  bulkPrice:      ComputedRef<number | null>
  bulkThreshold:  ComputedRef<number>
}

export interface ResolvedPrice {
  effectivePrice: number | null
  basePrice:      number | null
  isDiscounted:   boolean
  tierLabel:      string | null
  bulkPrice:      number | null
}

export const BULK_THRESHOLD = 10

/**
 * Pure tier-pricing calculation, no Vue reactivity — safe to call from
 * plain code (Pinia stores) as well as from the reactive `useProductPrice`
 * wrapper below. Single source of truth for how a product's price resolves
 * for a given role/quantity. The Stripe `create-checkout-session` Edge
 * Function re-implements these exact same rules server-side in Deno (it
 * cannot import this file) — keep both in sync if the rules change.
 */
export function resolveEffectivePrice(
  product: Product,
  qty: number,
  role: UserRole | null | undefined,
): ResolvedPrice {
  const base = product.priceCop ?? product.priceUsd ?? null

  if (role === 'customer_ws1') {
    const ws1       = product.priceWs1 ?? base
    const ws2       = product.priceWs2 ?? null
    const effective = qty >= BULK_THRESHOLD ? (ws2 ?? ws1) : ws1
    return {
      effectivePrice: effective,
      basePrice:      effective !== null && base !== null && effective < base ? base : null,
      isDiscounted:   effective !== null && base !== null && effective < base,
      tierLabel:      product.priceWs1 != null ? (qty >= BULK_THRESHOLD ? 'WS2 ×10' : 'WS1') : null,
      bulkPrice:      qty < BULK_THRESHOLD ? ws2 : null,
    }
  }

  if (role === 'customer_ws3') {
    const ws3       = product.priceWs3 ?? base
    const ws4       = product.priceWs4 ?? null
    const effective = qty >= BULK_THRESHOLD ? (ws4 ?? ws3) : ws3
    return {
      effectivePrice: effective,
      basePrice:      effective !== null && base !== null && effective < base ? base : null,
      isDiscounted:   effective !== null && base !== null && effective < base,
      tierLabel:      product.priceWs3 != null ? (qty >= BULK_THRESHOLD ? 'OEM ×10' : 'OEM') : null,
      bulkPrice:      qty < BULK_THRESHOLD ? ws4 : null,
    }
  }

  return { effectivePrice: base, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
}

export function useProductPrice(
  product: Ref<Product | null | undefined>,
  qty: Ref<number> = ref(1),
): PriceResult {
  const auth = useAuthStore()

  const resolved = computed<ResolvedPrice>(() => {
    const p = product.value
    if (!p) {
      return { effectivePrice: null, basePrice: null, isDiscounted: false, tierLabel: null, bulkPrice: null }
    }
    return resolveEffectivePrice(p, qty.value, auth.profile?.role)
  })

  return {
    effectivePrice: computed(() => resolved.value.effectivePrice),
    basePrice:      computed(() => resolved.value.basePrice),
    isDiscounted:   computed(() => resolved.value.isDiscounted),
    tierLabel:      computed(() => resolved.value.tierLabel),
    bulkPrice:      computed(() => resolved.value.bulkPrice),
    bulkThreshold:  computed(() => BULK_THRESHOLD),
  }
}
