import type { ProductSpec } from '@fsparts/core'

const BTU_PER_TON = 12000

export function parseCapacityToTons(specs: ProductSpec[]): number | null {
  const spec = specs.find(s => s.key.toLowerCase() === 'capacidad')
  if (!spec) return null

  const numbers = spec.value
    .replace(/,/g, '')
    .split(/[-–—]/)
    .map(part => Number.parseFloat(part.trim()))
    .filter(n => !Number.isNaN(n))

  if (!numbers.length) return null

  const midpoint = numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  const unit = (spec.unit ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (unit === 'TR') return midpoint
  if (unit.startsWith('BTU')) return midpoint / BTU_PER_TON
  return null
}
