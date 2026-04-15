import { create } from 'zustand'
import { authApi, type UserProfile, type LoginCredentials } from '../api/auth'

// When true, skip token check — backend auto-auths as admin
export const BYPASS_AUTH = true

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (credentials) => {
    await authApi.login(credentials)
    const user = await authApi.me()
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchMe: async () => {
    const token = localStorage.getItem('access_token')
    // In bypass mode, always call API (backend auto-auths as admin)
    if (!BYPASS_AUTH && !token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      if (BYPASS_AUTH) {
        // In bypass mode, show layout even if fetchMe fails
        set({ isLoading: false, isAuthenticated: true })
      } else {
        set({ isLoading: false, isAuthenticated: false })
      }
    }
  },
}))
