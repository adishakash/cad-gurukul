import axios from 'axios'
import { apiBaseUrl } from '../config/apiBaseUrl'

// Injected lazily to break circular dependency:
// store → authSlice → api → store
let _store = null
export function injectStore(s) {
  _store = s
}

const api = axios.create({
  baseURL: apiBaseUrl,
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
            `${apiBaseUrl}/auth/refresh`,
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
  create:      (data)          => api.post('/leads', data),
  getMe:       ()              => api.get('/leads/me'),
  update:      (data)          => api.patch('/leads/me', data),
  updateMe:    (data)          => api.patch('/leads/me', data),
  appendEvent: (event, metadata) => api.post('/leads/me/events', { event, metadata }),
  linkUser:    (leadId)        => api.post('/leads/me/link-user', { leadId }),
}

// ─── Report API ───────────────────────────────────────────────────────────────
export const reportApi = {
  getMyReports:   ()         => api.get('/reports/my'),
  getReport:      (id)       => api.get(`/reports/${id}`),
  getReportStatus:(id)       => api.get(`/reports/${id}/status`),
  downloadPdf:    (id)       => api.get(`/reports/${id}/pdf`, { responseType: 'blob' }),
}

// ─── Payment API ──────────────────────────────────────────────────────────────
export const paymentApi = {
  createOrder:  (assessmentId, planType = 'standard') => api.post('/payments/create-order', { assessmentId, planType }),
  verify:       (data)         => api.post('/payments/verify', data),
  getHistory:   ()             => api.get('/payments/history'),
  getStatus:    (orderId)      => api.get(`/payments/status/${orderId}`),
}

// ─── Admin API client (uses cg_admin_token, separate from student API) ───────
export const adminApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})
adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cg_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cg_admin_token')
      localStorage.removeItem('cg_admin_refresh_token')
      localStorage.removeItem('cg_admin')
      window.location.href = '/admin/login?session=expired'
    }
    return Promise.reject(error)
  }
)

// ─── Admin Lead API ───────────────────────────────────────────────────────────
export const adminLeadApi = {
  list:          (params)        => adminApiClient.get('/admin/leads', { params }),
  getDetail:     (id)            => adminApiClient.get(`/admin/leads/${id}`),
  update:        (id, data)      => adminApiClient.patch(`/admin/leads/${id}`, data),
  triggerAction: (id, actionOrPayload) => {
    const payload = typeof actionOrPayload === 'string'
      ? { action: actionOrPayload }
      : actionOrPayload
    return adminApiClient.post(`/admin/leads/${id}/actions`, payload)
  },
  getFunnel:     (days = 30)     => adminApiClient.get('/admin/funnel', { params: { days } }),
  getAnalytics:  (days)          => adminApiClient.get('/admin/analytics', { params: days ? { days } : {} }),
  exportCsv:     ()              => adminApiClient.get('/admin/export/leads', { responseType: 'blob' }),
}

// ─── Staff API client (uses cg_staff_token, for Career Counsellor Lead / CC) ──
export const staffApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})
staffApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cg_staff_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
staffApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cg_staff_token')
      localStorage.removeItem('cg_staff_refresh_token')
      localStorage.removeItem('cg_staff')
      window.location.href = '/staff/login?session=expired'
    }
    return Promise.reject(error)
  }
)

// ─── Staff Lead API (read-only — for CCL dashboard) ──────────────────────────
export const staffLeadApi = {
  list:      (params) => staffApiClient.get('/staff/leads',      { params }),
  getDetail: (id)     => staffApiClient.get(`/staff/leads/${id}`),
}

// ─── Analytics helper (fire-and-forget from frontend) ────────────────────────
export const trackEvent = (event, metadata = {}) => {
  leadApi.appendEvent(event, metadata).catch(() => {/* silent */})
}

export default api
