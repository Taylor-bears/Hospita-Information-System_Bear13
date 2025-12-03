import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svpexhafkyuuaiqsxvja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cGV4aGFma3l1dWFpcXN4dmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDYwMjAsImV4cCI6MjA4MDE4MjAyMH0.-GzKMw3Vo5ceyu6L3EVCxFyN9JWJ2p316ql3Iq1AiKg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 用户认证相关函数
export const authAPI = {
  async signIn(phone: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: phone, // 使用手机号作为邮箱登录
      password,
    })
    return { data, error }
  },

  async signUp(phone: string, password: string, name: string, role: string) {
    const { data, error } = await supabase.auth.signUp({
      email: phone,
      password,
      options: {
        data: {
          name,
          role,
          phone,
        }
      }
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
}

// 药品管理相关函数
export const drugAPI = {
  async getDrugs(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    category?: string
    lowStock?: boolean
  }) {
    let query = supabase
      .from('drugs')
      .select('*', { count: 'exact' })

    if (params?.keyword) {
      query = query.or(`name.ilike.%${params.keyword}%,generic_name.ilike.%${params.keyword}%`)
    }
    if (params?.category) {
      query = query.eq('category', params.category)
    }
    if (params?.lowStock) {
      query = query.lte('quantity', 'min_stock')
    }

    const { data, error, count } = await query
      .range(
        (params?.page || 1 - 1) * (params?.pageSize || 20),
        (params?.page || 1) * (params?.pageSize || 20) - 1
      )

    return { data, error, count }
  },

  async getDrugById(id: string) {
    const { data, error } = await supabase
      .from('drugs')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async createDrug(drug: any) {
    const { data, error } = await supabase
      .from('drugs')
      .insert([drug])
      .select()
      .single()
    return { data, error }
  },

  async updateDrug(id: string, drug: any) {
    const { data, error } = await supabase
      .from('drugs')
      .update(drug)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

// 库存管理相关函数
export const inventoryAPI = {
  async getInventory(params?: {
    page?: number
    pageSize?: number
    drugId?: string
    lowStock?: boolean
  }) {
    let query = supabase
      .from('inventory')
      .select(`
        *,
        drugs!inner(*)
      `, { count: 'exact' })

    if (params?.drugId) {
      query = query.eq('drug_id', params.drugId)
    }
    if (params?.lowStock) {
      query = query.lte('quantity', 'min_stock')
    }

    const { data, error, count } = await query
      .range(
        (params?.page || 1 - 1) * (params?.pageSize || 20),
        (params?.page || 1) * (params?.pageSize || 20) - 1
      )

    return { data, error, count }
  },

  async updateStock(inventoryId: string, quantity: number, movementType: string, referenceId?: string) {
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('id', inventoryId)
      .single()

    if (inventoryError) return { data: null, error: inventoryError }

    const newQuantity = movementType === 'inbound' 
      ? inventory.quantity + quantity 
      : inventory.quantity - quantity

    // 更新库存
    const { data: updatedInventory, error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: newQuantity, updated_at: new Date() })
      .eq('id', inventoryId)
      .select()
      .single()

    if (updateError) return { data: null, error: updateError }

    // 记录库存变动
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert([{
        inventory_id: inventoryId,
        movement_type: movementType,
        quantity,
        balance: newQuantity,
        reference_id: referenceId,
        user_id: (await supabase.auth.getUser()).data.user?.id
      }])

    return { data: updatedInventory, error: movementError }
  }
}

// 处方管理相关函数
export const prescriptionAPI = {
  async getPrescriptions(params?: {
    page?: number
    pageSize?: number
    status?: string
    patientId?: string
    doctorId?: string
  }) {
    let query = supabase
      .from('prescriptions')
      .select(`
        *,
        patient:users!prescriptions_patient_id_fkey(*),
        doctor:users!prescriptions_doctor_id_fkey(*),
        prescription_items(*, drug:drugs(*))
      `, { count: 'exact' })

    if (params?.status) {
      query = query.eq('status', params.status)
    }
    if (params?.patientId) {
      query = query.eq('patient_id', params.patientId)
    }
    if (params?.doctorId) {
      query = query.eq('doctor_id', params.doctorId)
    }

    const { data, error, count } = await query
      .range(
        (params?.page || 1 - 1) * (params?.pageSize || 20),
        (params?.page || 1) * (params?.pageSize || 20) - 1
      )
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  async createPrescription(prescription: any) {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert([prescription])
      .select()
      .single()
    return { data, error }
  },

  async updatePrescriptionStatus(id: string, status: string, processedAt?: Date) {
    const updateData: any = { status }
    if (processedAt) {
      updateData.processed_at = processedAt
    }

    const { data, error } = await supabase
      .from('prescriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

// 预约管理相关函数
export const appointmentAPI = {
  async getAppointments(params?: {
    page?: number
    pageSize?: number
    patientId?: string
    doctorId?: string
    status?: string
    date?: string
  }) {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(*),
        doctor:users!appointments_doctor_id_fkey(*)
      `, { count: 'exact' })

    if (params?.patientId) {
      query = query.eq('patient_id', params.patientId)
    }
    if (params?.doctorId) {
      query = query.eq('doctor_id', params.doctorId)
    }
    if (params?.status) {
      query = query.eq('status', params.status)
    }
    if (params?.date) {
      query = query.eq('appointment_date', params.date)
    }

    const { data, error, count } = await query
      .range(
        (params?.page || 1 - 1) * (params?.pageSize || 20),
        (params?.page || 1) * (params?.pageSize || 20) - 1
      )
      .order('appointment_date', { ascending: true })

    return { data, error, count }
  },

  async createAppointment(appointment: any) {
    const { data, error } = await supabase
      .from('appointments')
      .insert([appointment])
      .select()
      .single()
    return { data, error }
  },

  async updateAppointmentStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

// 订单管理相关函数
export const orderAPI = {
  async getOrders(params?: {
    page?: number
    pageSize?: number
    patientId?: string
    status?: string
  }) {
    let query = supabase
      .from('orders')
      .select(`
        *,
        patient:users!orders_patient_id_fkey(*),
        prescription:prescriptions(*),
        order_items(*, drug:drugs(*))
      `, { count: 'exact' })

    if (params?.patientId) {
      query = query.eq('patient_id', params.patientId)
    }
    if (params?.status) {
      query = query.eq('status', params.status)
    }

    const { data, error, count } = await query
      .range(
        (params?.page || 1 - 1) * (params?.pageSize || 20),
        (params?.page || 1) * (params?.pageSize || 20) - 1
      )
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  async createOrder(order: any) {
    const { data, error } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single()
    return { data, error }
  },

  async updateOrderStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  }
}

export default supabase
