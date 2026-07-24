export type Orientation     = 'norte' | 'sur' | 'este' | 'oeste'
export type WallInsulation  = 'none' | 'basic' | 'good'
export type RoofType        = 'exposed' | 'false_ceiling' | 'insulated'
export type WindowType      = 'single' | 'double' | 'solar_film'
export type SolarExposure   = 'high' | 'medium' | 'low' | 'shade'
export type LightingLevel   = 'low' | 'medium' | 'high'
export type EquipmentLevel  = 'none' | 'few' | 'several'

export interface AcInputs {
  length: number
  width: number
  height: number
  windowArea: number
  orientation: Orientation
  outdoorTemp: number
  indoorTemp: number
  wallInsulation: WallInsulation
  roofType: RoofType
  windowType: WindowType
  solarExposure: SolarExposure
  occupants: number
  lighting: LightingLevel
  equipment: EquipmentLevel
}

export interface AcResult {
  qWalls: number
  qRoof: number
  qWindows: number
  qSolar: number
  qInfiltration: number
  qOccupants: number
  qLighting: number
  qEquipment: number
  qSubtotal: number
  qTotal: number
  btuH: number
  kw: number
  tons: number
}

const U_WALL: Record<WallInsulation, number>    = { none: 2.5, basic: 1.0, good: 0.5 }
const U_ROOF: Record<RoofType, number>          = { exposed: 3.5, false_ceiling: 1.5, insulated: 0.5 }
const U_WINDOW: Record<WindowType, number>      = { single: 5.8, double: 2.8, solar_film: 3.5 }
const ORIENT_FACTOR: Record<Orientation, number>  = { sur: 1.0, este: 0.7, oeste: 0.7, norte: 0.3 }
const EXPOSURE_FACTOR: Record<SolarExposure, number> = { high: 1.3, medium: 1.0, low: 0.7, shade: 0.4 }
const LIGHTING_W_M2: Record<LightingLevel, number>   = { low: 5, medium: 10, high: 15 }
const EQUIPMENT_W: Record<EquipmentLevel, number>    = { none: 0, few: 200, several: 500 }
const SAFETY = 1.10

export function calculateAcLoad(i: AcInputs): AcResult {
  const deltaT      = i.outdoorTemp - i.indoorTemp
  const floorArea   = i.length * i.width
  const wallArea    = Math.max(0, 2 * (i.length + i.width) * i.height - i.windowArea)
  const expFactor   = EXPOSURE_FACTOR[i.solarExposure]

  const qWalls       = U_WALL[i.wallInsulation] * wallArea * deltaT
  const qRoof        = U_ROOF[i.roofType] * floorArea * deltaT * expFactor
  const qWindows     = U_WINDOW[i.windowType] * i.windowArea * deltaT
  const qSolar       = i.windowArea * 200 * ORIENT_FACTOR[i.orientation] * expFactor
  const qInfiltration = 0.33 * 0.5 * (i.length * i.width * i.height) * deltaT
  const qOccupants   = i.occupants * 115
  const qLighting    = LIGHTING_W_M2[i.lighting] * floorArea
  const qEquipment   = EQUIPMENT_W[i.equipment]

  const qSubtotal = Math.max(0, qWalls + qRoof + qWindows + qSolar + qInfiltration + qOccupants + qLighting + qEquipment)
  const qTotal    = qSubtotal * SAFETY

  return {
    qWalls, qRoof, qWindows, qSolar, qInfiltration, qOccupants, qLighting, qEquipment,
    qSubtotal, qTotal,
    btuH: qTotal * 3.41214,
    kw:   qTotal / 1000,
    tons: qTotal / 3517,
  }
}

export function defaultAcInputs(): AcInputs {
  return {
    length: 0, width: 0, height: 2.7,
    windowArea: 0, orientation: 'sur',
    outdoorTemp: 32, indoorTemp: 24,
    wallInsulation: 'basic', roofType: 'false_ceiling',
    windowType: 'single', solarExposure: 'medium',
    occupants: 2, lighting: 'medium', equipment: 'few',
  }
}
