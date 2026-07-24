import { supabase } from '@fsparts/core'
import type { Order } from '@fsparts/core'

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function fetchOrderBySessionId(sessionId: string): Promise<Order | null> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Order | null
}

export async function listMyOrders(): Promise<Order[]> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Order | null
}
