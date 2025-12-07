import axios from 'axios'
import { initMvpMock } from './mvpMock'

const instance = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = (config.headers ?? new axios.AxiosHeaders()) as any
    (config.headers as any).Authorization = `Bearer ${token}`
  }
  return config
})

// MVP 内置模拟后端，保证核心审核流程在无后端时可运行
initMvpMock(instance)

export default instance
