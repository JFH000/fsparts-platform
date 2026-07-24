import { describe, it, expect } from 'vitest'
import { calculateColdLoad, defaultColdInputs } from './cold-calculator'

describe('calculateColdLoad', () => {
  const base = { ...defaultColdInputs(), length: 4, width: 3, height: 2.5, productMass: 500 }

  it('applies 15% safety factor', () => {
    const r = calculateColdLoad(base)
    expect(r.qTotal).toBeCloseTo(r.qSubtotal * 1.15, 5)
  })

  it('converts W to BTU/h correctly', () => {
    const r = calculateColdLoad(base)
    expect(r.btuH).toBeCloseTo(r.qTotal * 3.41214, 2)
  })

  it('converts W to tons correctly', () => {
    const r = calculateColdLoad(base)
    expect(r.tons).toBeCloseTo(r.qTotal / 3517, 5)
  })

  it('EPS insulation has higher transmission than polyurethane', () => {
    const poly = calculateColdLoad({ ...base, insulationMaterial: 'polyurethane' })
    const eps  = calculateColdLoad({ ...base, insulationMaterial: 'eps' })
    expect(eps.qTransmission).toBeGreaterThan(poly.qTransmission)
  })

  it('thicker insulation reduces transmission load', () => {
    const thin  = calculateColdLoad({ ...base, insulationThickness: 50 })
    const thick = calculateColdLoad({ ...base, insulationThickness: 200 })
    expect(thick.qTransmission).toBeLessThan(thin.qTransmission)
  })

  it('freezing (−18°C) has greater transmission than conservation (4°C)', () => {
    const cons   = calculateColdLoad({ ...base, indoorTemp: 4 })
    const freeze = calculateColdLoad({ ...base, indoorTemp: -18 })
    expect(freeze.qTransmission).toBeGreaterThan(cons.qTransmission)
  })

  it('high door frequency gives more infiltration than low', () => {
    const low  = calculateColdLoad({ ...base, doorFrequency: 'low' })
    const high = calculateColdLoad({ ...base, doorFrequency: 'high' })
    expect(high.qInfiltration).toBeGreaterThan(low.qInfiltration)
  })

  it('more persons increases internal load', () => {
    const r1 = calculateColdLoad({ ...base, persons: 0 })
    const r2 = calculateColdLoad({ ...base, persons: 3 })
    expect(r2.qInternal).toBeGreaterThan(r1.qInternal)
  })
})
