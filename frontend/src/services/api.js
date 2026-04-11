import axios from 'axios'
import { store } from '../store'
import { clearCredentials } from '../store/slices/authSlice'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor – attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cg_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor – handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('cg_refresh_token')

      if (refreshToken) {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
            { refreshToken }
          )
          const { accessToken, refreshToken: newRefreshToken } = res.data.data
          localStorage.setItem('cg_access_token', accessToken)
          if (newRefreshToken) localStorage.setItem('cg_refresh_token', newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch {
          store.dispatch(clearCredentials())
          window.location.href = '/login?session=expired'
        }
      } else {
        store.dispatch(clearCredentials())
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
