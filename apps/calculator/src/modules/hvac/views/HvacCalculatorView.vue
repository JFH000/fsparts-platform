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
