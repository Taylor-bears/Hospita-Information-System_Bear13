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
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  
  // Actions
  login: (phone: string, password: string, role: UserRole) => Promise<void>
  register: (userData: RegisterData) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
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
          const res = await api.post('/api/auth/login', {
            username: cleanedPhone,
            password,
            role,
          })
          const token = res.data?.token
          const uid = String(res.data?.user_id)
          const r = res.data?.role
          if (token) localStorage.setItem('token', token)
          let actualRole: UserRole = 'patient'
          if (r === 'doctor') actualRole = 'doctor'
          else if (r === 'admin') actualRole = 'admin'
          else if (r === 'pharmacist') actualRole = 'pharmacist'
          const profileRes = await api.get('/api/profile/me', { params: { user_id: uid } })
          const name = profileRes.data?.name || cleanedPhone
          set({
            user: { id: uid, phone: cleanedPhone, name, role: actualRole },
            isAuthenticated: true,
            loading: false,
            error: null,
          })
        } catch (error: any) {
          const detail = error?.response?.data?.detail
          set({
            loading: false,
            error: detail || error.message || '登录失败'
          })
          throw error
        }
      },

      register: async (userData: RegisterData) => {
        set({ loading: true, error: null })
        try {
          const cleanedPhone = sanitizePhone(userData.phone)
          if (userData.role === 'patient') {
            await api.post('/api/auth/register/patient', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else if (userData.role === 'doctor') {
            await api.post('/api/auth/register/doctor', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else if (userData.role === 'pharmacist') {
            await api.post('/api/auth/register/pharmacist', {
              phone: cleanedPhone,
              password: userData.password,
              name: userData.name,
            })
          } else {
            throw new Error('暂不支持该角色注册')
          }

          set({ loading: false })
        } catch (error: any) {
          const detail = error?.response?.data?.detail
          set({
            loading: false,
            error: detail || error.message || '注册失败'
          })
          throw error
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
