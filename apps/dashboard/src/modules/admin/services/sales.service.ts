import { supabase } from '@fsparts/core'
import type { Order, OrderStatus } from '@fsparts/core'

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function listAllOrders(): Promise<Order[]> {
  const { data, error } = await getSb()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await getSb().from('orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}
