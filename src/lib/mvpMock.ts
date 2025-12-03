import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import accountManager from './AccountManager'

type Role = 'admin' | 'doctor' | 'patient' | 'pharmacist'
type Status = 'pending' | 'approved' | 'rejected' | 'active'

interface MvpUser {
  id: string
  phone: string
  name: string
  role: Role
  status: Status
  password?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

const ENABLE_MVP = true

function now() {
  return new Date().toISOString()
}

interface MvpSchedule {
  id: number
  doctor_id: number
  date: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
}

interface MvpAppointment {
  id: string
  doctor_id: number
  patient_id: string
  schedule_id: number
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
}

interface MvpDrug {
  id: string
  name: string
  specification: string
  manufacturer: string
  price: number
  stock: number
}

interface MvpOrderItem {
  drug_id: string
  quantity: number
  unit_price: number
}

interface MvpOrder {
  id: string
  order_number: string
  patient_id: string
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  delivery_type: 'pickup' | 'delivery' | 'express'
  total_amount: number
  created_at: string
  notes?: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  tracking_number?: string
  shipping_company?: string
  shipped_at?: string
  delivered_at?: string
  order_items: MvpOrderItem[]
}

function loadUsers(): MvpUser[] {
  const raw = localStorage.getItem('mvpUsers')
  let users: MvpUser[] = []
  if (raw) {
    try { users = JSON.parse(raw) } catch { users = [] }
  }
  if (!users.find(u => u.role === 'admin')) {
    users.push({
      id: '1',
      phone: '13838383838',
      name: '管理员',
      role: 'admin',
      status: 'approved',
      password: 'admin123',
      created_at: now(),
      updated_at: now(),
    })
  }
  // 预置示例医生，保证患者可见医生列表
  const hasDoctor = users.some(u => u.role === 'doctor')
  if (!hasDoctor) {
    users.push({ id: '101', phone: '13900000001', name: '张医生', role: 'doctor', status: 'active', created_at: now(), updated_at: now(), password: 'doctor123' })
    users.push({ id: '102', phone: '13900000002', name: '李医生', role: 'doctor', status: 'active', created_at: now(), updated_at: now(), password: 'doctor123' })
  }
  localStorage.setItem('mvpUsers', JSON.stringify(users))
  return users
}

function saveUsers(users: MvpUser[]) {
  localStorage.setItem('mvpUsers', JSON.stringify(users))
}

function loadSchedules(): MvpSchedule[] {
  const raw = localStorage.getItem('mvpSchedules')
  let schedules: MvpSchedule[] = []
  if (raw) { try { schedules = JSON.parse(raw) } catch {} }
  localStorage.setItem('mvpSchedules', JSON.stringify(schedules))
  return schedules
}

function saveSchedules(schedules: MvpSchedule[]) {
  localStorage.setItem('mvpSchedules', JSON.stringify(schedules))
}

function loadAppointments(): MvpAppointment[] {
  const raw = localStorage.getItem('mvpAppointments')
  let appointments: MvpAppointment[] = []
  if (raw) { try { appointments = JSON.parse(raw) } catch {} }
  localStorage.setItem('mvpAppointments', JSON.stringify(appointments))
  return appointments
}

function saveAppointments(appointments: MvpAppointment[]) {
  localStorage.setItem('mvpAppointments', JSON.stringify(appointments))
}

function loadDrugs(): MvpDrug[] {
  const raw = localStorage.getItem('mvpDrugs')
  let drugs: MvpDrug[] = []
  if (raw) { try { drugs = JSON.parse(raw) } catch {} }
  if (!drugs.length) {
    drugs = [
      { id: 'D001', name: '阿司匹林', specification: '100mg*30片', manufacturer: '拜耳', price: 19.9, stock: 500 },
      { id: 'D002', name: '布洛芬', specification: '200mg*24片', manufacturer: '葛兰素史克', price: 29.9, stock: 320 },
      { id: 'D003', name: '奥美拉唑', specification: '20mg*14粒', manufacturer: '扬子江', price: 25.0, stock: 200 },
    ]
  }
  localStorage.setItem('mvpDrugs', JSON.stringify(drugs))
  return drugs
}

function saveDrugs(drugs: MvpDrug[]) {
  localStorage.setItem('mvpDrugs', JSON.stringify(drugs))
}

function loadOrders(): MvpOrder[] {
  const raw = localStorage.getItem('mvpOrders')
  let orders: MvpOrder[] = []
  if (raw) { try { orders = JSON.parse(raw) } catch {} }
  localStorage.setItem('mvpOrders', JSON.stringify(orders))
  return orders
}

function saveOrders(orders: MvpOrder[]) {
  localStorage.setItem('mvpOrders', JSON.stringify(orders))
}

function match(path: string, pattern: RegExp) {
  const m = pattern.exec(path)
  return m || null
}

function ok<T>(config: AxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config }
}

function err(config: AxiosRequestConfig, status: number, data: any): Promise<never> {
  const error: any = new Error(data?.message || 'Request failed')
  error.response = { data, status, statusText: 'ERR', headers: {}, config }
  throw error
}

export function initMvpMock(instance: AxiosInstance) {
  if (!ENABLE_MVP) return
  const oldAdapter = instance.defaults.adapter!
  instance.defaults.adapter = async (config: AxiosRequestConfig) => {
    const url = String(config.url || '')
    await accountManager.init()
    const users = accountManager.getAll().map(u => ({ id: u.id, phone: u.phone, name: u.name, role: u.role, status: u.status, password: '', rejection_reason: '', created_at: u.created_at, updated_at: u.updated_at }))
    const drugs = loadDrugs()
    let orders = loadOrders()
    let schedules = loadSchedules()
    let appointments = loadAppointments()

    // 注册
    if (url === '/api/auth/register/patient/' && config.method === 'post') {
      const body: any = config.data || {}
      const id = String(Date.now())
      users.push({ id, phone: body.phone, name: body.name || body.phone, role: 'patient', status: 'active', password: body.password, created_at: now(), updated_at: now() })
      saveUsers(users)
      return ok(config, { status: 'active' })
    }
    if (url === '/api/auth/register/doctor/' && config.method === 'post') {
      const body: any = config.data || {}
      const id = String(Date.now())
      users.push({ id, phone: body.phone, name: body.name || body.phone, role: 'doctor', status: 'pending', password: body.password, created_at: now(), updated_at: now() })
      saveUsers(users)
      return ok(config, { status: 'pending' })
    }
    if (url === '/api/auth/register/pharmacist/' && config.method === 'post') {
      const body: any = config.data || {}
      const id = String(Date.now())
      users.push({ id, phone: body.phone, name: body.name || body.phone, role: 'pharmacist', status: 'pending', password: body.password, created_at: now(), updated_at: now() })
      saveUsers(users)
      return ok(config, { status: 'pending' })
    }

    // 医生列表
    if (url === '/api/doctor/' && config.method === 'get') {
      const docs = users.filter(u => u.role === 'doctor' && (u.status === 'approved' || u.status === 'active'))
      const result = docs.map((u, idx) => ({
        id: Number(u.id) || (idx + 1000),
        name: u.name,
        department: '内科',
        title: '主治医师',
        license_number: 'LIC-' + String(u.id).slice(-6),
        hospital: '示例医院',
        is_approved: true,
        user_id: Number(u.id) || (idx + 1000),
      }))
      return ok(config, result)
    }

    // 药品列表
    if (url === '/api/drugs' && config.method === 'get') {
      return ok(config, drugs)
    }

    // 登录
    if (url === '/api/auth/login/' && config.method === 'post') {
      const body: any = config.data || {}
      const phone = body.username
      const role: Role = body.role
      let user = users.find(u => u.phone === phone && u.role === role)
      if (!user) {
        // MVP：若不存在该角色的用户，则按所选角色即时创建为 active
        user = {
          id: String(Date.now()),
          phone,
          name: body.username || phone,
          role,
          status: 'active',
          password: body.password,
          created_at: now(),
          updated_at: now(),
        }
        users.push(user)
        saveUsers(users)
      }
      if (user.password && body.password !== user.password) return err(config, 401, { error: 'invalid_credentials', message: '账号或密码错误' })
      if (user.status === 'pending') return err(config, 403, { error: 'account_pending', message: '您的账号正在审核中，请耐心等待' })
      if (user.status === 'rejected') return err(config, 403, { error: 'account_rejected', message: '您的账号审核未通过', reason: user.rejection_reason })
      return ok(config, { token: 'mvp-token', user_id: user.id, role: user.role })
    }

    // 个人资料
    if (url === '/api/profile/me' && config.method === 'get') {
      const uid = (config.params || {}).user_id
      const user = users.find(u => String(u.id) === String(uid))
      return ok(config, { name: user?.name || '' })
    }

    // 审核列表
    if (url === '/api/admin/reviews/items' && config.method === 'get') {
      const params = config.params || {}
      const page = Number(params.page || 1)
      const pageSize = Number(params.pageSize || 20)
      const status = params.status as Status | undefined
      const role = params.role as Role | undefined
      const all = users.filter(u => (u.role === 'doctor' || u.role === 'pharmacist'))
        .filter(u => (status && status !== 'all' ? (u.status === status || (u.status === 'active' && status === 'approved')) : true))
        .filter(u => (role && role !== 'all' ? u.role === role : true))
      const start = (page - 1) * pageSize
      const items = all.slice(start, start + pageSize).map(u => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        status: u.status === 'active' ? 'approved' : (u.status as any),
        submittedAt: u.created_at,
        updatedAt: u.updated_at,
        payload: {},
      }))
      return ok(config, { items, page, pageSize, total: all.length })
    }

    // 审核通过
    const approveMatch = match(url, /^\/api\/admin\/reviews\/(\w+)\/approve$/)
    if (approveMatch && config.method === 'post') {
      const id = approveMatch[1]
      const idx = users.findIndex(u => u.id === id)
      if (idx >= 0) { users[idx].status = 'approved' as any; users[idx].updated_at = now(); saveUsers(users) }
      return ok(config, {})
    }

    // 审核拒绝
    const rejectMatch = match(url, /^\/api\/admin\/reviews\/(\w+)\/reject$/)
    if (rejectMatch && config.method === 'post') {
      const id = rejectMatch[1]
      const body: any = config.data || {}
      const idx = users.findIndex(u => u.id === id)
      if (idx >= 0) { users[idx].status = 'rejected'; users[idx].rejection_reason = body.reason || ''; users[idx].updated_at = now(); saveUsers(users) }
      return ok(config, {})
    }

    // 批量
    if (url === '/api/admin/reviews/batch' && config.method === 'post') {
      const body: any = config.data || {}
      const ids: string[] = (body.ids || []).map((x: any) => String(x))
      const action = body.action
      const success: string[] = []
      ids.forEach(id => {
        const idx = users.findIndex(u => u.id === id)
        if (idx >= 0) {
          if (action === 'approve') users[idx].status = 'approved' as any
          else if (action === 'reject') { users[idx].status = 'rejected'; users[idx].rejection_reason = body.reason || '' }
          users[idx].updated_at = now()
          success.push(id)
        }
      })
      saveUsers(users)
      return ok(config, { success, failed: [] })
    }

    // 管理员统计与用户列表（仪表盘）
    if (url === '/api/admin/stats' && config.method === 'get') {
      const total_users = users.length
      const pending_doctors = users.filter(u => (u.role === 'doctor' || u.role === 'pharmacist') && (u.status === 'pending')).length
      return ok(config, { total_users, pending_doctors, total_appointments: 0, active_appointments: 0, total_prescriptions: 0, total_revenue: 0 })
    }
    if (url === '/api/admin/users' && config.method === 'get') {
      return ok(config, users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, status: u.status, created_at: u.created_at })))
    }

    // 预约：获取医生排班（若不存在则自动生成）
    const schedulesMatch = match(url, /^\/appointments\/doctor\/(\d+)\/schedules$/)
    if (schedulesMatch && config.method === 'get') {
      const doctorId = Number(schedulesMatch[1])
      const date = (config.params || {}).date || new Date().toISOString().slice(0, 10)
      let list = schedules.filter(s => s.doctor_id === doctorId && s.date === date)
      if (list.length === 0) {
        const id = Math.floor(Math.random() * 1e6)
        const booked = appointments.filter(a => a.doctor_id === doctorId && a.status === 'scheduled' && a.created_at.slice(0,10) === date).length
        const newOne: MvpSchedule = { id, doctor_id: doctorId, date, start_time: '09:00:00', end_time: '12:00:00', capacity: 16, booked_count: booked }
        schedules.push(newOne)
        saveSchedules(schedules)
        // 默认也生成下午
        const id2 = Math.floor(Math.random() * 1e6)
        const pmOne: MvpSchedule = { id: id2, doctor_id: doctorId, date, start_time: '13:00:00', end_time: '17:00:00', capacity: 16, booked_count: 0 }
        schedules.push(pmOne)
        saveSchedules(schedules)
        list = [newOne, pmOne]
      }
      return ok(config, list)
    }

    // 预约：创建
    if (url === '/appointments' && config.method === 'post') {
      const body: any = config.data || {}
      const id = String(Date.now())
      const doctor_id = Number(body.doctor_id)
      const patient_id = String(body.patient_id)
      const schedule_id = Number(body.schedule_id)
      const ap: MvpAppointment = { id, doctor_id, patient_id, schedule_id, status: 'scheduled', created_at: now() }
      appointments.push(ap)
      saveAppointments(appointments)
      const si = schedules.findIndex(s => s.id === schedule_id)
      if (si >= 0) { schedules[si].booked_count = Math.min(schedules[si].capacity, (schedules[si].booked_count || 0) + 1); saveSchedules(schedules) }
      return ok(config, ap)
    }

    // 医生端：获取自己的排班（原后端接口 /doctor/schedules/my）
    if (url === '/doctor/schedules/my' && config.method === 'get') {
      const doctor_id = Number((config.params || {}).doctor_id)
      const list = schedules.filter(s => s.doctor_id === doctor_id)
      return ok(config, list)
    }

    // 医生端：创建/更新排班（上午/下午容量）原后端接口 /doctor/schedules
    if (url === '/doctor/schedules' && config.method === 'post') {
      const body: any = config.data || {}
      const doctor_id = Number(body.doctor_id)
      const date = String(body.date)
      let start = String(body.start_time || '09:00:00')
      let end = String(body.end_time || '12:00:00')
      const cap = Number(body.capacity || 0)
      const sh = Number(start.split(':')[0])
      if (sh < 12) { start = '09:00:00'; end = '12:00:00' } else { start = '13:00:00'; end = '17:00:00' }
      // UPSERT by doctor_id + date + start_time
      const idx = schedules.findIndex(s => s.doctor_id === doctor_id && s.date === date && s.start_time === start)
      if (idx >= 0) {
        schedules[idx].end_time = end
        schedules[idx].capacity = cap
      } else {
        schedules.push({ id: Math.floor(Math.random() * 1e9), doctor_id, date, start_time: start, end_time: end, capacity: cap, booked_count: 0 })
      }
      saveSchedules(schedules)
      return ok(config, { ok: true })
    }

    // 预约：我的预约
    if (url === '/appointments/my' && config.method === 'get') {
      const patient_id = String((config.params || {}).patient_id)
      const list = appointments.filter(a => String(a.patient_id) === patient_id)
      return ok(config, list)
    }

    // 预约：取消
    const cancelMatch = match(url, /^\/appointments\/(\w+)\/cancel$/)
    if (cancelMatch && config.method === 'post') {
      const id = cancelMatch[1]
      const idx = appointments.findIndex(a => String(a.id) === String(id))
      if (idx >= 0) {
        const ap = appointments[idx]
        ap.status = 'cancelled'
        appointments[idx] = ap
        saveAppointments(appointments)
        const si = schedules.findIndex(s => s.id === ap.schedule_id)
        if (si >= 0) { schedules[si].booked_count = Math.max(0, (schedules[si].booked_count || 0) - 1); saveSchedules(schedules) }
      }
      return ok(config, {})
    }

    // 预约：更新状态
    const statusMatch = match(url, /^\/appointments\/(\w+)\/status$/)
    if (statusMatch && config.method === 'post') {
      const id = statusMatch[1]
      const body: any = config.data || {}
      const idx = appointments.findIndex(a => String(a.id) === String(id))
      if (idx >= 0) {
        appointments[idx].status = body.status || appointments[idx].status
        saveAppointments(appointments)
      }
      return ok(config, {})
    }

    // 预约：改期
    const rescheduleMatch = match(url, /^\/appointments\/(\w+)\/reschedule$/)
    if (rescheduleMatch && config.method === 'post') {
      const id = rescheduleMatch[1]
      const body: any = config.data || {}
      const newScheduleId = Number(body.schedule_id)
      const idx = appointments.findIndex(a => String(a.id) === String(id))
      if (idx >= 0) {
        const old = appointments[idx]
        const oldSi = schedules.findIndex(s => s.id === old.schedule_id)
        if (oldSi >= 0) { schedules[oldSi].booked_count = Math.max(0, (schedules[oldSi].booked_count || 0) - 1) }
        const newSi = schedules.findIndex(s => s.id === newScheduleId)
        if (newSi >= 0) { schedules[newSi].booked_count = Math.min(schedules[newSi].capacity, (schedules[newSi].booked_count || 0) + 1) }
        old.schedule_id = newScheduleId
        old.status = 'scheduled'
        appointments[idx] = old
        saveAppointments(appointments)
        saveSchedules(schedules)
      }
      return ok(config, {})
    }

    // 医生端：获取自己的预约
    const doctorApMatch = match(url, /^\/appointments\/doctor\/(\d+)$/)
    if (doctorApMatch && config.method === 'get') {
      const doctor_id = Number(doctorApMatch[1])
      const list = appointments.filter(a => a.doctor_id === doctor_id)
      const enriched = list.map(a => {
        const patient = users.find(u => String(u.id) === String(a.patient_id))
        const sch = schedules.find(s => s.id === a.schedule_id)
        const startH = sch ? Number(String(sch.start_time).split(':')[0]) : 0
        const period = startH < 12 ? '上午' : '下午'
        const apptDate = sch ? sch.date : new Date(a.created_at).toISOString().slice(0,10)
        return {
          id: a.id,
          patient_name: patient?.name || '未知患者',
          patient_phone: patient?.phone || '',
          appointment_date: apptDate,
          appointment_time: period,
          status: a.status,
          notes: '',
          symptoms: '',
          created_at: a.created_at,
          doctor_name: users.find(u => String(u.id) === String(doctor_id))?.name || '',
          department: '内科',
        }
      })
      return ok(config, enriched)
    }

    // 订单：患者订单列表
    if (url === '/api/orders/my' && config.method === 'get') {
      const patient_id = String((config.params || {}).patient_id)
      const list = orders.filter(o => String(o.patient_id) === patient_id)
      // enrich drug info
      const enriched = list.map(o => ({
        ...o,
        order_items: o.order_items.map(oi => ({
          ...oi,
          drug: drugs.find(d => d.id === oi.drug_id)
        }))
      }))
      return ok(config, enriched)
    }

    // 订单：创建
    if (url === '/api/orders' && config.method === 'post') {
      const body: any = config.data || {}
      const id = String(Date.now())
      const order_number = 'O' + id
      const items: MvpOrderItem[] = Array.isArray(body.items) ? body.items : []
      const total_amount = items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0)
      const order: MvpOrder = {
        id,
        order_number,
        patient_id: String(body.patient_id),
        status: 'confirmed',
        payment_status: 'paid',
        delivery_type: body.delivery_type || 'pickup',
        total_amount,
        created_at: now(),
        notes: body.notes,
        receiver_name: body.receiver_name,
        receiver_phone: body.receiver_phone,
        receiver_address: body.receiver_address,
        order_items: items,
      }
      orders.push(order)
      saveOrders(orders)
      return ok(config, order)
    }

    // 审计日志忽略
    if (url === '/api/audit/logs' && config.method === 'post') {
      return ok(config, { ok: true })
    }

    return oldAdapter(config)
  }
}
