# Metodología de cálculo — Calculadora de Carga Térmica

## Aire Acondicionado

Basado en el método simplificado ASHRAE, adaptado para climas tropicales y subtropicales.

### Variables de entrada

| Variable | Descripción | Unidad |
|---|---|---|
| L, W, H | Largo, ancho, alto del espacio | m |
| A_ven | Área total de ventanas | m² |
| T_ext | Temperatura exterior de diseño | °C |
| T_int | Temperatura interior deseada | °C |
| U_pared | Coeficiente de transmisión de pared | W/m²K |
| U_techo | Coeficiente de transmisión de techo | W/m²K |
| U_vidrio | Coeficiente de transmisión de vidrio | W/m²K |
| N_pers | Número de personas | personas |
| W_ilum | Carga de iluminación | W/m² |
| W_equip | Carga de equipos eléctricos | W |

### Valores U (W/m²K)

**Paredes:**
| Tipo | U |
|---|---|
| Sin aislamiento (ladrillo) | 2.5 |
| Básico (bloque + repello) | 1.0 |
| Bueno (con aislante) | 0.5 |

**Techo:**
| Tipo | U |
|---|---|
| Losa expuesta | 3.5 |
| Cielo raso (cámara de aire) | 1.5 |
| Aislado | 0.5 |

**Ventanas:**
| Tipo | U |
|---|---|
| Vidrio simple | 5.8 |
| Vidrio doble | 2.8 |
| Película solar | 3.5 |

### Factores de ganancia solar

**Orientación:**
| Orientación | Factor |
|---|---|
| Sur | 1.0 |
| Este / Oeste | 0.7 |
| Norte | 0.3 |

**Exposición solar:**
| Exposición | Factor |
|---|---|
| Alta (sin sombra) | 1.3 |
| Media | 1.0 |
| Baja (parcialmente sombreado) | 0.7 |
| Sombra total | 0.4 |

### Fórmulas de cálculo

```
ΔT = T_ext − T_int

A_paredes = max(0,  2×(L+W)×H − A_ven)   ← se clampea a 0 si A_ven > área opaca
A_techo   = L × W

Q_paredes       = U_pared × A_paredes × ΔT
Q_techo         = U_techo × A_techo × ΔT × factor_exposición
Q_ventanas      = U_vidrio × A_ven × ΔT
Q_solar         = A_ven × 200 × factor_orientación × factor_exposición
                  (200 W/m² = irradiancia solar base a través de vidrio)
Q_infiltración  = 0.33 × 0.5 × (L×W×H) × ΔT
                  (0.33 = ρCp del aire en W·h/m³K; 0.5 = 0.5 renovaciones/hora)
Q_personas      = N_pers × 115 W
                  (115 W = calor sensible por persona en actividad sedentaria)
Q_iluminación   = W_ilum × (L×W)
Q_equipos       = {0 | 200 | 500} W

Q_subtotal = max(0,  Q_paredes + Q_techo + Q_ventanas + Q_solar
                   + Q_infiltración + Q_personas + Q_iluminación + Q_equipos)

Q_total = Q_subtotal × 1.10    ← factor de seguridad del 10%
```

> **Nota:** Si ΔT ≤ 0 (clima frío donde T_ext < T_int), Q_subtotal se clampea a 0 —
> no se requiere enfriamiento activo.

### Conversiones de salida

```
BTU/h = Q_total × 3.41214
kW    = Q_total / 1000
TR    = Q_total / 3517          (1 TR = 3517 W = 12,000 BTU/h)
```

---

## Cuarto Frío

Basado en el método estándar de cálculo de carga de refrigeración industrial.

### Variables de entrada

| Variable | Descripción | Unidad |
|---|---|---|
| L, W, H | Dimensiones interiores del cuarto | m |
| e | Espesor del panel aislante | mm |
| T_ext | Temperatura del ambiente exterior | °C |
| T_int | Temperatura interior de diseño | °C |
| m_prod | Masa del producto a enfriar | kg |
| Cp | Calor específico del producto | kJ/kg·K |
| T_entrada | Temperatura de entrada del producto | °C |
| t_pulldown | Tiempo de enfriamiento inicial | h |
| N_pers | Personas que acceden al cuarto | personas |
| ACH_día | Cambios de aire por día (según puerta) | 1/día |

### Valores U — Poliuretano (W/m²K)

| Espesor | U_poly |
|---|---|
| 50 mm | 0.45 |
| 75 mm | 0.30 |
| 100 mm | 0.22 |
| 150 mm | 0.15 |
| 200 mm | 0.11 |

> **EPS:** `U_eps = U_poly × 1.20` (poliestireno expandido es 20% menos eficiente)

### Calor específico por producto (kJ/kg·K)

| Producto | Cp (sobre 0°C) | Cp (bajo 0°C) |
|---|---|---|
| Frutas / Verduras | 3.8 | 2.0 |
| Carnes | 3.2 | 2.0 |
| Lácteos | 3.9 | 2.0 |
| Congelados | 2.0 | 2.0 |
| Flores | 3.8 | 2.0 |
| Otro | 3.5 | 2.0 |

> El Cp usado depende de si T_int < 0°C (congelación) o T_int ≥ 0°C (conservación).

### Cambios de aire por frecuencia de puerta

| Frecuencia | ACH/día |
|---|---|
| Baja (~2 aperturas) | 2 |
| Media (~6 aperturas) | 6 |
| Alta (~12 aperturas) | 12 |

### Fórmulas de cálculo

```
ΔT = T_ext − T_int

// 1. Carga de transmisión (las 6 superficies del cuarto)
A_total = 2×(L×W) + 2×(L×H) + 2×(W×H)
U       = U_poly[e] × (1.20 si EPS, else 1.0)
Q_transmisión = U × A_total × ΔT

// 2. Carga de producto (pull-down)
ΔT_prod  = T_entrada − T_int
Q_producto = (m_prod × Cp × 1000 × ΔT_prod) / (t_pulldown × 3600)
             ← solo si m_prod > 0 y t_pulldown > 0, en caso contrario = 0
             ← resultado en W (divide J por segundos)

// 3. Infiltración por apertura de puerta
ACH_h = ACH_día / 24
Q_infiltración = 0.33 × ACH_h × (L×W×H) × ΔT

// 4. Cargas internas
Q_interno = N_pers × 270 + 6 × (L×W)
            (270 W/persona en frío; 6 W/m² por iluminación y motores estándar)

// Total
Q_subtotal = Q_transmisión + Q_producto + Q_infiltración + Q_interno
Q_total    = Q_subtotal × 1.15    ← factor de seguridad del 15%
```

### Conversiones de salida

```
BTU/h = Q_total × 3.41214
kW    = Q_total / 1000
TR    = Q_total / 3517
```

---

## Comparación de factores de seguridad

| Aplicación | Factor | Justificación |
|---|---|---|
| Aire acondicionado | 10% | Cargas variables, el sistema puede trabajar más horas si hace falta |
| Cuarto frío | 15% | Pérdidas por aperturas imprevistas, degradación del aislante, variación en la masa del producto |

---

## Limitaciones del modelo

- **No considera humedad** (carga latente): el modelo calcula solo carga sensible. En climas muy húmedos (costa), la carga real puede ser 20–30% mayor.
- **Geometría simple**: asume rectángulo perfecto, sin puentes térmicos en esquinas ni uniones.
- **ACH fijo**: la tasa de infiltración usa 0.5 ACH para AC y un valor por frecuencia de puerta para cuartos fríos — no modela fugas continuas por sellos deteriorados.
- **Pull-down lineal**: asume enfriamiento uniforme del producto durante `t_pulldown` horas, sin considerar la curva real de enfriamiento.
- **Sin ganancia de desescarche**: los cuartos de congelación incluyen ciclos de desescarche que añaden carga; no modelados aquí.
