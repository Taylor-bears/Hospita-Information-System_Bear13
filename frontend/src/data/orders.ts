import api from '../lib/api'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from './queryKeys'

export type OrderItem = {
  drug?: { name?: string; specification?: string; manufacturer?: string }
  unit_price: number
  quantity: number
}

export type Order = {
  id: string | number
  order_number: string
  order_items: OrderItem[]
  total_amount: number
  delivery_type: string
  status: string
  payment_status: string
  created_at: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  notes?: string
  tracking_number?: string
  shipping_company?: string
  shipped_at?: string
  delivered_at?: string
}

export async function fetchMyOrders(patientId?: string | number): Promise<Order[]> {
  if (!patientId) return []
  const res = await api.get('/api/orders/my', { params: { patient_id: patientId } })
  return Array.isArray(res.data) ? res.data : []
}

export function useMyOrders(patientId?: string | number) {
  return useQuery({
    queryKey: QUERY_KEYS.orders(patientId),
    queryFn: () => fetchMyOrders(patientId),
    enabled: !!patientId,
    staleTime: 1000 * 30,
  })
}

