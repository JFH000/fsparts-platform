export type AppId = 'shop' | 'calculator' | 'dashboard'

export interface AppEntry {
  id: AppId
  name: string
  description: string
  url: string
  requiresAdmin: boolean
}

export const APPS: AppEntry[] = [
  {
    id: 'shop',
    name: 'fsparts Shop',
    description: 'Catálogo y pedidos de repuestos HVAC/R',
    url: import.meta.env.VITE_APP_URL_SHOP ?? 'https://shop.fsparts.org',
    requiresAdmin: false,
  },
  {
    id: 'calculator',
    name: 'fsparts Calculadora',
    description: 'Calculadora de carga térmica',
    url: import.meta.env.VITE_APP_URL_CALCULATOR ?? 'https://calculator.fsparts.org',
    requiresAdmin: false,
  },
  {
    id: 'dashboard',
    name: 'fsparts Dashboard',
    description: 'Panel administrativo',
    url: import.meta.env.VITE_APP_URL_DASHBOARD ?? 'https://dashboard.fsparts.org',
    requiresAdmin: true,
  },
]
