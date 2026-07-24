import { describe, it, expect } from 'vitest'
import { parseCapacityToTons } from './capacity-parser'

describe('parseCapacityToTons', () => {
  it('parses a single value in TR', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '5', unit: 'TR' }])).toBe(5)
  })

  it('parses a range in TR as its midpoint', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '2–5', unit: 'TR' }])).toBe(3.5)
  })

  it('converts BTU/h to TR', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '30,000', unit: 'BTU/h' }])).toBeCloseTo(2.5, 5)
  })

  it('strips thousands separators before parsing', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '4,460', unit: 'BTU/h' }])).toBeCloseTo(4460 / 12000, 5)
  })

  it('returns null when no Capacidad spec is present', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad de secado', value: '15', unit: 'g H₂O' }])).toBeNull()
  })

  it('matches the Capacidad key case-insensitively', () => {
    expect(parseCapacityToTons([{ key: 'capacidad', value: '5', unit: 'TR' }])).toBe(5)
  })

  it('returns null for an unrecognized unit', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: '5', unit: 'kg' }])).toBeNull()
  })

  it('returns null when the value has no parseable number', () => {
    expect(parseCapacityToTons([{ key: 'Capacidad', value: 'n/a', unit: 'TR' }])).toBeNull()
  })
})
