import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar: string
}

interface AuthContextType {
  user: User | null
  isLoggedIn: boolean
  token: string | null
  loginWithPhone: (phone: string, code: string) => Promise<{ ok: boolean; error?: string; token?: string; user?: User }>
  sendCode: (phone: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'onellm_token'
const USER_KEY = 'onellm_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  const saveAuth = (u: User, t: string) => {
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setToken(t)
    setUser(u)
  }

  const loginWithPhone = useCallback(async (phone: string, code: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        return { ok: false, error: data.message || '登录失败' }
      }
      const u = data.data.user
      const t = data.data.token
      const userObj: User = { id: u.id, name: u.name, email: u.email || '', phone: u.phone || '', avatar: u.name[0].toUpperCase() }
      saveAuth(userObj, t)
      return { ok: true, token: t, user: userObj }
    } catch {
      return { ok: false, error: '网络错误，请稍后再试' }
    }
  }, [])

  const sendCode = useCallback(async (phone: string) => {
    try {
      const res = await fetch('/api/v1/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        return { ok: false, error: data.message || '发送失败' }
      }
      return { ok: true }
    } catch {
      return { ok: false, error: '网络错误，请稍后再试' }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, token, loginWithPhone, sendCode, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
