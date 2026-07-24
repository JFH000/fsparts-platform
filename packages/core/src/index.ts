export { createSupabaseClient } from './supabase'
export type { SupabaseConfig } from './supabase'
export { supabase, isSupabaseConfigured } from './client'
export { useAuthStore } from './auth.store'
export { formatCurrency, formatNumber } from './currency'
export { shouldUseCookies, createSessionStorage } from './cookieStorage'
export type { CookieStorage } from './cookieStorage'
export type {
  ProductLine, Brand, Category, ProductSpec, Product, CartItem,
  UserRole, UserProfile, FilterState, SortOption, OrderStatus,
  OrderItemSnapshot, Order, ShippingAddress,
} from './types'
export { fetchProducts, fetchProductLines, fetchBrands, fetchCategories } from './catalog'
export { PRODUCTS, PRODUCT_LINES, BRANDS, CATEGORIES, REFRIGERANTS, MAX_PRICE } from './mockCatalog'
