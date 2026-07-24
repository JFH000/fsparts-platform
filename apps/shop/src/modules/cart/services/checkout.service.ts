import { supabase } from '@fsparts/core'
import type { CartItem } from '@fsparts/core'

export type ShippingInfo = {
  name: string
  phone: string
  company?: string
  taxId?: string
  address: string
  city: string
  notes?: string
}

export async function createCheckoutSession(
  items: CartItem[],
  shipping: ShippingInfo,
): Promise<{ url: string; dropped: string[] }> {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      shipping,
    },
  })
  if (error) throw new Error(error.message)
  if (!data?.url) throw new Error(data?.error ?? 'No se pudo iniciar el pago')
  return { url: data.url, dropped: data.dropped ?? [] }
}
