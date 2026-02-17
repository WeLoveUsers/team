export type AuthRole = 'admin' | 'team'
export type AuthStatus = 'active' | 'suspended'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: AuthRole
  status: AuthStatus
  expiresAt: string
  createdAt: string | null
  updatedAt: string | null
}

export type AuthSession = {
  token: string
  user: AuthUser
}

const AUTH_TOKEN_STORAGE_KEY = 'authToken'
const AUTH_USER_STORAGE_KEY = 'authUser'

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'admin' || value === 'team'
}

function isAuthStatus(value: unknown): value is AuthStatus {
  return value === 'active' || value === 'suspended'
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AuthUser>
  return (
    typeof user.id === 'string'
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && isAuthRole(user.role)
    && isAuthStatus(user.status)
    && typeof user.expiresAt === 'string'
    && (typeof user.createdAt === 'string' || user.createdAt === null)
    && (typeof user.updatedAt === 'string' || user.updatedAt === null)
  )
}

export function readAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  return token && token.length > 0 ? token : null
}

export function readAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return isAuthUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function readAuthSession(): AuthSession | null {
  const token = readAuthToken()
  const user = readAuthUser()
  if (!token || !user) {
    clearAuthSession()
    return null
  }
  return { token, user }
}

export function storeAuthSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token)
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user))
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY)
}
