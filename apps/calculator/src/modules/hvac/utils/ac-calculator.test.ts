import { describe, it, expect } from 'vitest'
import { calculateAcLoad, defaultAcInputs } from './ac-calculator'

describe('calculateAcLoad', () => {
  const base = { ...defaultAcInputs(), length: 5, width: 4, height: 2.7 }

  it('applies 10% safety factor', () => {
    const r = calculateAcLoad(base)
    expect(r.qTotal).toBeCloseTo(r.qSubtotal * 1.10, 5)
  })

  it('converts W to BTU/h correctly', () => {
    const r = calculateAcLoad(base)
    expect(r.btuH).toBeCloseTo(r.qTotal * 3.41214, 2)
  })

  it('converts W to tons correctly', () => {
    const r = calculateAcLoad(base)
    expect(r.tons).toBeCloseTo(r.qTotal / 3517, 5)
  })

  it('good insulation gives lower load than no insulation', () => {
    const noIns = calculateAcLoad({ ...base, wallInsulation: 'none' })
    const goodIns = calculateAcLoad({ ...base, wallInsulation: 'good' })
    expect(goodIns.qTotal).toBeLessThan(noIns.qTotal)
  })

  it('more occupants increases load', () => {
    const few = calculateAcLoad({ ...base, occupants: 1 })
    const many = calculateAcLoad({ ...base, occupants: 10 })
    expect(many.qTotal).toBeGreaterThan(few.qTotal)
  })

  it('zero deltaT gives only solar + occupant loads', () => {
    const r = calculateAcLoad({ ...base, outdoorTemp: 24, indoorTemp: 24, occupants: 0, equipment: 'none', lighting: 'low' })
    expect(r.qWalls).toBe(0)
    expect(r.qRoof).toBe(0)
    expect(r.qInfiltration).toBe(0)
  })

  it('north orientation has lower solar gain than south', () => {
    const south = calculateAcLoad({ ...base, orientation: 'sur', windowArea: 2 })
    const north = calculateAcLoad({ ...base, orientation: 'norte', windowArea: 2 })
    expect(north.qSolar).toBeLessThan(south.qSolar)
  })
})
