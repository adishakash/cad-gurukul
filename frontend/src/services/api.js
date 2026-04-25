import axios from 'axios'
import { apiBaseUrl } from '../config/apiBaseUrl'
import { getStoredReferralCode, getStoredCouponCode } from '../utils/referral'

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

    // Auth credential endpoints (login, register) return 401 for invalid credentials —
    // that is NOT a session-expiry event. Skip the refresh/redirect logic for those
    // endpoints so the error propagates naturally to the calling thunk and the UI can
    // display a stable inline error message instead of triggering a full page reload.
    const isAuthCredentialEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/admin/login')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthCredentialEndpoint) {
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
  create:      (data)          => {
    const referralCode = getStoredReferralCode()
    const payload = referralCode && !data?.referralCode
      ? { ...data, referralCode }
      : data
    return api.post('/leads', payload)
  },
  getMe:       ()              => api.get('/leads/me'),
  update:      (data)          => api.patch('/leads/me', data),
  updateMe:    (data)          => api.patch('/leads/me', data),
  appendEvent: (event, metadata) => api.post('/leads/me/events', { event, metadata }),
  linkUser:    (leadId)        => api.post('/leads/me/link-user', { leadId }),
}

// ─── Student Profile API ─────────────────────────────────────────────────────
export const studentApi = {
  getMe:              ()       => api.get('/students/me'),
  updateMe:           (data)   => api.put('/students/me', data),
  completeOnboarding: (data)   => api.post('/students/me/onboarding', data),
}

// ─── Report API ───────────────────────────────────────────────────────────────
export const reportApi = {
  getMyReports:   ()         => api.get('/reports/my'),
  getReport:      (id)       => api.get(`/reports/${id}`),
  getReportStatus:(id)       => api.get(`/reports/${id}/status`),
  downloadPdf:    (id)       => api.get(`/reports/${id}/pdf`, { responseType: 'blob', timeout: 120000 }),
}

// ─── Payment API ──────────────────────────────────────────────────────────────
export const paymentApi = {
  getQuote:     (planType, assessmentId, options = {}) => {
    const referralCode = options.referralCode || getStoredReferralCode()
    const couponCode = options.couponCode || getStoredCouponCode()
    return api.get('/payments/quote', { params: { planType, assessmentId, referralCode, couponCode } })
  },
  createOrder:  (assessmentId, planType = 'standard', options = {}) => {
    const referralCode = options.referralCode || getStoredReferralCode()
    const couponCode = options.couponCode || getStoredCouponCode()
    return api.post('/payments/create-order', { assessmentId, planType, referralCode, couponCode })
  },
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
  getRevenueSummary: ()          => adminApiClient.get('/admin/revenue/summary'),
  exportCsv:     ()              => adminApiClient.get('/admin/export/leads', { responseType: 'blob' }),
  assign:        (id, staffId)   => adminApiClient.put(`/admin/leads/${id}/assign`, { staffId }),
  listStaffForAssign: ()         => adminApiClient.get('/admin/staff'),
}

export const adminEmailApi = {
  status:   (refresh = false) => adminApiClient.get('/admin/email/status', { params: refresh ? { refresh: true } : {} }),
  sendTest: (data = {})       => adminApiClient.post('/admin/email/test', data),
}

export const adminConsultationApi = {
  list:        (params = {}) => adminApiClient.get('/admin/consultations', { params }),
  block:       (data)        => adminApiClient.post('/admin/consultations/blocks', data),
  unblock:     (id)          => adminApiClient.delete(`/admin/consultations/blocks/${id}`),
  updateBooking: (id, data)  => adminApiClient.patch(`/admin/consultations/bookings/${id}`, data),
}

// ─── Admin Discount Policy API (Phase 6 + Phase 9) ───────────────────────────
export const adminDiscountApi = {
  listPolicies:   ()       => adminApiClient.get('/admin/discount-policies'),
  listHistory:    ()       => adminApiClient.get('/admin/discount-policies/history'),
  upsertPolicy:   (data)   => adminApiClient.put('/admin/discount-policies', data),
  deletePolicy:   (id)     => adminApiClient.delete(`/admin/discount-policies/${id}`),
}

// ─── Admin Training API (Phase 6) ────────────────────────────────────────────
export const adminTrainingApi = {
  list:         ()           => adminApiClient.get('/admin/ccl/training'),
  history:      ()           => adminApiClient.get('/admin/ccl/training/history'),
  create:       (formData)   => adminApiClient.post('/admin/ccl/training', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:       (id, data)   => adminApiClient.patch(`/admin/ccl/training/${id}`, data),
  remove:       (id)         => adminApiClient.delete(`/admin/ccl/training/${id}`),
  openFile:     (id)         => adminApiClient.get(`/admin/ccl/training/${id}/file`,              { responseType: 'blob' }),
  downloadFile: (id)         => adminApiClient.get(`/admin/ccl/training/${id}/file?download=true`, { responseType: 'blob' }),
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
    // Don't redirect on 401 from the staff login endpoint itself — that is a
    // credential error, not a session-expiry event. Only redirect for protected routes.
    const isStaffLoginEndpoint = error.config?.url?.includes('/staff/login')
    if (error.response?.status === 401 && !isStaffLoginEndpoint) {
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

// ─── Staff CCL Business API (CCL-specific business features) ─────────────────
export const staffApi = {
  // Account / income
  getAccount:      ()             => staffApiClient.get('/staff/account'),
  getTransactions: (params = {})  => staffApiClient.get('/staff/account/transactions', { params }),
  // Joining links
  getJoiningLinks: (params = {})  => staffApiClient.get('/staff/joining-links', { params }),
  createJoiningLink: (data)       => staffApiClient.post('/staff/joining-links', data),
  // Payouts
  getPayouts:      ()             => staffApiClient.get('/staff/payouts'),
  getPayoutDetail: (id)           => staffApiClient.get(`/staff/payouts/${id}`),
  // Discount policy (Phase 6)
  getDiscountPolicy: (planType = 'joining') => staffApiClient.get('/staff/discount-policy', { params: { planType } }),
  // Discount config (legacy)
  getDiscount:     ()             => staffApiClient.get('/staff/discount'),
  updateDiscount:  (data)         => staffApiClient.put('/staff/discount', data),
  // Training content
  getTraining:       ()            => staffApiClient.get('/staff/training'),
  // Protected file access — streams file with auth header; use responseType:'blob' on caller side
  getTrainingFile:   (id)          => staffApiClient.get(`/staff/training/${id}/file`,              { responseType: 'blob' }),
  downloadTrainingFile: (id)       => staffApiClient.get(`/staff/training/${id}/file?download=true`, { responseType: 'blob' }),
}

// ─── Public Joining Link API (no auth required) ───────────────────────────────
const publicApiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

export const joiningApi = {
  resolve:     (code)       => publicApiClient.get(`/join/${code}`),
  createOrder: (code, data) => publicApiClient.post(`/join/${code}/create-order`, data),
  verify:      (code, data) => publicApiClient.post(`/join/${code}/verify`, data),
}

// ─── Counsellor API (read-only scoped — for CC dashboard) ────────────────────
// Uses the same staffApiClient (same cg_staff_token), but hits /counsellor/* routes.
// /counsellor/leads is filtered to counsellingInterested:true on the backend.
export const counsellorApi = {
  getProfile: ()       => staffApiClient.get('/counsellor/profile'),
  logout:     (data)   => staffApiClient.post('/counsellor/logout', data),
  leads:      (params) => staffApiClient.get('/counsellor/leads',    { params }),
  students:   (params) => staffApiClient.get('/counsellor/students', { params }),
  reports:    (params) => staffApiClient.get('/counsellor/reports',  { params }),
  // Assigned prospects (leads assigned by admin to this counsellor)
  // Uses /counsellor/* prefix — CC users (level 2) are blocked from /staff/* routes
  getAssignedProspects: () => staffApiClient.get('/counsellor/assigned-prospects'),
}

// ─── Counsellor Business API (CC Phase 5 — income, coupons, payouts) ────────
// Uses staffApiClient (cg_staff_token), hits /counsellor/* business routes.
export const counsellorBizApi = {
  getAccount:       ()                  => staffApiClient.get('/counsellor/account'),
  getTransactions:  (page = 1, limit = 20) => staffApiClient.get(`/counsellor/account/transactions?page=${page}&limit=${limit}`),
  getReferralLink:  ()                  => staffApiClient.get('/counsellor/referral-link'),
  getReferralStats: ()                  => staffApiClient.get('/counsellor/referral-stats'),
  listCoupons:      ()                  => staffApiClient.get('/counsellor/coupons'),
  createCoupon:     (data)              => staffApiClient.post('/counsellor/coupons', data),
  updateCoupon:     (id, data)          => staffApiClient.patch(`/counsellor/coupons/${id}`, data),
  deleteCoupon:     (id)                => staffApiClient.delete(`/counsellor/coupons/${id}`),
  getUpcomingConsultations: ()          => staffApiClient.get('/counsellor/consultations/upcoming'),
  getTraining:      ()                  => staffApiClient.get('/counsellor/training'),
  // Protected file access
  getTrainingFile:     (id)             => staffApiClient.get(`/counsellor/training/${id}/file`,              { responseType: 'blob' }),
  downloadTrainingFile:(id)             => staffApiClient.get(`/counsellor/training/${id}/file?download=true`, { responseType: 'blob' }),
  getPayouts:       ()                  => staffApiClient.get('/counsellor/payouts'),
  getPayoutDetail:  (id)                => staffApiClient.get(`/counsellor/payouts/${id}`),
  // Bank account
  getBankAccount:   ()                  => staffApiClient.get('/counsellor/bank-account'),
  saveBankAccount:  (data)              => staffApiClient.put('/counsellor/bank-account', data),
}

// ─── CCL Biz API (lead staff) ──────────────────────────────────────────────────
export const staffLeadBizApi = {
  getAccount:       ()                  => staffApiClient.get('/staff/account'),
  getTransactions:  (page = 1)          => staffApiClient.get(`/staff/account/transactions?page=${page}`),
  getJoiningLinks:  (page = 1)          => staffApiClient.get(`/staff/joining-links?page=${page}`),
  createJoiningLink: (data)             => staffApiClient.post('/staff/joining-links', data),
  getDiscountPolicy: (planType = 'standard') => staffApiClient.get('/staff/discount-policy', { params: { planType } }),
  getDiscount:      ()                  => staffApiClient.get('/staff/discount'),
  updateDiscount:   (data)              => staffApiClient.put('/staff/discount', data),
  getTraining:      ()                  => staffApiClient.get('/staff/training'),
  getPayouts:       ()                  => staffApiClient.get('/staff/payouts'),
  getPayoutDetail:  (id)                => staffApiClient.get(`/staff/payouts/${id}`),
  // Bank account
  getBankAccount:   ()                  => staffApiClient.get('/staff/bank-account'),
  saveBankAccount:  (data)              => staffApiClient.put('/staff/bank-account', data),
  // Bulk send
  bulkSendJoiningLinks: (data)          => staffApiClient.post('/staff/joining-links/bulk', data),
  // Assigned prospects (leads assigned by admin to this staff member)
  getAssignedProspects: ()              => staffApiClient.get('/staff/assigned-prospects'),
}

// ─── Partner Auth API (public) ────────────────────────────────────────────────
export const partnerAuthApi = {
  register: (data) => api.post('/auth/partner/register', data),
  login:    (data) => api.post('/auth/partner/login', data),
}

// ─── Partner Join API (public) ───────────────────────────────────────────────
export const partnerJoinApi = {
  quote:      (data) => api.post('/partner/join/quote', data),
  createOrder: (data) => api.post('/partner/join/create-order', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verify:     (data) => api.post('/partner/join/verify', data),
}

// ─── Partner Admin API ────────────────────────────────────────────────────────
export const partnerAdminApi = {
  list:              (params)   => adminApiClient.get('/admin/partners', { params }),
  get:               (id)       => adminApiClient.get(`/admin/partners/${id}`),
  approve:           (id)       => adminApiClient.patch(`/admin/partners/${id}/approve`),
  reject:            (id, data) => adminApiClient.patch(`/admin/partners/${id}/reject`, data),
  suspend:           (id, data) => adminApiClient.patch(`/admin/partners/${id}/suspend`, data),
  performance:       (role)     => adminApiClient.get('/admin/partners/performance', { params: { role } }),
  toggleConsultation: (id, data) => adminApiClient.patch(`/admin/partners/${id}/consultation-auth`, data),
  verifyBank:        (id)       => adminApiClient.patch(`/admin/partners/${id}/bank-account/verify`),
  createAdjustment:  (id, data) => adminApiClient.post(`/admin/partners/${id}/adjustments`, data),
  listAdjustments:   (id)       => adminApiClient.get(`/admin/partners/${id}/adjustments`),
}

// ─── Settlement Admin API ─────────────────────────────────────────────────────
export const settlementApi = {
  trigger:   (data)  => adminApiClient.post('/admin/settlement/trigger', data),
  pause:     ()      => adminApiClient.post('/admin/settlement/pause'),
  resume:    ()      => adminApiClient.post('/admin/settlement/resume'),
  getStatus: ()      => adminApiClient.get('/admin/settlement/status'),
  retry:     (id)    => adminApiClient.post(`/admin/settlement/payouts/${id}/retry`),
  clearFlag: (id)    => adminApiClient.post(`/admin/settlement/payouts/${id}/clear-flag`),
  exportCsv: (params)=> adminApiClient.get('/admin/settlement/export', { params, responseType: 'blob' }),
}

// ─── Analytics helper (fire-and-forget from frontend) ────────────────────────
export const trackEvent = (event, metadata = {}) => {
  leadApi.appendEvent(event, metadata).catch(() => {/* silent */})
}

// ─── Consultation API ─────────────────────────────────────────────────────────
export const consultationApi = {
  /** Public — no auth required */
  getAvailability: (token) => api.get('/consultation/availability', { params: { token } }),
  selectSlot: (data) => api.post('/consultation/select-slot', data),
  /** Auth-protected — returns ConsultationBooking or null */
  getMyBooking: () => api.get('/consultation/my'),
  /** Auth-protected — re-sends slot-selection email (30-min cooldown) */
  resend: () => api.post('/consultation/resend'),
  /**
   * Auth-protected — recovery for legacy users who paid ₹9,999 but never
   * received the slot-selection email (no booking record exists).
   * Creates the booking + sends email. If booking already exists, behaves like resend.
   */
  recover: () => api.post('/consultation/recover'),
}

// ─── Scheduling API — Phase 10 ────────────────────────────────────────────────

/** Public: customer slot selection (no auth) */
export const schedulingPublicApi = {
  getAvailableSlots: () => api.get('/scheduling/available-slots'),
  bookSlot: (data)   => api.post('/scheduling/book', data),
}

/** Admin: slot + booking management (uses adminApiClient → cg_admin_token) */
export const adminSchedulingApi = {
  // Slots
  createSlots:   (data)   => adminApiClient.post('/scheduling/slots', data),
  listSlots:     (params) => adminApiClient.get('/scheduling/slots', { params }),
  getSlot:       (id)     => adminApiClient.get(`/scheduling/slots/${id}`),
  blockSlot:     (id)     => adminApiClient.patch(`/scheduling/slots/${id}/block`),
  unblockSlot:   (id)     => adminApiClient.patch(`/scheduling/slots/${id}/unblock`),
  deleteSlot:    (id)     => adminApiClient.delete(`/scheduling/slots/${id}`),
  // Bookings
  listBookings:        (params)       => adminApiClient.get('/scheduling/bookings', { params }),
  getBooking:          (id)           => adminApiClient.get(`/scheduling/bookings/${id}`),
  updateBookingStatus: (id, data)     => adminApiClient.patch(`/scheduling/bookings/${id}/status`, data),
  setMeetLink:         (id, meetLink) => adminApiClient.patch(`/scheduling/bookings/${id}/meet-link`, { meetLink }),
  sendMeetEmail:       (id)           => adminApiClient.post(`/scheduling/bookings/${id}/send-meet`),
}

// ─── Auth API (student account management) ────────────────────────────────────
export const authApi = {
  /**
   * Soft-deletes the authenticated user's account.
   * Requires the current password for confirmation.
   * Returns 200 on success.
   */
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
}

// ─── Admin Staff API (Phase 8) ────────────────────────────────────────────────
export const adminStaffApi = {
  list:         ()              => adminApiClient.get('/admin/staff'),
  listDeleted:  ()              => adminApiClient.get('/admin/staff?showDeleted=true'),
  create:       (data)          => adminApiClient.post('/admin/staff', data),
  updateRole:   (id, role)      => adminApiClient.patch(`/admin/staff/${id}/role`, { role }),
  toggleStatus: (id)            => adminApiClient.patch(`/admin/staff/${id}/status`),
  delete:       (id)            => adminApiClient.delete(`/admin/staff/${id}`),
}

// ─── Admin User API ───────────────────────────────────────────────────────────
export const adminUserApi = {
  list:           (params) => adminApiClient.get('/admin/users', { params }),
  listDeleted:    (params) => adminApiClient.get('/admin/users/deleted', { params }),
  toggleStatus:   (id)     => adminApiClient.put(`/admin/users/${id}/toggle-status`),
  delete:         (id)     => adminApiClient.delete(`/admin/users/${id}`),
}

export default api
