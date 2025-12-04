export const isDemo = Boolean((import.meta as any).env?.VITE_DEMO_AUTH ?? true)

export interface DemoSystemStats {
  totalUsers: number
  pendingApprovals: number
  totalAppointments: number
  pendingAppointments: number
  totalPrescriptions: number
  totalRevenue: number
}

export interface DemoRecentUser {
  id: string
  name: string
  phone: string
  role: 'patient' | 'doctor' | 'pharmacist' | 'admin'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface DemoRoleDistribution {
  role: string
  count: number
  percentage: number
}

export function getAdminStats(): DemoSystemStats {
  return {
    totalUsers: 128,
    pendingApprovals: 5,
    totalAppointments: 342,
    pendingAppointments: 12,
    totalPrescriptions: 96,
    totalRevenue: 58230,
  }
}

export function getAdminUsers(): DemoRecentUser[] {
  const now = Date.now()
  const roles: Array<DemoRecentUser['role']> = ['patient', 'doctor', 'pharmacist', 'admin']
  const statuses: Array<DemoRecentUser['status']> = ['approved', 'pending', 'rejected']
  const list: DemoRecentUser[] = []
  for (let i = 0; i < 12; i++) {
    const role = roles[i % roles.length]
    const status = statuses[i % statuses.length]
    list.push({
      id: String(1000 + i),
      name: `用户${i + 1}`,
      phone: `13${String(100000000 + i)}`,
      role,
      status,
      created_at: new Date(now - i * 86400000).toISOString(),
    })
  }
  return list
}

export function getRoleDistribution(users: DemoRecentUser[]): DemoRoleDistribution[] {
  const counts = {
    patient: 0,
    doctor: 0,
    pharmacist: 0,
    admin: 0,
  }
  for (const u of users) counts[u.role]++
  const total = users.length || 1
  return [
    { role: '患者', count: counts.patient, percentage: Math.round((counts.patient / total) * 100) },
    { role: '医生', count: counts.doctor, percentage: Math.round((counts.doctor / total) * 100) },
    { role: '药房工作人员', count: counts.pharmacist, percentage: Math.round((counts.pharmacist / total) * 100) },
    { role: '管理员', count: counts.admin, percentage: Math.round((counts.admin / total) * 100) },
  ]
}
