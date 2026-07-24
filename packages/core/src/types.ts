export interface ProductLine {
  id: number
  code: string
  name: string
  description: string
  icon: string
  slug: string
  productCount?: number
}

export interface Brand {
  id: number
  name: string
  slug: string
  logoUrl?: string
  country?: string
}

export interface Category {
  id: number
  name: string
  slug: string
  productLineId: number
  description?: string
}

export interface ProductSpec {
  key: string
  value: string
  unit?: string
  group?: string
}

export interface Product {
  id: string
  sku: string
  name: string
  slug: string
  description: string
  brand: Brand
  category: Category
  productLine: ProductLine
  priceUsd?: number
  priceCop?: number
  priceWs1?: number
  priceWs2?: number
  priceWs3?: number
  priceWs4?: number
  stock: number
  isFeatured: boolean
  isNew?: boolean
  images: string[]
  specs: ProductSpec[]
  refrigerants: string[]
}

export interface CartItem {
  product: Product
  quantity: number
}

export type UserRole = 'admin' | 'customer' | 'customer_ws1' | 'customer_ws3'

export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  role: UserRole
  company: string | null
  notes: string | null
}

export interface FilterState {
  search: string
  productLineIds: number[]
  brandIds: number[]
  categoryIds: number[]
  refrigerants: string[]
  priceRange: [number, number]
  inStockOnly: boolean
}

export type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest'

export type OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'

export interface OrderItemSnapshot {
  product_id: string
  sku: string
  name: string
  image: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface Order {
  id: string
  user_id: string
  status: OrderStatus
  items: OrderItemSnapshot[]
  subtotal: number
  currency: string
  shipping_name: string
  shipping_phone: string
  shipping_company: string | null
  shipping_tax_id: string | null
  shipping_address: string
  shipping_city: string
  shipping_notes: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  paid_at: string | null
}

export interface ShippingAddress {
  id: string
  user_id: string
  label: string | null
  full_name: string
  phone: string
  company: string | null
  tax_id: string | null
  address: string
  city: string
  notes: string | null
  is_default: boolean
  created_at: string
}
