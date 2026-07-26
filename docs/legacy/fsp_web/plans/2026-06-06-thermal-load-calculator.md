# Thermal Load Calculator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/hvac-calculator` placeholder with a full step-by-step wizard that calculates thermal load for AC rooms and industrial cold rooms.

**Architecture:** Frontend-only. Two wizard flows (AC: 4 steps, Cold Room: 5 steps) orchestrated by `HvacCalculatorView.vue`. All state is local `reactive()` — no Pinia. Calculation logic lives in pure TypeScript functions in `utils/` that are unit-tested with Vitest.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS 4, @lucide/vue, Vitest

---

## Files

**Created:**
- `vitest.config.ts`
- `src/modules/hvac/utils/ac-calculator.ts`
- `src/modules/hvac/utils/ac-calculator.test.ts`
- `src/modules/hvac/utils/cold-calculator.ts`
- `src/modules/hvac/utils/cold-calculator.test.ts`
- `src/modules/hvac/components/ModeSelector.vue`
- `src/modules/hvac/components/WizardProgress.vue`
- `src/modules/hvac/components/ac/AcStep1Dimensions.vue`
- `src/modules/hvac/components/ac/AcStep2Conditions.vue`
- `src/modules/hvac/components/ac/AcStep3InternalLoads.vue`
- `src/modules/hvac/components/ac/AcResults.vue`
- `src/modules/hvac/components/cold/ColdStep1Type.vue`
- `src/modules/hvac/components/cold/ColdStep2Dimensions.vue`
- `src/modules/hvac/components/cold/ColdStep3Product.vue`
- `src/modules/hvac/components/cold/ColdStep4InternalLoads.vue`
- `src/modules/hvac/components/cold/ColdResults.vue`

**Modified:**
- `package.json` — add vitest + test script
- `src/modules/hvac/views/HvacCalculatorView.vue` — replace placeholder

---

## Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Install vitest**

```bash
npm install -D vitest @vue/test-utils jsdom
```

- [ ] **Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { environment: 'node' },
})
```

- [ ] **Add test script to `package.json`**

In the `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Verify setup works**

```bash
npx vitest run
```
Expected: "No test files found" (not an error crash).

- [ ] **Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: AC calculator — types, pure functions, and tests

**Files:**
- Create: `src/modules/hvac/utils/ac-calculator.ts`
- Create: `src/modules/hvac/utils/ac-calculator.test.ts`

- [ ] **Write the failing tests first**

Create `src/modules/hvac/utils/ac-calculator.test.ts`:

```typescript
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
```

- [ ] **Run tests — expect failures**

```bash
npx vitest run src/modules/hvac/utils/ac-calculator.test.ts
```
Expected: FAIL — "Cannot find module './ac-calculator'"

- [ ] **Create `src/modules/hvac/utils/ac-calculator.ts`**

```typescript
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
  const wallArea    = 2 * (i.length + i.width) * i.height - i.windowArea
  const expFactor   = EXPOSURE_FACTOR[i.solarExposure]

  const qWalls       = U_WALL[i.wallInsulation] * wallArea * deltaT
  const qRoof        = U_ROOF[i.roofType] * floorArea * deltaT * expFactor
  const qWindows     = U_WINDOW[i.windowType] * i.windowArea * deltaT
  const qSolar       = i.windowArea * 200 * ORIENT_FACTOR[i.orientation] * expFactor
  const qInfiltration = 0.33 * 0.5 * (i.length * i.width * i.height) * deltaT
  const qOccupants   = i.occupants * 115
  const qLighting    = LIGHTING_W_M2[i.lighting] * floorArea
  const qEquipment   = EQUIPMENT_W[i.equipment]

  const qSubtotal = qWalls + qRoof + qWindows + qSolar + qInfiltration + qOccupants + qLighting + qEquipment
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
```

- [ ] **Run tests — expect all pass**

```bash
npx vitest run src/modules/hvac/utils/ac-calculator.test.ts
```
Expected: 7 tests pass.

- [ ] **Commit**

```bash
git add src/modules/hvac/utils/ac-calculator.ts src/modules/hvac/utils/ac-calculator.test.ts
git commit -m "feat: add AC thermal load calculator with unit tests"
```

---

## Task 3: Cold room calculator — types, pure functions, and tests

**Files:**
- Create: `src/modules/hvac/utils/cold-calculator.ts`
- Create: `src/modules/hvac/utils/cold-calculator.test.ts`

- [ ] **Write the failing tests first**

Create `src/modules/hvac/utils/cold-calculator.test.ts`:

```typescript
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
```

- [ ] **Run tests — expect failures**

```bash
npx vitest run src/modules/hvac/utils/cold-calculator.test.ts
```
Expected: FAIL — "Cannot find module './cold-calculator'"

- [ ] **Create `src/modules/hvac/utils/cold-calculator.ts`**

```typescript
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

  const uBase        = U_POLY[i.insulationThickness]
  const u            = i.insulationMaterial === 'eps' ? uBase * 1.20 : uBase
  const qTransmission = u * surfaceArea * deltaT

  const cp       = i.indoorTemp < 0 ? CP[i.productType].below : CP[i.productType].above
  const dtProd   = i.productEntryTemp - i.indoorTemp
  const qProduct = i.pullDownHours > 0
    ? (i.productMass * cp * 1000 * dtProd) / (i.pullDownHours * 3600)
    : 0

  const achH         = AIR_CHANGES[i.doorFrequency] / 24
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
```

- [ ] **Run tests — all pass**

```bash
npx vitest run src/modules/hvac/utils/cold-calculator.test.ts
```
Expected: 8 tests pass.

- [ ] **Commit**

```bash
git add src/modules/hvac/utils/cold-calculator.ts src/modules/hvac/utils/cold-calculator.test.ts
git commit -m "feat: add cold room thermal load calculator with unit tests"
```

---

## Task 4: ModeSelector component

**Files:**
- Create: `src/modules/hvac/components/ModeSelector.vue`

- [ ] **Create `src/modules/hvac/components/ModeSelector.vue`**

```vue
<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
    <h1 class="text-3xl font-bold text-slate-900 mb-2 text-center">Calculadora de Carga Térmica</h1>
    <p class="text-slate-500 mb-10 text-center">Selecciona el tipo de cálculo</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
      <button
        @click="$emit('select', 'ac')"
        class="group flex flex-col items-center gap-4 bg-white border-2 border-slate-200 hover:border-brand-500 hover:shadow-lg rounded-2xl p-8 transition-all text-left"
      >
        <div class="w-16 h-16 bg-brand-50 group-hover:bg-brand-100 rounded-2xl flex items-center justify-center transition-colors">
          <AirVent class="h-8 w-8 text-brand-700" />
        </div>
        <div>
          <p class="text-lg font-bold text-slate-900">Aire Acondicionado</p>
          <p class="text-sm text-slate-500 mt-1">Calcula la carga para habitaciones, oficinas y espacios a climatizar</p>
        </div>
      </button>

      <button
        @click="$emit('select', 'cold')"
        class="group flex flex-col items-center gap-4 bg-white border-2 border-slate-200 hover:border-brand-500 hover:shadow-lg rounded-2xl p-8 transition-all text-left"
      >
        <div class="w-16 h-16 bg-blue-50 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center transition-colors">
          <Snowflake class="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <p class="text-lg font-bold text-slate-900">Cuarto Frío</p>
          <p class="text-sm text-slate-500 mt-1">Calcula la carga para cámaras de conservación y congelación industrial</p>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AirVent, Snowflake } from '@lucide/vue'
defineEmits<{ select: ['ac' | 'cold'] }>()
</script>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/ModeSelector.vue
git commit -m "feat: add HVAC mode selector component"
```

---

## Task 5: WizardProgress component

**Files:**
- Create: `src/modules/hvac/components/WizardProgress.vue`

- [ ] **Create `src/modules/hvac/components/WizardProgress.vue`**

```vue
<template>
  <div class="flex items-center gap-2 mb-8 flex-wrap">
    <template v-for="(label, i) in steps" :key="i">
      <button
        class="flex items-center gap-2 min-w-0"
        :disabled="i >= current"
        @click="i < current && $emit('go', i)"
      >
        <span
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
          :class="i === current
            ? 'bg-brand-700 text-white'
            : i < current
              ? 'bg-brand-100 text-brand-700 cursor-pointer'
              : 'bg-slate-100 text-slate-400'"
        >{{ i + 1 }}</span>
        <span
          class="text-sm whitespace-nowrap transition-colors"
          :class="i === current ? 'text-slate-800 font-semibold' : i < current ? 'text-brand-600' : 'text-slate-400'"
        >{{ label }}</span>
      </button>
      <div
        v-if="i < steps.length - 1"
        class="flex-1 h-px min-w-4 transition-colors"
        :class="i < current ? 'bg-brand-200' : 'bg-slate-100'"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ steps: string[]; current: number }>()
defineEmits<{ go: [number] }>()
</script>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/WizardProgress.vue
git commit -m "feat: add wizard progress bar component"
```

---

## Task 6: AC Step 1 — Dimensions

**Files:**
- Create: `src/modules/hvac/components/ac/AcStep1Dimensions.vue`

- [ ] **Create `src/modules/hvac/components/ac/AcStep1Dimensions.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Dimensiones del espacio</h2>
    <p class="text-sm text-slate-500 mb-6">Ingresa las medidas del área a climatizar</p>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <div>
        <label class="field-label">Largo</label>
        <div class="relative">
          <input v-model.number="form.length" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Ancho</label>
        <div class="relative">
          <input v-model.number="form.width" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Alto</label>
        <div class="relative">
          <input v-model.number="form.height" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="2.7" />
          <span class="unit">m</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-8">
      <div>
        <label class="field-label">Área total de ventanas</label>
        <div class="relative">
          <input v-model.number="form.windowArea" type="number" min="0" step="0.1" class="field-input pr-12" placeholder="0" />
          <span class="unit">m²</span>
        </div>
      </div>
      <div>
        <label class="field-label">Orientación principal</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in orientations" :key="opt.value"
            @click="form.orientation = opt.value"
            class="chip"
            :class="form.orientation === opt.value ? 'chip-active' : 'chip-inactive'"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</div>

    <div class="flex justify-end">
      <button @click="handleNext" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AcInputs, Orientation } from '../../utils/ac-calculator'

const props = defineProps<{ form: AcInputs }>()
const emit  = defineEmits<{ next: [] }>()
const error = ref('')

const orientations: { value: Orientation; label: string }[] = [
  { value: 'norte', label: 'Norte' },
  { value: 'sur',   label: 'Sur'   },
  { value: 'este',  label: 'Este'  },
  { value: 'oeste', label: 'Oeste' },
]

function handleNext() {
  if (!props.form.length || !props.form.width || !props.form.height) {
    error.value = 'Ingresa largo, ancho y alto del espacio.'
    return
  }
  error.value = ''
  emit('next')
}
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/ac/AcStep1Dimensions.vue
git commit -m "feat: add AC wizard step 1 - dimensions"
```

---

## Task 7: AC Step 2 — Conditions

**Files:**
- Create: `src/modules/hvac/components/ac/AcStep2Conditions.vue`

- [ ] **Create `src/modules/hvac/components/ac/AcStep2Conditions.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Materiales y condiciones</h2>
    <p class="text-sm text-slate-500 mb-6">Define el entorno y las características constructivas</p>

    <!-- Temps -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label class="field-label">Temperatura exterior de diseño</label>
        <div class="relative">
          <input v-model.number="form.outdoorTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Ej: 32°C costa, 18°C Bogotá</p>
      </div>
      <div>
        <label class="field-label">Temperatura interior deseada</label>
        <div class="relative">
          <input v-model.number="form.indoorTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
      </div>
    </div>

    <!-- Wall insulation -->
    <div class="mb-6">
      <label class="field-label">Aislamiento de paredes</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in wallOpts" :key="opt.value" @click="form.wallInsulation = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.wallInsulation === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold text-sm">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <!-- Roof type -->
    <div class="mb-6">
      <label class="field-label">Tipo de techo</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in roofOpts" :key="opt.value" @click="form.roofType = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.roofType === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold text-sm">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <!-- Windows -->
    <div class="grid grid-cols-2 gap-6 mb-8">
      <div>
        <label class="field-label">Tipo de ventanas</label>
        <div class="flex flex-col gap-2">
          <button v-for="opt in windowOpts" :key="opt.value" @click="form.windowType = opt.value"
            class="chip text-left" :class="form.windowType === opt.value ? 'chip-active' : 'chip-inactive'">
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div>
        <label class="field-label">Exposición solar</label>
        <div class="flex flex-col gap-2">
          <button v-for="opt in exposureOpts" :key="opt.value" @click="form.solarExposure = opt.value"
            class="chip text-left" :class="form.solarExposure === opt.value ? 'chip-active' : 'chip-inactive'">
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AcInputs, WallInsulation, RoofType, WindowType, SolarExposure } from '../../utils/ac-calculator'

defineProps<{ form: AcInputs }>()
defineEmits<{ next: []; back: [] }>()

const wallOpts:     { value: WallInsulation;  label: string; sub: string }[] = [
  { value: 'none',  label: 'Sin aislamiento', sub: 'Ladrillo visto' },
  { value: 'basic', label: 'Básico',          sub: 'Bloque + repello' },
  { value: 'good',  label: 'Bueno',           sub: 'Con aislante' },
]
const roofOpts:     { value: RoofType;        label: string; sub: string }[] = [
  { value: 'exposed',      label: 'Losa expuesta', sub: 'Sol directo' },
  { value: 'false_ceiling', label: 'Cielo raso',   sub: 'Con cámara de aire' },
  { value: 'insulated',    label: 'Aislado',        sub: 'Con aislante térmico' },
]
const windowOpts:   { value: WindowType;      label: string }[] = [
  { value: 'single',     label: 'Vidrio simple' },
  { value: 'double',     label: 'Vidrio doble' },
  { value: 'solar_film', label: 'Con película solar' },
]
const exposureOpts: { value: SolarExposure;   label: string }[] = [
  { value: 'high',   label: 'Alta — sin sombra' },
  { value: 'medium', label: 'Media — parcialmente sombreado' },
  { value: 'low',    label: 'Baja — mayormente sombreado' },
  { value: 'shade',  label: 'Sombra total' },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.back-btn { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/ac/AcStep2Conditions.vue
git commit -m "feat: add AC wizard step 2 - conditions"
```

---

## Task 8: AC Step 3 — Internal Loads

**Files:**
- Create: `src/modules/hvac/components/ac/AcStep3InternalLoads.vue`

- [ ] **Create `src/modules/hvac/components/ac/AcStep3InternalLoads.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Cargas internas</h2>
    <p class="text-sm text-slate-500 mb-6">Personas, iluminación y equipos dentro del espacio</p>

    <!-- Occupants -->
    <div class="mb-6">
      <label class="field-label">Número de personas habituales</label>
      <div class="flex items-center gap-3">
        <button @click="form.occupants = Math.max(0, form.occupants - 1)"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">−</button>
        <span class="text-2xl font-bold text-slate-900 min-w-[3rem] text-center">{{ form.occupants }}</span>
        <button @click="form.occupants++"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">+</button>
        <span class="text-sm text-slate-400 ml-2">× 115 W por persona (calor sensible)</span>
      </div>
    </div>

    <!-- Lighting -->
    <div class="mb-6">
      <label class="field-label">Iluminación</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in lightingOpts" :key="opt.value" @click="form.lighting = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.lighting === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <!-- Equipment -->
    <div class="mb-8">
      <label class="field-label">Equipos eléctricos</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in equipmentOpts" :key="opt.value" @click="form.equipment = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.equipment === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Ver resultado →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AcInputs, LightingLevel, EquipmentLevel } from '../../utils/ac-calculator'

defineProps<{ form: AcInputs }>()
defineEmits<{ next: []; back: [] }>()

const lightingOpts:  { value: LightingLevel;  label: string; sub: string }[] = [
  { value: 'low',    label: 'Baja',    sub: '~5 W/m²'  },
  { value: 'medium', label: 'Media',   sub: '~10 W/m²' },
  { value: 'high',   label: 'Alta',    sub: '~15 W/m²' },
]
const equipmentOpts: { value: EquipmentLevel; label: string; sub: string }[] = [
  { value: 'none',    label: 'Ninguno', sub: '0 W'    },
  { value: 'few',     label: 'Pocos',   sub: '~200 W' },
  { value: 'several', label: 'Varios',  sub: '~500 W' },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.back-btn { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/ac/AcStep3InternalLoads.vue
git commit -m "feat: add AC wizard step 3 - internal loads"
```

---

## Task 9: AC Results

**Files:**
- Create: `src/modules/hvac/components/ac/AcResults.vue`

- [ ] **Create `src/modules/hvac/components/ac/AcResults.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Resultado — Aire Acondicionado</h2>
    <p class="text-sm text-slate-500 mb-6">Carga térmica total con factor de seguridad del 10%</p>

    <!-- Primary result -->
    <div class="bg-brand-700 rounded-2xl p-6 mb-6 text-white">
      <p class="text-sm font-medium opacity-80 mb-1">Carga térmica total</p>
      <p class="text-5xl font-extrabold mb-1">{{ fmt(result.btuH) }} <span class="text-2xl font-semibold opacity-80">BTU/h</span></p>
      <div class="flex gap-6 mt-3 text-sm opacity-80">
        <span><strong class="text-white font-bold">{{ result.kw.toFixed(2) }}</strong> kW</span>
        <span><strong class="text-white font-bold">{{ result.tons.toFixed(2) }}</strong> TR</span>
      </div>
    </div>

    <!-- Breakdown -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-slate-100">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Desglose de cargas</p>
      </div>
      <div class="divide-y divide-slate-50">
        <ResultRow v-for="row in rows" :key="row.label" :label="row.label" :watts="row.value" :total="result.qSubtotal" />
        <div class="flex items-center gap-3 px-5 py-3 bg-slate-50">
          <span class="text-sm text-slate-500 flex-1">Factor de seguridad (10%)</span>
          <span class="text-sm font-semibold text-slate-700">+ {{ fmt(result.qTotal - result.qSubtotal) }} W</span>
        </div>
      </div>
    </div>

    <!-- Coming soon -->
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
      <Lock class="h-6 w-6 text-slate-300 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-400">Sugerencia de equipos</p>
      <p class="text-xs text-slate-300 mt-1">Próximamente</p>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('reset')" class="reset-btn">Calcular de nuevo</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { Lock } from '@lucide/vue'
import type { AcResult } from '../../utils/ac-calculator'

const props = defineProps<{ result: AcResult }>()
defineEmits<{ back: []; reset: [] }>()

const fmt = (n: number) => Math.round(n).toLocaleString('es-CO')

const rows = computed(() => [
  { label: 'Paredes',      value: props.result.qWalls },
  { label: 'Techo',        value: props.result.qRoof },
  { label: 'Ventanas',     value: props.result.qWindows },
  { label: 'Ganancia solar', value: props.result.qSolar },
  { label: 'Infiltración', value: props.result.qInfiltration },
  { label: 'Personas',     value: props.result.qOccupants },
  { label: 'Iluminación',  value: props.result.qLighting },
  { label: 'Equipos',      value: props.result.qEquipment },
].filter(r => r.value > 0))

const ResultRow = defineComponent({
  props: { label: String, watts: Number, total: Number },
  setup(p) {
    return () => {
      const pct = p.total! > 0 ? (p.watts! / p.total!) * 100 : 0
      return h('div', { class: 'flex items-center gap-3 px-5 py-3' }, [
        h('span', { class: 'text-sm text-slate-600 w-32 flex-shrink-0' }, p.label),
        h('div', { class: 'flex-1 h-2 bg-slate-100 rounded-full overflow-hidden' },
          h('div', { class: 'h-full bg-brand-400 rounded-full', style: `width:${pct.toFixed(1)}%` })),
        h('span', { class: 'text-sm font-semibold text-slate-700 w-24 text-right' }, `${Math.round(p.watts!).toLocaleString('es-CO')} W`),
        h('span', { class: 'text-xs text-slate-400 w-10 text-right' }, `${pct.toFixed(0)}%`),
      ])
    }
  },
})
</script>

<style scoped>
@reference "../../../../style.css";
.back-btn  { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.reset-btn { @apply bg-slate-900 hover:bg-slate-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/ac/AcResults.vue
git commit -m "feat: add AC results component with load breakdown"
```

---

## Task 10: Cold Step 1 — Type

**Files:**
- Create: `src/modules/hvac/components/cold/ColdStep1Type.vue`

- [ ] **Create `src/modules/hvac/components/cold/ColdStep1Type.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Tipo de aplicación</h2>
    <p class="text-sm text-slate-500 mb-6">Selecciona el uso del cuarto frío</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <button
        @click="selectType('conservation')"
        class="group flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all"
        :class="form.type === 'conservation' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'"
      >
        <Thermometer class="h-6 w-6" :class="form.type === 'conservation' ? 'text-brand-700' : 'text-slate-400'" />
        <div>
          <p class="font-bold text-slate-900">Conservación</p>
          <p class="text-sm text-slate-500 mt-0.5">Frutas, verduras, carnes, lácteos — 0°C a 8°C</p>
        </div>
      </button>

      <button
        @click="selectType('freezing')"
        class="group flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-all"
        :class="form.type === 'freezing' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'"
      >
        <Snowflake class="h-6 w-6" :class="form.type === 'freezing' ? 'text-brand-700' : 'text-slate-400'" />
        <div>
          <p class="font-bold text-slate-900">Congelación</p>
          <p class="text-sm text-slate-500 mt-0.5">Congelados, helados — −18°C a −25°C</p>
        </div>
      </button>
    </div>

    <!-- Indoor temp -->
    <div class="mb-8">
      <label class="field-label">Temperatura interior de diseño</label>
      <div class="relative w-48">
        <input v-model.number="form.indoorTemp" type="number" class="field-input pr-10" />
        <span class="unit">°C</span>
      </div>
      <p class="text-xs text-slate-400 mt-1">Rango típico: {{ form.type === 'conservation' ? '0°C a 8°C' : '−18°C a −25°C' }}</p>
    </div>

    <div class="flex justify-end">
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Thermometer, Snowflake } from '@lucide/vue'
import type { ColdInputs, ColdType } from '../../utils/cold-calculator'

const props = defineProps<{ form: ColdInputs }>()
defineEmits<{ next: [] }>()

function selectType(type: ColdType) {
  props.form.type = type
  props.form.indoorTemp = type === 'conservation' ? 4 : -18
}
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/cold/ColdStep1Type.vue
git commit -m "feat: add cold room wizard step 1 - type selection"
```

---

## Task 11: Cold Step 2 — Dimensions & Insulation

**Files:**
- Create: `src/modules/hvac/components/cold/ColdStep2Dimensions.vue`

- [ ] **Create `src/modules/hvac/components/cold/ColdStep2Dimensions.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Dimensiones y aislamiento</h2>
    <p class="text-sm text-slate-500 mb-6">Medidas interiores del cuarto frío y tipo de panel</p>

    <!-- Dimensions -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div>
        <label class="field-label">Largo</label>
        <div class="relative">
          <input v-model.number="form.length" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Ancho</label>
        <div class="relative">
          <input v-model.number="form.width" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="0" />
          <span class="unit">m</span>
        </div>
      </div>
      <div>
        <label class="field-label">Alto</label>
        <div class="relative">
          <input v-model.number="form.height" type="number" min="0" step="0.1" class="field-input pr-10" placeholder="2.5" />
          <span class="unit">m</span>
        </div>
      </div>
    </div>

    <!-- Insulation thickness -->
    <div class="mb-6">
      <label class="field-label">Espesor del aislamiento</label>
      <div class="flex gap-2 flex-wrap">
        <button v-for="t in thicknesses" :key="t" @click="form.insulationThickness = t"
          class="chip" :class="form.insulationThickness === t ? 'chip-active' : 'chip-inactive'">
          {{ t }} mm
        </button>
      </div>
    </div>

    <!-- Insulation material -->
    <div class="mb-6">
      <label class="field-label">Material de aislamiento</label>
      <div class="grid grid-cols-2 gap-2">
        <button @click="form.insulationMaterial = 'polyurethane'"
          class="chip flex-col gap-0.5 py-3" :class="form.insulationMaterial === 'polyurethane' ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">Poliuretano</span>
          <span class="text-xs opacity-70">Recomendado</span>
        </button>
        <button @click="form.insulationMaterial = 'eps'"
          class="chip flex-col gap-0.5 py-3" :class="form.insulationMaterial === 'eps' ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">EPS</span>
          <span class="text-xs opacity-70">Poliestireno expandido</span>
        </button>
      </div>
    </div>

    <!-- Outdoor temp -->
    <div class="mb-8">
      <label class="field-label">Temperatura exterior de diseño</label>
      <div class="relative w-48">
        <input v-model.number="form.outdoorTemp" type="number" class="field-input pr-10" />
        <span class="unit">°C</span>
      </div>
      <p class="text-xs text-slate-400 mt-1">Temperatura del ambiente donde está instalado el cuarto</p>
    </div>

    <div v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="handleNext" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ColdInputs, InsulationThickness } from '../../utils/cold-calculator'

const props = defineProps<{ form: ColdInputs }>()
const emit  = defineEmits<{ next: []; back: [] }>()
const error = ref('')
const thicknesses: InsulationThickness[] = [50, 75, 100, 150, 200]

function handleNext() {
  if (!props.form.length || !props.form.width || !props.form.height) {
    error.value = 'Ingresa largo, ancho y alto del cuarto.'
    return
  }
  error.value = ''
  emit('next')
}
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.back-btn { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/cold/ColdStep2Dimensions.vue
git commit -m "feat: add cold room wizard step 2 - dimensions and insulation"
```

---

## Task 12: Cold Step 3 — Product

**Files:**
- Create: `src/modules/hvac/components/cold/ColdStep3Product.vue`

- [ ] **Create `src/modules/hvac/components/cold/ColdStep3Product.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Producto almacenado</h2>
    <p class="text-sm text-slate-500 mb-6">Información para calcular la carga de enfriamiento inicial (pull-down)</p>

    <!-- Product type -->
    <div class="mb-6">
      <label class="field-label">Tipo de producto</label>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button v-for="opt in productOpts" :key="opt.value" @click="form.productType = opt.value"
          class="chip py-2.5 text-left" :class="form.productType === opt.value ? 'chip-active' : 'chip-inactive'">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Mass + entry temp + pull-down hours -->
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div>
        <label class="field-label">Masa del producto</label>
        <div class="relative">
          <input v-model.number="form.productMass" type="number" min="0" class="field-input pr-10" placeholder="0" />
          <span class="unit">kg</span>
        </div>
      </div>
      <div>
        <label class="field-label">Temperatura de entrada</label>
        <div class="relative">
          <input v-model.number="form.productEntryTemp" type="number" class="field-input pr-10" />
          <span class="unit">°C</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">A qué temperatura llega el producto</p>
      </div>
      <div>
        <label class="field-label">Tiempo de pull-down</label>
        <div class="relative">
          <input v-model.number="form.pullDownHours" type="number" min="1" class="field-input pr-8" />
          <span class="unit">h</span>
        </div>
        <p class="text-xs text-slate-400 mt-1">Horas para enfriar el producto</p>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Siguiente →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColdInputs, ProductType } from '../../utils/cold-calculator'

defineProps<{ form: ColdInputs }>()
defineEmits<{ next: []; back: [] }>()

const productOpts: { value: ProductType; label: string }[] = [
  { value: 'fruits_veg', label: 'Frutas / Verduras' },
  { value: 'meat',       label: 'Carnes'            },
  { value: 'dairy',      label: 'Lácteos'           },
  { value: 'frozen',     label: 'Congelados'        },
  { value: 'flowers',    label: 'Flores'            },
  { value: 'other',      label: 'Otro'              },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.field-input { @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all; }
.unit { @apply absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.back-btn { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/cold/ColdStep3Product.vue
git commit -m "feat: add cold room wizard step 3 - product"
```

---

## Task 13: Cold Step 4 — Internal Loads

**Files:**
- Create: `src/modules/hvac/components/cold/ColdStep4InternalLoads.vue`

- [ ] **Create `src/modules/hvac/components/cold/ColdStep4InternalLoads.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Cargas internas</h2>
    <p class="text-sm text-slate-500 mb-6">Personas que acceden al cuarto y uso de la puerta</p>

    <!-- Persons -->
    <div class="mb-6">
      <label class="field-label">Personas que acceden habitualmente</label>
      <div class="flex items-center gap-3">
        <button @click="form.persons = Math.max(0, form.persons - 1)"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">−</button>
        <span class="text-2xl font-bold text-slate-900 min-w-[3rem] text-center">{{ form.persons }}</span>
        <button @click="form.persons++"
          class="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 hover:border-brand-500 transition-colors">+</button>
        <span class="text-sm text-slate-400 ml-2">× 270 W por persona</span>
      </div>
    </div>

    <!-- Door frequency -->
    <div class="mb-8">
      <label class="field-label">Frecuencia de apertura de puerta</label>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="opt in doorOpts" :key="opt.value" @click="form.doorFrequency = opt.value"
          class="chip flex-col gap-0.5 py-3" :class="form.doorFrequency === opt.value ? 'chip-active' : 'chip-inactive'">
          <span class="font-semibold">{{ opt.label }}</span>
          <span class="text-xs opacity-70">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('next')" class="next-btn">Ver resultado →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColdInputs, DoorFrequency } from '../../utils/cold-calculator'

defineProps<{ form: ColdInputs }>()
defineEmits<{ next: []; back: [] }>()

const doorOpts: { value: DoorFrequency; label: string; sub: string }[] = [
  { value: 'low',    label: 'Baja',   sub: '~2 aperturas/día'  },
  { value: 'medium', label: 'Media',  sub: '~6 aperturas/día'  },
  { value: 'high',   label: 'Alta',   sub: '~12 aperturas/día' },
]
</script>

<style scoped>
@reference "../../../../style.css";
.field-label { @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5; }
.chip { @apply px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all; }
.chip-active   { @apply border-brand-600 bg-brand-50 text-brand-700; }
.chip-inactive { @apply border-slate-200 text-slate-600 hover:border-slate-300; }
.back-btn { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.next-btn { @apply bg-brand-700 hover:bg-brand-800 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/cold/ColdStep4InternalLoads.vue
git commit -m "feat: add cold room wizard step 4 - internal loads"
```

---

## Task 14: Cold Results

**Files:**
- Create: `src/modules/hvac/components/cold/ColdResults.vue`

- [ ] **Create `src/modules/hvac/components/cold/ColdResults.vue`**

```vue
<template>
  <div>
    <h2 class="text-xl font-bold text-slate-900 mb-1">Resultado — Cuarto Frío</h2>
    <p class="text-sm text-slate-500 mb-6">Carga térmica total con factor de seguridad del 15%</p>

    <!-- Primary result -->
    <div class="bg-blue-700 rounded-2xl p-6 mb-6 text-white">
      <p class="text-sm font-medium opacity-80 mb-1">Carga térmica total</p>
      <p class="text-5xl font-extrabold mb-1">{{ fmt(result.btuH) }} <span class="text-2xl font-semibold opacity-80">BTU/h</span></p>
      <div class="flex gap-6 mt-3 text-sm opacity-80">
        <span><strong class="text-white font-bold">{{ result.kw.toFixed(2) }}</strong> kW</span>
        <span><strong class="text-white font-bold">{{ result.tons.toFixed(2) }}</strong> TR</span>
      </div>
    </div>

    <!-- Breakdown -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <div class="px-5 py-3 border-b border-slate-100">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Desglose de cargas</p>
      </div>
      <div class="divide-y divide-slate-50">
        <div v-for="row in rows" :key="row.label" class="flex items-center gap-3 px-5 py-3">
          <span class="text-sm text-slate-600 w-36 flex-shrink-0">{{ row.label }}</span>
          <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-blue-400 rounded-full" :style="`width:${pct(row.value)}%`" />
          </div>
          <span class="text-sm font-semibold text-slate-700 w-28 text-right">{{ fmt(row.value) }} W</span>
          <span class="text-xs text-slate-400 w-10 text-right">{{ pct(row.value).toFixed(0) }}%</span>
        </div>
        <div class="flex items-center gap-3 px-5 py-3 bg-slate-50">
          <span class="text-sm text-slate-500 flex-1">Factor de seguridad (15%)</span>
          <span class="text-sm font-semibold text-slate-700">+ {{ fmt(result.qTotal - result.qSubtotal) }} W</span>
        </div>
      </div>
    </div>

    <!-- Coming soon -->
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center mb-6">
      <Lock class="h-6 w-6 text-slate-300 mx-auto mb-2" />
      <p class="text-sm font-semibold text-slate-400">Sugerencia de equipos</p>
      <p class="text-xs text-slate-300 mt-1">Próximamente</p>
    </div>

    <div class="flex justify-between">
      <button @click="$emit('back')" class="back-btn">← Atrás</button>
      <button @click="$emit('reset')" class="reset-btn">Calcular de nuevo</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Lock } from '@lucide/vue'
import type { ColdResult } from '../../utils/cold-calculator'

const props = defineProps<{ result: ColdResult }>()
defineEmits<{ back: []; reset: [] }>()

const fmt = (n: number) => Math.round(n).toLocaleString('es-CO')
const pct = (v: number) => props.result.qSubtotal > 0 ? (v / props.result.qSubtotal) * 100 : 0

const rows = computed(() => [
  { label: 'Transmisión',   value: props.result.qTransmission },
  { label: 'Producto',      value: props.result.qProduct      },
  { label: 'Infiltración',  value: props.result.qInfiltration },
  { label: 'Cargas internas', value: props.result.qInternal   },
].filter(r => r.value > 0))
</script>

<style scoped>
@reference "../../../../style.css";
.back-btn  { @apply text-slate-600 hover:text-slate-800 font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors; }
.reset-btn { @apply bg-slate-900 hover:bg-slate-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors; }
</style>
```

- [ ] **Commit**

```bash
git add src/modules/hvac/components/cold/ColdResults.vue
git commit -m "feat: add cold room results component with load breakdown"
```

---

## Task 15: HvacCalculatorView — orchestrator

**Files:**
- Modify: `src/modules/hvac/views/HvacCalculatorView.vue`

- [ ] **Replace the placeholder with the full orchestrator**

```vue
<template>
  <div class="max-w-2xl mx-auto px-4 py-8">
    <!-- Mode selector -->
    <ModeSelector v-if="!mode" @select="selectMode" />

    <!-- AC Wizard -->
    <template v-else-if="mode === 'ac'">
      <div class="mb-6">
        <button @click="reset" class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft class="h-4 w-4" /> Cambiar modo
        </button>
      </div>
      <WizardProgress :steps="AC_STEPS" :current="acStep" @go="acStep = $event" class="mb-6" />
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <AcStep1Dimensions  v-if="acStep === 0" :form="acForm" @next="acStep++" />
        <AcStep2Conditions  v-else-if="acStep === 1" :form="acForm" @next="acStep++" @back="acStep--" />
        <AcStep3InternalLoads v-else-if="acStep === 2" :form="acForm" @next="computeAc" @back="acStep--" />
        <AcResults v-else-if="acStep === 3 && acResult" :result="acResult" @back="acStep--" @reset="reset" />
      </div>
    </template>

    <!-- Cold Wizard -->
    <template v-else-if="mode === 'cold'">
      <div class="mb-6">
        <button @click="reset" class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft class="h-4 w-4" /> Cambiar modo
        </button>
      </div>
      <WizardProgress :steps="COLD_STEPS" :current="coldStep" @go="coldStep = $event" class="mb-6" />
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <ColdStep1Type        v-if="coldStep === 0" :form="coldForm" @next="coldStep++" />
        <ColdStep2Dimensions  v-else-if="coldStep === 1" :form="coldForm" @next="coldStep++" @back="coldStep--" />
        <ColdStep3Product     v-else-if="coldStep === 2" :form="coldForm" @next="coldStep++" @back="coldStep--" />
        <ColdStep4InternalLoads v-else-if="coldStep === 3" :form="coldForm" @next="computeCold" @back="coldStep--" />
        <ColdResults v-else-if="coldStep === 4 && coldResult" :result="coldResult" @back="coldStep--" @reset="reset" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ArrowLeft } from '@lucide/vue'

import ModeSelector    from '../components/ModeSelector.vue'
import WizardProgress  from '../components/WizardProgress.vue'
import AcStep1Dimensions   from '../components/ac/AcStep1Dimensions.vue'
import AcStep2Conditions   from '../components/ac/AcStep2Conditions.vue'
import AcStep3InternalLoads from '../components/ac/AcStep3InternalLoads.vue'
import AcResults           from '../components/ac/AcResults.vue'
import ColdStep1Type         from '../components/cold/ColdStep1Type.vue'
import ColdStep2Dimensions   from '../components/cold/ColdStep2Dimensions.vue'
import ColdStep3Product      from '../components/cold/ColdStep3Product.vue'
import ColdStep4InternalLoads from '../components/cold/ColdStep4InternalLoads.vue'
import ColdResults           from '../components/cold/ColdResults.vue'

import { calculateAcLoad, defaultAcInputs, type AcResult } from '../utils/ac-calculator'
import { calculateColdLoad, defaultColdInputs, type ColdResult } from '../utils/cold-calculator'

const AC_STEPS   = ['Dimensiones', 'Condiciones', 'Cargas internas', 'Resultado']
const COLD_STEPS = ['Tipo', 'Dimensiones', 'Producto', 'Cargas internas', 'Resultado']

const mode     = ref<'ac' | 'cold' | null>(null)
const acStep   = ref(0)
const coldStep = ref(0)
const acForm   = reactive(defaultAcInputs())
const coldForm = reactive(defaultColdInputs())
const acResult   = ref<AcResult | null>(null)
const coldResult = ref<ColdResult | null>(null)

function selectMode(m: 'ac' | 'cold') { mode.value = m }

function computeAc() {
  acResult.value = calculateAcLoad({ ...acForm })
  acStep.value++
}

function computeCold() {
  coldResult.value = calculateColdLoad({ ...coldForm })
  coldStep.value++
}

function reset() {
  mode.value = null
  acStep.value = 0
  coldStep.value = 0
  acResult.value = null
  coldResult.value = null
  Object.assign(acForm, defaultAcInputs())
  Object.assign(coldForm, defaultColdInputs())
}
</script>
```

- [ ] **Run TypeScript check**

```bash
npx vue-tsc --noEmit
```
Expected: no errors.

- [ ] **Run all tests**

```bash
npx vitest run
```
Expected: 15 tests pass.

- [ ] **Start dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:5173/hvac-calculator`. Verify:
1. Mode selector shows two cards with Lucide icons (no emojis)
2. Selecting AC opens 4-step wizard with progress bar
3. Selecting Cold Room opens 5-step wizard
4. Back/Next navigation works correctly
5. Results show BTU/h, kW, TR, and component breakdown bars
6. "Calcular de nuevo" returns to mode selector
7. "Cambiar modo" button returns to mode selector

- [ ] **Final commit**

```bash
git add src/modules/hvac/
git commit -m "feat: implement thermal load calculator wizard (AC + cold room)"
```
