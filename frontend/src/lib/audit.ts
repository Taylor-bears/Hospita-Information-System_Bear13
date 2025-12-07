import api from './api'

export async function logAudit(action: string, entity: string, details: any) {
  try {
    await api.post('/api/audit/logs', {
      action,
      entity,
      details,
      timestamp: new Date().toISOString()
    })
  } catch {}
}
