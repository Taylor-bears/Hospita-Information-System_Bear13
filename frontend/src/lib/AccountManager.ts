export type AccountRole = 'admin' | 'doctor' | 'patient' | 'pharmacist'
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'active'

export interface AccountRecord {
  id: string
  phone: string
  name: string
  role: AccountRole
  status: AccountStatus
  passwordEnc: string
  created_at: string
  updated_at: string
}

type Listener = (type: string, payload: any) => void

class AccountManager {
  private store: Map<string, AccountRecord> = new Map()
  private listeners: Set<Listener> = new Set()
  private seq: Promise<void> = Promise.resolve()
  private key = 'accounts_encrypted'

  async init() {
    const raw = localStorage.getItem(this.key)
    if (raw) {
      try {
        const arr = JSON.parse(raw) as AccountRecord[]
        arr.forEach(a => this.store.set(a.phone, a))
      } catch {}
    }
    if (!this.store.has('13838383838')) {
      const id = '1'
      const rec = await this.buildRecord({ id, phone: '13838383838', name: '管理员', role: 'admin', status: 'approved' }, 'admin123')
      this.store.set(rec.phone, rec)
      await this.persist()
      this.emit('change', {})
    }
    // 预置一个医生账号，便于患者列表与预约
    if (![...this.store.values()].some(a => a.role === 'doctor')) {
      const rec = await this.buildRecord({ id: String(Date.now()), phone: '13900000000', name: '王医生', role: 'doctor', status: 'approved' }, 'doc123')
      this.store.set(rec.phone, rec)
      await this.persist()
      this.emit('change', {})
    }
  }

  private async persist() {
    const arr = Array.from(this.store.values())
    localStorage.setItem(this.key, JSON.stringify(arr))
  }

  private async encrypt(text: string): Promise<string> {
    try {
      if ((globalThis as any).crypto?.subtle) {
        const enc = new TextEncoder().encode(text)
        const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(12))
        const key = await (globalThis as any).crypto.subtle.importKey('raw', new TextEncoder().encode('account-manager-key'), 'AES-GCM', false, ['encrypt'])
        const ct = await (globalThis as any).crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
        const out = new Uint8Array(iv.length + new Uint8Array(ct).length)
        out.set(iv, 0)
        out.set(new Uint8Array(ct), iv.length)
        return 'ENC:' + btoa(String.fromCharCode(...out))
      }
    } catch {}
    return 'PLAIN:' + btoa(unescape(encodeURIComponent(text)))
  }

  private async verify(enc: string, plain: string): Promise<boolean> {
    try {
      if (enc.startsWith('ENC:')) {
        const base = enc.slice(4)
        if ((globalThis as any).crypto?.subtle) {
          const bin = Uint8Array.from(atob(base), c => c.charCodeAt(0))
          const iv = bin.slice(0, 12)
          const data = bin.slice(12)
          const key = await (globalThis as any).crypto.subtle.importKey('raw', new TextEncoder().encode('account-manager-key'), 'AES-GCM', false, ['decrypt'])
          const dec = await (globalThis as any).crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
          const txt = new TextDecoder().decode(dec)
          return txt === plain
        }
        return false
      }
      if (enc.startsWith('PLAIN:')) {
        const base = enc.slice(6)
        const txt = decodeURIComponent(escape(atob(base)))
        return txt === plain
      }
      return false
    } catch {
      return false
    }
  }

  private async buildRecord(base: { id: string, phone: string, name: string, role: AccountRole, status: AccountStatus }, password: string): Promise<AccountRecord> {
    const passwordEnc = await this.encrypt(password)
    return { ...base, passwordEnc, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  }

  on(fn: Listener) { this.listeners.add(fn) }
  off(fn: Listener) { this.listeners.delete(fn) }
  private emit(type: string, payload: any) { this.listeners.forEach(l => { try { l(type, payload) } catch {} }) }

  async addAccount(phone: string, name: string, password: string, role: AccountRole, status: AccountStatus = 'active') {
    await (this.seq = this.seq.then(async () => {
      const id = String(Date.now())
      const rec = await this.buildRecord({ id, phone, name, role, status }, password)
      this.store.set(phone, rec)
      await this.persist()
      this.emit('change', { phone })
    }))
  }

  async authenticate(phone: string, password: string, role?: AccountRole) {
    const rec = this.store.get(phone)
    if (!rec) return null
    const ok = await this.verify(rec.passwordEnc, password)
    if (!ok) return null
    if (role && rec.role !== role) return null
    return rec
  }

  getByPhone(phone: string) { return this.store.get(phone) || null }
  getAll() { return Array.from(this.store.values()) }

  async setStatus(phone: string, status: AccountStatus) {
    await (this.seq = this.seq.then(async () => {
      const rec = this.store.get(phone)
      if (!rec) return
      rec.status = status
      rec.updated_at = new Date().toISOString()
      await this.persist()
      this.emit('status', { phone, status })
    }))
  }

  async updateRole(phone: string, role: AccountRole) {
    await (this.seq = this.seq.then(async () => {
      const rec = this.store.get(phone)
      if (!rec) return
      rec.role = role
      rec.updated_at = new Date().toISOString()
      await this.persist()
      this.emit('change', { phone })
    }))
  }

  hasPermission(role: AccountRole, resource: string, action: string) {
    if (role === 'admin') return true
    if (role === 'doctor') return resource === 'appointments'
    if (role === 'pharmacist') return resource === 'inventory'
    if (role === 'patient') return resource === 'appointments' && action !== 'manage'
    return false
  }
}

const accountManager = new AccountManager()
export default accountManager
