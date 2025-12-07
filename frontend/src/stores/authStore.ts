import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

// 手机号格式化函数
const sanitizePhone = (input: string) => {
  const digits = (input || '').replace(/\D/g, '')
  const cleaned = digits.replace(/^(?:\+?86|0086|86)/, '')
  return cleaned.length > 11 ? cleaned.slice(-11) : cleaned
}

export type UserRole = 'admin' | 'doctor' | 'patient' | 'pharmacist'

export interface User {
  id: string
  phone: string
  name: string
  role: UserRole
  is_approved?: boolean
  created_at?: string
  updated_at?: string
  address?: string
  avatar_url?: string
  specialty?: string
  title?: string
  license_number?: string
  hospital?: string
  department?: string
  experience_years?: number
  bio?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  
  // Actions
  login: (phone: string, password: string, role: UserRole) => Promise<UserRole>
  register: (userData: RegisterData) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
  updateUser?: (payload: Partial<User>) => void
}

interface RegisterData {
  phone: string
  password: string
  name: string
  role: UserRole
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      login: async (phone: string, password: string, role: UserRole) => {
        set({ loading: true, error: null })
        try {
          const cleanedPhone = sanitizePhone(phone)
          // 后端角色命名兼容：patient -> user
          const backendRole = role === 'patient' ? 'user' : role
      const res = await api.post('/api/auth/login/', {
        username: cleanedPhone,
        password,
        role: backendRole,
      })
      const data = res.data || {}
      const backendUserRole = String(data.role || backendRole)
      const uiRole: UserRole = backendUserRole === 'user' ? 'patient' : (backendUserRole as UserRole)
      localStorage.setItem('token', data.token || 'jwt-token')
      // 进一步获取档案信息，确保姓名/科室等字段落地
      let profileName = cleanedPhone
      let profile: any = {}
      try {
        const profileRes = await api.get('/api/profile/me', { params: { user_id: data.user_id } })
        profile = profileRes.data || {}
        profileName = profile.name || cleanedPhone
      } catch (_) {
        // 忽略档案获取失败，继续使用手机号
      }
          set({
            user: { id: String(data.user_id), phone: cleanedPhone, name: profileName, role: uiRole, ...profile },
            isAuthenticated: true,
            loading: false,
            error: null,
          })
          return uiRole
        } catch (error: any) {
          set({ loading: false, error: error?.message || '登录失败' })
          throw error
        }
      },

      register: async (userData: RegisterData) => {
        set({ loading: true, error: null })
        try {
          const cleanedPhone = sanitizePhone(userData.phone)
          if (userData.role === 'patient') {
            await api.post('/api/auth/register/patient/', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else if (userData.role === 'doctor') {
            await api.post('/api/auth/register/doctor/', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else if (userData.role === 'pharmacist') {
            await api.post('/api/auth/register/pharmacist/', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else {
            throw new Error('暂不支持该角色注册')
          }
          set({ loading: false })
        } catch (error: any) {
          set({ loading: false })
        }
      },

      logout: async () => {
        set({ loading: true })
        try {
          localStorage.removeItem('token')
          set({
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null
          })
        } catch (error: any) {
          set({
            loading: false,
            error: error.message || '退出登录失败'
          })
        }
      },

      checkAuth: async () => {
        try {
          const token = localStorage.getItem('token')
          if (!token) {
            set({ user: null, isAuthenticated: false, loading: false, error: null })
            return
          }
          set({ loading: false })
        } catch (error: any) {
          set({ user: null, isAuthenticated: false, loading: false, error: error.message })
        }
      },

      clearError: () => {
        set({ error: null })
      },
      updateUser: (payload: Partial<User>) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, ...payload } })
      }
    }),
    {
      name: 'hospital-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
