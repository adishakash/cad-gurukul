import axios from 'axios'

// Injected lazily to break circular dependency:
// store → authSlice → api → store
let _store = null
export function injectStore(s) {
  _store = s
}

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
          _store?.dispatch({ type: 'auth/clearCredentials' })
          window.location.href = '/login?session=expired'
        }
      } else {
        _store?.dispatch({ type: 'auth/clearCredentials' })
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// ─── Lead API ─────────────────────────────────────────────────────────────────
export const leadApi = {
  create: (data) => api.post('/leads', data),
  getMe: () => api.get('/leads/me'),
  updateMe: (data) => api.patch('/leads/me', data),
  appendEvent: (event, metadata) => api.post('/leads/me/events', { event, metadata }),
  linkUser: (leadId) => api.post('/leads/me/link-user', { leadId }),
}

// ─── Admin API client (uses cg_admin_token, separate from student API) ───────
const adminApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})
adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cg_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Admin Lead API ───────────────────────────────────────────────────────────
export const adminLeadApi = {
  list: (params) => adminApiClient.get('/admin/leads', { params }),
  getDetail: (id) => adminApiClient.get(`/admin/leads/${id}`),
  update: (id, data) => adminApiClient.patch(`/admin/leads/${id}`, data),
  triggerAction: (id, action) => adminApiClient.post(`/admin/leads/${id}/actions`, { action }),
  getFunnel: (days = 30) => adminApiClient.get('/admin/funnel', { params: { days } }),
  exportCsv: () => adminApiClient.get('/admin/export/leads', { responseType: 'blob' }),
}

// ─── Analytics helper (fire-and-forget) ──────────────────────────────────────
export const trackEvent = (event, metadata = {}) => {
  leadApi.appendEvent(event, metadata).catch(() => {/* silent */})
}

export default api
