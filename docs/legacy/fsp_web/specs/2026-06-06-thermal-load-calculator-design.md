# Thermal Load Calculator — Design Spec
**Date:** 2026-06-06
**Route:** `/hvac-calculator` (existing, replaces placeholder)
**Scope:** Frontend-only, no backend required

---

## 1. Overview

A step-by-step wizard calculator for thermal load estimation. Two modes:
- **Aire Acondicionado** — comfort cooling for rooms and spaces
- **Cuarto Frío** — industrial refrigeration (conservation or freezing)

Target users: both HVAC technicians and non-technical end consumers. Inputs use plain language with sensible defaults; results show W, BTU/h, and tons of refrigeration.

Product suggestions are out of scope for this version (visible placeholder only).

---

## 2. Flow

```
/hvac-calculator
└── ModeSelector
      ├── [Aire Acondicionado] → AC wizard (4 steps)
      └── [Cuarto Frío]       → Cold Room wizard (5 steps)
```

### AC Wizard steps
1. Dimensiones del espacio
2. Materiales y condiciones
3. Cargas internas
4. Resultado

### Cold Room Wizard steps
1. Tipo de aplicación (conservación / congelación)
2. Dimensiones y aislamiento
3. Producto almacenado
4. Cargas internas
5. Resultado

---

## 3. File Structure

```
src/modules/hvac/
  views/
    HvacCalculatorView.vue        ← orchestrator, replaces placeholder
  components/
    ModeSelector.vue              ← two-card mode picker
    WizardProgress.vue            ← numbered step indicator
    ac/
      AcStep1Dimensions.vue
      AcStep2Conditions.vue
      AcStep3InternalLoads.vue
      AcResults.vue
    cold/
      ColdStep1Type.vue
      ColdStep2Dimensions.vue
      ColdStep3Product.vue
      ColdStep4InternalLoads.vue
      ColdResults.vue
  utils/
    ac-calculator.ts              ← pure calculation functions
    cold-calculator.ts
```

State lives in `HvacCalculatorView.vue` as local `reactive()` — no Pinia needed.
Calculation utils are pure functions (inputs → outputs, no side effects).

---

## 4. UI Design

### Mode Selector
Two large cards side by side (stacked on mobile). Each card has:
- Lucide icon (AC: `AirVent`, Cold: `Snowflake`)
- Title and short description
- No emojis

### Wizard Progress Bar
Fixed above the form card. Numbered steps; active step highlighted. Clicking a previous step navigates back.

### Step Cards
- `max-w-2xl`, centered, white card
- Labels in plain Spanish with units visible inline (m, °C, kg)
- Selectable options (insulation type, solar exposure, etc.) rendered as visual chip/card buttons — not dropdowns
- Numeric inputs with unit suffix
- Back / Next navigation; Next validates required fields before advancing

### Results Screen
- Large primary number: total load in BTU/h
- Secondary: kW and tons of refrigeration
- Horizontal breakdown bars per component (transmission, product, infiltration, internal) with W value and % of total
- Safety factor called out explicitly
- "Calcular de nuevo" button → returns to ModeSelector
- "Sugerencia de equipos" block with lock icon and "Próximamente" label

---

## 5. AC Calculation Methodology

Based on simplified ASHRAE method adapted for tropical/subtropical climates.

### Inputs
| Field | Options / Range | Default |
|---|---|---|
| Largo, Ancho, Alto | m | — |
| Área de ventanas | m² | — |
| Orientación principal | Norte / Sur / Este / Oeste | Sur |
| T exterior diseño | °C, editable | 32°C |
| T interior deseada | °C, editable | 24°C |
| Paredes | Sin aislamiento / Básico / Bueno | Básico |
| Techo | Expuesto / Cielo raso / Aislado | Cielo raso |
| Ventanas | Vidrio simple / Doble / Película solar | Simple |
| Exposición solar | Alta / Media / Baja / Sombra | Media |
| Personas | integer | 2 |
| Iluminación | Baja 5W/m² / Media 10W/m² / Alta 15W/m² | Media |
| Equipos | Ninguno / Pocos / Varios | Pocos |

### U-values (W/m²K)
| Element | No insulation | Basic | Good |
|---|---|---|---|
| Walls | 2.5 | 1.0 | 0.5 |
| Roof exposed | 3.5 | — | — |
| Roof w/ false ceiling | — | 1.5 | — |
| Roof insulated | — | — | 0.5 |
| Glass single | 5.8 | — | — |
| Glass double | — | 2.8 | — |
| Glass solar film | — | — | 3.5 |

### Solar gain multipliers by orientation
| Orientation | Factor |
|---|---|
| Sur | 1.0 |
| Este / Oeste | 0.7 |
| Norte | 0.3 |

### Exposure modifiers (applied to roof solar factor)
Alta = 1.3 · Media = 1.0 · Baja = 0.7 · Sombra = 0.4

### Equipment load (W)
Ninguno = 0 · Pocos = 200 · Varios = 500

### Formulas
```
ΔT = T_exterior - T_interior

A_paredes = 2 × (largo + ancho) × alto - A_ventanas
A_techo   = largo × ancho

Q_paredes      = U_pared × A_paredes × ΔT
Q_techo        = U_techo × A_techo × ΔT × exposure_factor
Q_ventanas     = U_vidrio × A_ventanas × ΔT
Q_solar        = A_ventanas × 200 × solar_orientation_factor × exposure_factor
                 (200 W/m² is the baseline solar irradiance through glass)
Q_infiltración = 0.33 × 0.5 × Volumen × ΔT   (ACH=0.5 for average room)
Q_personas     = N × 115                        (W sensible per person)
Q_iluminación  = W_per_m2 × (largo × ancho)
Q_equipos      = {0 | 200 | 500}

Q_subtotal = Q_paredes + Q_techo + Q_ventanas + Q_solar
           + Q_infiltración + Q_personas + Q_iluminación + Q_equipos

Q_total = Q_subtotal × 1.10   (10% safety factor)
```

### Output conversions
```
BTU/h = Q_total_W × 3.41214
Tons  = Q_total_W / 3517
```

---

## 6. Cold Room Calculation Methodology

Based on standard industrial refrigeration load calculation method.

### Inputs
| Field | Options / Range | Default |
|---|---|---|
| Tipo | Conservación / Congelación | Conservación |
| T interior | 0–8°C (conservación) / -18 to -25°C (congelación) | 4°C / -18°C |
| Largo, Ancho, Alto | m | — |
| Espesor aislamiento | 50 / 75 / 100 / 150 / 200 mm | 100mm |
| Material | Poliuretano / EPS | Poliuretano |
| T exterior diseño | °C, editable | 32°C |
| Tipo de producto | Frutas/Verduras / Carnes / Lácteos / Congelados / Flores / Otro | — |
| Masa del producto | kg | — |
| T entrada del producto | °C | 20°C |
| Horas de pull-down | h | 12h |
| Personas | integer | 1 |
| Apertura de puerta | Baja / Media / Alta | Media |

### U-values — Polyurethane (W/m²K)
| Thickness | U |
|---|---|
| 50mm | 0.45 |
| 75mm | 0.30 |
| 100mm | 0.22 |
| 150mm | 0.15 |
| 200mm | 0.11 |

EPS: multiply polyurethane U by 1.20 (20% worse).

### Specific heat Cp (kJ/kgK)
| Product | Cp above freezing | Cp below freezing |
|---|---|---|
| Frutas / Verduras | 3.8 | 2.0 |
| Carnes | 3.2 | 2.0 |
| Lácteos | 3.9 | 2.0 |
| Congelados | — | 2.0 |
| Flores | 3.8 | — |
| Otro | 3.5 | 2.0 |

### Air changes per day by door frequency
Baja = 2 · Media = 6 · Alta = 12

### Formulas
```
ΔT = T_exterior - T_interior

// Transmission (all 6 surfaces)
A_total = 2×(largo×ancho) + 2×(largo×alto) + 2×(ancho×alto)
Q_transmisión = U × A_total × ΔT                              (W)

// Product pull-down
ΔT_product = T_entrada_producto - T_interior
Q_producto = (masa × Cp × 1000 × ΔT_product) / (horas_pulldown × 3600)  (W)

// Infiltration
ACH_h = cambios_aire_día / 24
Q_infiltración = 0.33 × ACH_h × Volumen × ΔT                 (W)

// Internal
Q_interno = personas × 270 + 6 × (largo × ancho)             (W)

// Total
Q_subtotal = Q_transmisión + Q_producto + Q_infiltración + Q_interno
Q_total    = Q_subtotal × 1.15                                 (15% safety factor)
```

---

## 7. Results Display

Both modes show:
- **Primary:** `X,XXX BTU/h`
- **Secondary:** `X.X kW · X.X TR`
- **Component breakdown table:**
  - Each row: label, W value, % of subtotal, proportional bar
  - Components: Transmisión, Producto (cold only), Infiltración, Cargas internas
  - Footer row: Factor de seguridad (10% or 15%)
- **"Calcular de nuevo"** — resets to ModeSelector
- **"Sugerencia de equipos"** — greyed card with lock icon, "Próximamente"

---

## 8. Out of Scope (this version)

- Product/equipment recommendations from catalog
- Saving or exporting results
- Multi-zone calculations
- Backend persistence
- User accounts or history
