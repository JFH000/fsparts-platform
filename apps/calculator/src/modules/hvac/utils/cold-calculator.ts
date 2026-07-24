export type ColdType            = 'conservation' | 'freezing'
export type InsulationThickness = 50 | 75 | 100 | 150 | 200
export type InsulationMaterial  = 'polyurethane' | 'eps'
export type ProductType         = 'fruits_veg' | 'meat' | 'dairy' | 'frozen' | 'flowers' | 'other'
export type DoorFrequency       = 'low' | 'medium' | 'high'

export interface ColdInputs {
  type: ColdType
  indoorTemp: number
  length: number
  width: number
  height: number
  insulationThickness: InsulationThickness
  insulationMaterial: InsulationMaterial
  outdoorTemp: number
  productType: ProductType
  productMass: number
  productEntryTemp: number
  pullDownHours: number
  persons: number
  doorFrequency: DoorFrequency
}

export interface ColdResult {
  qTransmission: number
  qProduct: number
  qInfiltration: number
  qInternal: number
  qSubtotal: number
  qTotal: number
  btuH: number
  kw: number
  tons: number
}

const U_POLY: Record<InsulationThickness, number> = {
  50: 0.45, 75: 0.30, 100: 0.22, 150: 0.15, 200: 0.11,
}

const CP: Record<ProductType, { above: number; below: number }> = {
  fruits_veg: { above: 3.8, below: 2.0 },
  meat:       { above: 3.2, below: 2.0 },
  dairy:      { above: 3.9, below: 2.0 },
  frozen:     { above: 2.0, below: 2.0 },
  flowers:    { above: 3.8, below: 2.0 },
  other:      { above: 3.5, below: 2.0 },
}

const AIR_CHANGES: Record<DoorFrequency, number> = { low: 2, medium: 6, high: 12 }
const SAFETY = 1.15

export function calculateColdLoad(i: ColdInputs): ColdResult {
  const deltaT      = i.outdoorTemp - i.indoorTemp
  const volume      = i.length * i.width * i.height
  const floorArea   = i.length * i.width
  const surfaceArea = 2 * (i.length * i.width + i.length * i.height + i.width * i.height)

  const uBase         = U_POLY[i.insulationThickness]
  const u             = i.insulationMaterial === 'eps' ? uBase * 1.20 : uBase
  const qTransmission = u * surfaceArea * deltaT

  const cp       = i.indoorTemp < 0 ? CP[i.productType].below : CP[i.productType].above
  const dtProd   = i.productEntryTemp - i.indoorTemp
  const qProduct = i.pullDownHours > 0 && i.productMass > 0
    ? (i.productMass * cp * 1000 * dtProd) / (i.pullDownHours * 3600)
    : 0

  const achH          = AIR_CHANGES[i.doorFrequency] / 24
  const qInfiltration = 0.33 * achH * volume * deltaT

  const qInternal = i.persons * 270 + 6 * floorArea

  const qSubtotal = qTransmission + qProduct + qInfiltration + qInternal
  const qTotal    = qSubtotal * SAFETY

  return {
    qTransmission, qProduct, qInfiltration, qInternal,
    qSubtotal, qTotal,
    btuH: qTotal * 3.41214,
    kw:   qTotal / 1000,
    tons: qTotal / 3517,
  }
}

export function defaultColdInputs(): ColdInputs {
  return {
    type: 'conservation', indoorTemp: 4,
    length: 0, width: 0, height: 2.5,
    insulationThickness: 100, insulationMaterial: 'polyurethane',
    outdoorTemp: 32,
    productType: 'fruits_veg', productMass: 0,
    productEntryTemp: 20, pullDownHours: 12,
    persons: 1, doorFrequency: 'medium',
  }
}
