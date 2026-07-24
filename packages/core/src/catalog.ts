import { supabase } from './client'
import type { Product, ProductLine, Brand, Category } from './types'
import { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES } from './mockCatalog'

// ── DB row shapes ─────────────────────────────────────────────────────────────

type DbProductLine = {
  id: number
  code: string
  name: string
  description: string
  icon: string
  slug: string
  product_count: number
}

type DbBrand = {
  id: number
  name: string
  slug: string
  logo_url: string | null
  country: string | null
}

type DbCategory = {
  id: number
  name: string
  slug: string
  product_line_id: number | null
  description: string | null
}

type DbSpec = { key?: string; label?: string; value: string; unit?: string; group?: string }

type DbProduct = {
  id: string
  sku: string
  name: string
  slug: string
  description: string
  price_usd: number | null
  price_cop: number | null
  price_ws1: number | null
  price_ws2: number | null
  price_ws3: number | null
  price_ws4: number | null
  stock: number
  is_featured: boolean
  is_new: boolean
  images: string[]
  specs: DbSpec[]
  refrigerants: string[]
  brand: DbBrand | null
  category: DbCategory | null
  product_line: DbProductLine | null
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toProductLine(r: DbProductLine): ProductLine {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    icon: r.icon,
    slug: r.slug,
    productCount: r.product_count,
  }
}

function toBrand(r: DbBrand): Brand {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url ?? undefined,
    country: r.country ?? undefined,
  }
}

function toCategory(r: DbCategory): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    productLineId: r.product_line_id ?? 0,
  }
}

const FALLBACK_BRAND: Brand         = { id: 0, name: 'Sin Marca',     slug: 'sin-marca'     }
const FALLBACK_CATEGORY: Category   = { id: 0, name: 'Sin Categoría', slug: 'sin-categoria', productLineId: 0 }
const FALLBACK_LINE: ProductLine    = { id: 0, code: '---', name: 'Sin Línea', description: '', icon: 'Wrench', slug: 'sin-linea' }

function toProduct(r: DbProduct): Product {
  return {
    id:          r.id,
    sku:         r.sku,
    name:        r.name,
    slug:        r.slug,
    description: r.description,
    brand:       r.brand        ? toBrand(r.brand)               : FALLBACK_BRAND,
    category:    r.category     ? toCategory(r.category)         : FALLBACK_CATEGORY,
    productLine: r.product_line ? toProductLine(r.product_line)  : FALLBACK_LINE,
    priceUsd:    r.price_usd  ?? undefined,
    priceCop:    r.price_cop  ?? undefined,
    priceWs1:    r.price_ws1  ?? undefined,
    priceWs2:    r.price_ws2  ?? undefined,
    priceWs3:    r.price_ws3  ?? undefined,
    priceWs4:    r.price_ws4  ?? undefined,
    stock:       r.stock,
    isFeatured:  r.is_featured,
    isNew:       r.is_new,
    images:      r.images,
    specs:       r.specs.map(s => ({ key: s.key ?? s.label ?? '', value: s.value, unit: s.unit, group: s.group })),
    refrigerants: r.refrigerants,
  }
}

// ── Fetchers (fall back to mock when Supabase is unconfigured or tables empty) ─

export async function fetchProductLines(): Promise<ProductLine[]> {
  if (!supabase) return PRODUCT_LINES
  const { data, error } = await supabase.from('product_lines').select('*').order('id')
  if (error || !data?.length) return PRODUCT_LINES
  return (data as DbProductLine[]).map(toProductLine)
}

export async function fetchBrands(): Promise<Brand[]> {
  if (!supabase) return BRANDS
  const { data, error } = await supabase.from('brands').select('*').order('name')
  if (error || !data?.length) return BRANDS
  return (data as DbBrand[]).map(toBrand)
}

export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) return CATEGORIES
  const { data, error } = await supabase.from('categories').select('*').order('id')
  if (error || !data?.length) return CATEGORIES
  return (data as DbCategory[]).map(toCategory)
}

export async function fetchProducts(): Promise<Product[]> {
  if (!supabase) return PRODUCTS
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:categories(*),
      product_line:product_lines(*)
    `)
    .order('name')
  if (error || !data?.length) return PRODUCTS
  return (data as DbProduct[]).map(toProduct)
}
