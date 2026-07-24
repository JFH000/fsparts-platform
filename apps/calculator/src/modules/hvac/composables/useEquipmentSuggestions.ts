import { ref, watch, type Ref } from 'vue'
import { fetchProducts, type Product } from '@fsparts/core'
import { parseCapacityToTons } from '../utils/capacity-parser'

const COMPRESSOR_LINE_CODE = 'L06'
const MIN_RATIO = 0.5
const MAX_RATIO = 2
const MAX_RESULTS = 3

export function useEquipmentSuggestions(targetTons: Ref<number>) {
  const suggestions = ref<Product[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const target = targetTons.value
      const products = await fetchProducts()

      const ranked = products
        .filter(p => p.productLine.code === COMPRESSOR_LINE_CODE)
        .map(p => ({ product: p, tons: parseCapacityToTons(p.specs) }))
        .filter((entry): entry is { product: Product; tons: number } => entry.tons !== null)
        .filter(entry => entry.tons >= target * MIN_RATIO && entry.tons <= target * MAX_RATIO)
        .sort((a, b) => Math.abs(a.tons - target) - Math.abs(b.tons - target))
        .slice(0, MAX_RESULTS)

      suggestions.value = ranked.map(entry => entry.product)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  watch(targetTons, load, { immediate: true })

  return { suggestions, loading, error }
}
