import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminLeadApi, adminApiClient as adminApi, adminDiscountApi, adminTrainingApi, adminUserApi, adminEmailApi, partnerAdminApi } from '../../services/api'
import ThemeToggle from '../../components/ThemeToggle'

const StatCard = ({ icon, label, value, sub, highlight }) => (
  <div className={`card text-center hover:shadow-lg transition-shadow ${highlight ? 'border-2 border-brand-red bg-red-50 dark:bg-red-950/30' : ''}`}>
    <div className="text-3xl mb-2">{icon}</div>
    <div className="text-3xl font-extrabold text-brand-dark dark:text-gray-100">{value ?? '—'}</div>
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{label}</div>
    {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
  </div>
)

const Table = ({ headers, rows, emptyText = 'No data.' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} className="text-center py-8 text-gray-400 dark:text-gray-500">{emptyText}</td></tr>
        ) : rows.map((row, i) => (
          <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-gray-700 dark:text-gray-300">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const formatRupees = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [revenueSummary, setRevenueSummary] = useState(null)
  const [users, setUsers]         = useState([])
  const [payments, setPayments]   = useState([])
  const [aiStats, setAiStats]     = useState(null)
  const [funnel, setFunnel]       = useState(null)
  const [emailStatus, setEmailStatus] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]     = useState(true)
  const [emailRefreshing, setEmailRefreshing] = useState(false)
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [performanceLoaded, setPerformanceLoaded] = useState(false)
  const [ccPerformance, setCcPerformance] = useState([])
  const [cclPerformance, setCclPerformance] = useState([])
  const [authorizingCcId, setAuthorizingCcId] = useState(null)

  // Phase 6: Discount policy state
  const [policies, setPolicies]               = useState([])
  const [policyHistory, setPolicyHistory]     = useState([])
  const [policyForm, setPolicyForm]           = useState({ role: 'CAREER_COUNSELLOR_LEAD', planType: 'joining', minPct: 0, maxPct: 20, isActive: true })
  const [policySaving, setPolicySaving]       = useState(false)
  const [discountLoaded, setDiscountLoaded]   = useState(false)
  const [discountSubTab, setDiscountSubTab]   = useState('current') // 'current' | 'history'
  const [deletingPolicyId, setDeletingPolicyId] = useState(null)

  // Phase 6: Training state
  const [trainingItems, setTrainingItems]   = useState([])
  const [trainingHistory, setTrainingHistory] = useState([])
  const [trainingLoaded, setTrainingLoaded] = useState(false)
  const [trainingSubTab, setTrainingSubTab] = useState('active')  // 'active' | 'history'
  const [trainingUploading, setTrainingUploading] = useState(false)
  const [trainingForm, setTrainingForm]     = useState({ title: '', type: 'document', targetRole: 'ALL', isDownloadable: false, url: '' })
  const [trainingFile, setTrainingFile]     = useState(null)
  // User management
  const [deletingUserId, setDeletingUserId]     = useState(null)
  const [usersLoading, setUsersLoading]         = useState(false)
  const [usersSubTab, setUsersSubTab]           = useState('active')   // 'active' | 'deleted'
  const [deletedUsers, setDeletedUsers]         = useState([])
  const [deletedUsersLoading, setDeletedUsersLoading] = useState(false)
  const [deletedUsersLoaded, setDeletedUsersLoaded]   = useState(false)

  const admin = JSON.parse(localStorage.getItem('cg_admin') || '{}')

  useEffect(() => {
    const token = localStorage.getItem('cg_admin_token')
    if (!token) navigate('/admin/login')
    else loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [analyticsRes, usersRes, paymentsRes, aiStatsRes, funnelRes, emailStatusRes, revenueRes] = await Promise.all([
        adminLeadApi.getAnalytics(30),
        adminApi.get('/admin/users?limit=50'),
        adminApi.get('/admin/payments?limit=50'),
        adminApi.get('/admin/ai-usage').catch(() => ({ data: { data: null } })),
        adminLeadApi.getFunnel(30).catch(() => ({ data: { data: null } })),
        adminEmailApi.status().catch(() => ({ data: { data: null } })),
        adminLeadApi.getRevenueSummary().catch(() => ({ data: { data: null } })),
      ])
      setAnalytics(analyticsRes.data.data)
      setRevenueSummary(revenueRes.data.data)
      setUsers(usersRes.data.data?.users || [])
      setPayments(paymentsRes.data.data?.payments || [])
      setAiStats(aiStatsRes.data.data)
      setFunnel(funnelRes.data.data)
      setEmailStatus(emailStatusRes.data.data)
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Session expired.')
        navigate('/admin/login')
      } else {
        toast.error('Failed to load dashboard data.')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadPerformance = async () => {
    setPerformanceLoading(true)
    try {
      const [ccRes, cclRes] = await Promise.all([
        partnerAdminApi.performance('CAREER_COUNSELLOR'),
        partnerAdminApi.performance('CAREER_COUNSELLOR_LEAD'),
      ])
      setCcPerformance(ccRes.data.data?.performance || [])
      setCclPerformance(cclRes.data.data?.performance || [])
      setPerformanceLoaded(true)
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to load performance data.'
      toast.error(msg)
    } finally {
      setPerformanceLoading(false)
    }
  }

  const handleToggleConsultationAuth = async (user) => {
    const nextValue = !user.isConsultationAuthorized
    if (!window.confirm(`Set consultation authorization to ${nextValue ? 'enabled' : 'disabled'} for ${user.name || user.email}?`)) return
    setAuthorizingCcId(user.id)
    try {
      await partnerAdminApi.toggleConsultation(user.id, { authorized: nextValue })
      setCcPerformance((prev) => prev.map((item) => (
        item.id === user.id ? { ...item, isConsultationAuthorized: nextValue } : item
      )))
      toast.success(`Consultation authorization ${nextValue ? 'enabled' : 'disabled'}.`)
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to update authorization.'
      toast.error(msg)
    } finally {
      setAuthorizingCcId(null)
    }
  }

  const renderPartnerStatus = (partner) => {
    if (partner.suspendedAt) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Suspended</span>
    }
    if (!partner.isActive) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Inactive</span>
    }
    if (partner.isApproved) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Approved</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Pending</span>
  }

  const handleExport = async (type) => {
    try {
      const response = await adminApi.get(`/admin/export/${type}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `cadgurukul-${type}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed.')
    }
  }

  const logout = () => {
    localStorage.removeItem('cg_admin_token')
    localStorage.removeItem('cg_admin')
    navigate('/admin/login')
  }

  const refreshEmailStatus = async () => {
    setEmailRefreshing(true)
    try {
      const res = await adminEmailApi.status(true)
      setEmailStatus(res.data.data)
      if (res.data.data?.verified) {
        toast.success('SMTP transport verified.')
      } else {
        toast.error(res.data.data?.lastError || 'SMTP verification failed.')
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to verify SMTP.')
    } finally {
      setEmailRefreshing(false)
    }
  }

  const sendTestEmail = async () => {
    setTestEmailSending(true)
    try {
      const res = await adminEmailApi.sendTest()
      toast.success(res.data.message || 'Test email sent.')
      setEmailStatus(res.data.data?.transport || emailStatus)
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send test email.')
    } finally {
      setTestEmailSending(false)
    }
  }

  // Phase 6 + Phase 9: load discount policies + history
  const loadDiscountPolicies = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        adminDiscountApi.listPolicies(),
        adminDiscountApi.listHistory(),
      ])
      setPolicies(activeRes.data.data || [])
      setPolicyHistory(historyRes.data.data || [])
      setDiscountLoaded(true)
    } catch {
      toast.error('Failed to load discount policies.')
    }
  }

  const handleSavePolicy = async (e) => {
    e.preventDefault()
    setPolicySaving(true)
    // Detect if we're restoring a previously-deleted policy (same role + planType exists in history)
    const isRestore = policyHistory.some(
      (h) => h.role === policyForm.role && h.planType === policyForm.planType
    )
    try {
      await adminDiscountApi.upsertPolicy(policyForm)
      toast.success(isRestore ? 'Policy restored from deleted history.' : 'Discount policy saved.')
      await loadDiscountPolicies()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save policy.')
    } finally {
      setPolicySaving(false)
    }
  }

  const handleDeletePolicy = async (policy) => {
    setDeletingPolicyId(policy.id)
    try {
      await adminDiscountApi.deletePolicy(policy.id)
      toast.success('Discount policy deleted and moved to history.')
      await loadDiscountPolicies()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete policy.')
    } finally {
      setDeletingPolicyId(null)
    }
  }

  // Phase 6: load training items on tab switch
  const loadTraining = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        adminTrainingApi.list(),
        adminTrainingApi.history(),
      ])
      setTrainingItems(activeRes.data.data || [])
      setTrainingHistory(historyRes.data.data || [])
      setTrainingLoaded(true)
    } catch {
      toast.error('Failed to load training content.')
    }
  }

  const handleCreateTraining = async (e) => {
    e.preventDefault()
    setTrainingUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', trainingForm.title)
      formData.append('type', trainingForm.type)
      formData.append('targetRole', trainingForm.targetRole)
      formData.append('isDownloadable', trainingForm.isDownloadable)
      if (trainingFile) {
        formData.append('file', trainingFile)
      } else if (trainingForm.url) {
        formData.append('url', trainingForm.url)
      }
      await adminTrainingApi.create(formData)
      toast.success('Training content added.')
      setTrainingForm({ title: '', type: 'document', targetRole: 'ALL', isDownloadable: false, url: '' })
      setTrainingFile(null)
      await loadTraining()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add training content.')
    } finally {
      setTrainingUploading(false)
    }
  }

  const handleToggleTraining = async (item) => {
    try {
      await adminTrainingApi.update(item.id, { isActive: !item.isActive })
      toast.success(`Training item ${!item.isActive ? 'activated' : 'deactivated'}.`)
      await loadTraining()
    } catch {
      toast.error('Failed to toggle training item.')
    }
  }

  const handleDeleteTraining = async (item) => {
    try {
      await adminTrainingApi.remove(item.id)
      toast.success('Training item deactivated.')
      await loadTraining()
    } catch {
      toast.error('Failed to deactivate training item.')
    }
  }

  const handleOpenTraining = async (item) => {
    if (item.url?.startsWith('http')) {
      window.open(item.url, '_blank')
      return
    }
    if (!item.storagePath) {
      toast.error('No file available for this resource.')
      return
    }
    try {
      const res = await adminTrainingApi.openFile(item.id)
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      toast.error('Could not open file.')
    }
  }

  const handleDownloadTraining = async (item) => {
    if (item.url?.startsWith('http')) {
      const a = document.createElement('a')
      a.href = item.url
      a.download = item.title
      a.target = '_blank'
      a.click()
      return
    }
    if (!item.storagePath) {
      toast.error('No downloadable file for this resource.')
      return
    }
    try {
      const res = await adminTrainingApi.downloadFile(item.id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = item.title
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      toast.error('Download failed.')
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await adminUserApi.list({ limit: 50 })
      setUsers(res.data.data?.users || [])
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to refresh users.')
    } finally {
      setUsersLoading(false)
    }
  }

  const loadDeletedUsers = async () => {
    setDeletedUsersLoading(true)
    try {
      const res = await adminUserApi.listDeleted({ limit: 100 })
      setDeletedUsers(res.data.data?.users || [])
      setDeletedUsersLoaded(true)
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to load deleted users.')
    } finally {
      setDeletedUsersLoading(false)
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete "${userName}"? This will revoke their login access immediately.`)) return
    setDeletingUserId(userId)
    try {
      await adminUserApi.delete(userId)
      toast.success(`"${userName}" deleted. Login access revoked.`)
      // Re-fetch from backend to ensure list is accurate (not optimistic)
      await loadUsers()
      // Invalidate deleted-users cache so it re-fetches on next switch
      setDeletedUsersLoaded(false)
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to delete user.'
      toast.error(msg)
    } finally {
      setDeletingUserId(null)
    }
  }

  useEffect(() => {
    if (activeTab === 'discounts' && !discountLoaded) loadDiscountPolicies()
    if (activeTab === 'training' && !trainingLoaded) loadTraining()
    if (activeTab === 'performance' && !performanceLoaded && !performanceLoading) loadPerformance()
  }, [activeTab])

  useEffect(() => {
    if (usersSubTab === 'deleted' && !deletedUsersLoaded) loadDeletedUsers()
  }, [usersSubTab])

  const tabs = ['overview', 'leads', 'users', 'payments', 'performance', 'ai-usage', 'discounts', 'training']

  const ccRows = ccPerformance.map((partner) => ([
    partner.name || '—',
    partner.email || '—',
    renderPartnerStatus(partner),
    formatRupees(partner.totalSalesPaise),
    formatRupees(partner.totalNetPaise),
    formatRupees(partner.totalCommissionPaise),
    partner.totalSalesCount || 0,
    <div key="auth" className="flex items-center gap-2">
      <span className={`text-xs font-semibold ${partner.isConsultationAuthorized ? 'text-green-600' : 'text-gray-500'}`}>
        {partner.isConsultationAuthorized ? 'Authorized' : 'Not authorized'}
      </span>
      <button
        onClick={() => handleToggleConsultationAuth(partner)}
        disabled={authorizingCcId === partner.id}
        className="btn-outline text-xs"
      >
        {authorizingCcId === partner.id ? 'Updating…' : (partner.isConsultationAuthorized ? 'Disable' : 'Enable')}
      </button>
    </div>,
  ]))

  const cclRows = cclPerformance.map((partner) => ([
    partner.name || '—',
    partner.email || '—',
    renderPartnerStatus(partner),
    formatRupees(partner.totalSalesPaise),
    formatRupees(partner.totalNetPaise),
    formatRupees(partner.totalCommissionPaise),
    partner.totalSalesCount || 0,
  ]))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Navbar */}
      <div className="bg-brand-dark dark:bg-gray-900 border-b border-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-lg">⚙️ CAD Gurukul Admin</span>
          <span className="text-xs bg-brand-red px-2 py-0.5 rounded-full">{admin.role || 'ADMIN'}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin/staff" className="text-sm text-gray-300 hover:text-white transition-colors">👥 Staff</Link>
          <Link to="/admin/consultations" className="text-sm text-gray-300 hover:text-white transition-colors">📅 Consultations</Link>
          <Link to="/admin/partners" className="text-sm text-gray-300 hover:text-white transition-colors">🤝 Partners</Link>
          <Link to="/admin/payouts" className="text-sm text-gray-300 hover:text-white transition-colors">💰 Payouts</Link>
          <span className="text-sm text-gray-300">{admin.name}</span>
          <ThemeToggle />
          <button onClick={logout} className="text-sm hover:text-brand-red transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap transition-all ${
                activeTab === t ? 'bg-brand-red text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'
              }`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div>
                {/* Scheduling quick-link card */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Link to="/admin/scheduling" className="block rounded-2xl border-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-3xl">📅</span>
                      <span className="font-bold text-lg text-indigo-900 dark:text-indigo-200">Scheduling & Bookings</span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">Manage availability slots, bookings, and Google Meet links for all consultations.</div>
                  </Link>
                </div>
                {/* Funnel metrics */}
                {funnel && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-bold text-gray-900 dark:text-gray-100">Conversion Funnel (Last 30 days)</h2>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-1 rounded-full">
                        {funnel.conversionRate} conversion rate
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      {[
                        { icon: '📥', label: 'Total Leads',        value: funnel.funnel.totalLeads },
                        { icon: '📝', label: 'Assessment Started', value: funnel.funnel.assessmentStarted },
                        { icon: '✅', label: 'Assessment Done',    value: funnel.funnel.assessmentCompleted },
                        { icon: '📊', label: 'Free Report',        value: funnel.funnel.freeReportReady },
                        { icon: '💳', label: 'Paid',               value: funnel.funnel.paid, highlight: true },
                        { icon: '📄', label: 'Premium Report',     value: funnel.funnel.premiumReportReady },
                        { icon: '📞', label: 'Counselling',        value: funnel.funnel.counsellingInterested },
                      ].map((m) => (
                        <StatCard key={m.label} icon={m.icon} label={m.label} value={m.value} highlight={m.highlight} />
                      ))}
                    </div>

                    {/* Revenue */}
                    <div className="mt-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-green-900 dark:text-green-300">Total Revenue (30 days)</div>
                        <div className="text-sm text-green-700 dark:text-green-400">From verified Razorpay payments</div>
                      </div>
                      <div className="text-3xl font-extrabold text-green-700 dark:text-green-400">₹{Number(funnel.totalRevenueRupees).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                )}

                {/* General analytics */}
                {analytics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard icon="👤" label="Total Users"        value={analytics.totalUsers} />
                    <StatCard icon="📋" label="Total Assessments"  value={analytics.totalAssessments} />
                    <StatCard icon="💰" label="All-time Revenue"   value={`₹${Number(analytics.totalRevenueRupees || 0).toLocaleString('en-IN')}`} />
                    <StatCard icon="📄" label="Reports Generated"  value={analytics.totalCompletedReports} />
                  </div>
                )}

                {revenueSummary && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">Revenue Snapshot</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Captured payments only</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard icon="🏁" label="All-time" value={formatRupees(revenueSummary.allTimePaise)} highlight />
                      <StatCard icon="🗓️" label="This Month" value={formatRupees(revenueSummary.monthPaise)} />
                      <StatCard icon="📆" label="This Week" value={formatRupees(revenueSummary.weekPaise)} />
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card">
                    <h3 className="font-bold text-brand-dark dark:text-gray-100 mb-4">Quick Actions</h3>
                    <div className="flex flex-wrap gap-3">
                      <Link to="/admin/leads" className="btn-outline text-sm">👥 Manage Leads</Link>
                      <Link to="/admin/consultations" className="btn-outline text-sm">📅 Consultations</Link>
                      <button onClick={() => handleExport('leads')} className="btn-outline text-sm">⬇ Export Leads CSV</button>
                      <button onClick={loadData} className="btn-secondary text-sm">↻ Refresh</button>
                    </div>
                  </div>
                  <div className="card">
                    <h3 className="font-bold text-brand-dark dark:text-gray-100 mb-4">Email Health</h3>
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between"><span>Configured</span><strong>{emailStatus?.configured ? 'Yes' : 'No'}</strong></div>
                      <div className="flex justify-between"><span>Verified</span><strong className={emailStatus?.verified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{emailStatus?.verified ? 'Yes' : 'No'}</strong></div>
                      <div className="flex justify-between"><span>SMTP Host</span><strong>{emailStatus?.host || '—'}</strong></div>
                      <div className="flex justify-between"><span>SMTP Port</span><strong>{emailStatus?.port || '—'}</strong></div>
                      <div className="flex justify-between"><span>TLS Mode</span><strong>{emailStatus ? (emailStatus.secure ? 'SSL/TLS (port 465)' : 'STARTTLS (port 587)') : '—'}</strong></div>
                      <div className="flex justify-between"><span>SMTP User</span><strong>{emailStatus?.user || '—'}</strong></div>
                      <div className="flex justify-between"><span>Last Check</span><strong>{emailStatus?.lastVerifiedAt ? new Date(emailStatus.lastVerifiedAt).toLocaleString('en-IN') : '—'}</strong></div>
                    </div>
                    {emailStatus?.lastError && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {emailStatus.lastError.includes('535') || emailStatus.lastError.includes('authentication') || emailStatus.lastError.includes('credentials')
                          ? '⚠️ Authentication failed — check SMTP_USER / SMTP_PASS in your environment config.'
                          : emailStatus.lastError.includes('ECONNREFUSED') || emailStatus.lastError.includes('ETIMEDOUT') || emailStatus.lastError.includes('ENOTFOUND')
                          ? '⚠️ Cannot reach SMTP server — check SMTP_HOST / SMTP_PORT and network connectivity.'
                          : emailStatus.lastError.includes('certificate') || emailStatus.lastError.includes('SSL') || emailStatus.lastError.includes('TLS')
                          ? '⚠️ TLS/SSL handshake error — verify SMTP_SECURE and port settings.'
                          : `⚠️ ${emailStatus.lastError}`}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={refreshEmailStatus} disabled={emailRefreshing} className="btn-outline text-sm">
                        {emailRefreshing ? 'Verifying…' : 'Verify SMTP'}
                      </button>
                      <button onClick={sendTestEmail} disabled={testEmailSending} className="btn-secondary text-sm">
                        {testEmailSending ? 'Sending…' : 'Send Test Email'}
                      </button>
                    </div>
                  </div>
                  {aiStats && (
                    <div className="card">
                      <h3 className="font-bold text-brand-dark dark:text-gray-100 mb-4">AI Usage</h3>
                      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex justify-between"><span>Total AI calls</span><strong>{aiStats.totals?._count?.id || 0}</strong></div>
                        <div className="flex justify-between"><span>Total tokens</span><strong>{(aiStats.totals?._sum?.totalTokens || 0).toLocaleString()}</strong></div>
                        <div className="flex justify-between"><span>Avg latency</span><strong>{Math.round(aiStats.totals?._avg?.latencyMs || 0)}ms</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Lead Management</h3>
                  <Link to="/admin/leads" className="btn-primary text-sm">Open Full Lead Manager →</Link>
                </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Use the full lead manager for filters, search, status updates, and manual actions.</p>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="card">
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Users</h3>
                    {/* Sub-tab pills */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                      {[{ key: 'active', label: `Active (${users.length})` }, { key: 'deleted', label: `Deleted (${deletedUsers.length})` }].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setUsersSubTab(key)}
                          className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                            usersSubTab === key
                              ? 'bg-white dark:bg-gray-700 text-brand-dark dark:text-gray-100 shadow-sm'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {usersSubTab === 'active' ? (
                      <>
                        <button
                          onClick={loadUsers}
                          disabled={usersLoading}
                          className="btn-outline text-sm flex items-center gap-1.5 disabled:opacity-50"
                          title="Refresh user list from server"
                        >
                          <span className={usersLoading ? 'animate-spin inline-block' : ''}>↻</span>
                          {usersLoading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        <button onClick={() => handleExport('leads')} className="btn-outline text-sm">⬇ Export CSV</button>
                      </>
                    ) : (
                      <button
                        onClick={loadDeletedUsers}
                        disabled={deletedUsersLoading}
                        className="btn-outline text-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className={deletedUsersLoading ? 'animate-spin inline-block' : ''}>↻</span>
                        {deletedUsersLoading ? 'Refreshing…' : 'Refresh'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Active users table */}
                {usersSubTab === 'active' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                          {['Name', 'Email', 'Role', 'Class', 'City', 'Joined', 'Status', 'Action'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">Loading users…</td></tr>
                        ) : users.filter(u => !u.email?.endsWith('@deleted.cadgurukul.internal')).length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">No active users found.</td></tr>
                        ) : users.filter(u => !u.email?.endsWith('@deleted.cadgurukul.internal')).map((u) => (
                          <tr key={u.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.studentProfile?.fullName || u.email.split('@')[0]}</td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{u.role}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.studentProfile?.classStandard?.replace('CLASS_', 'Class ') || '—'}</td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.studentProfile?.city || '—'}</td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                u.isActive
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                  : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {u.role === 'ADMIN' ? (
                                <span className="text-xs text-gray-400 dark:text-gray-600 italic">Protected</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.studentProfile?.fullName || u.email)}
                                  disabled={deletingUserId === u.id || usersLoading}
                                  className="text-xs px-3 py-1 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold transition disabled:opacity-40"
                                >
                                  {deletingUserId === u.id ? '…' : 'Delete'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Deleted users history table */}
                {usersSubTab === 'deleted' && (
                  <div className="overflow-x-auto">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Soft-deleted accounts. Email has been anonymised — original address is free for re-registration.
                    </p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                          {['Name', 'Anonymised Email', 'Role', 'Class', 'City', 'Registered', 'Deleted On'].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deletedUsersLoading ? (
                          <tr><td colSpan={7} className="text-center py-8 text-gray-400 dark:text-gray-500">Loading deleted users…</td></tr>
                        ) : deletedUsers.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 text-gray-400 dark:text-gray-500">No deleted users.</td></tr>
                        ) : deletedUsers.map((u) => (
                          <tr key={u.id} className="border-b dark:border-gray-700 opacity-70">
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.studentProfile?.fullName || '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{u.role}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.studentProfile?.classStandard?.replace('CLASS_', 'Class ') || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.studentProfile?.city || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                            <td className="px-4 py-3 text-red-400 dark:text-red-500 font-medium">{new Date(u.deletedAt).toLocaleDateString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Payments ({payments.length})</h3>
                  <button onClick={() => handleExport('payments')} className="btn-outline text-sm">⬇ Export CSV</button>
                </div>
                <Table
                  headers={['User', 'Amount', 'Status', 'Provider', 'Date']}
                  rows={payments.map((p) => [
                    p.user?.name || p.userId,
                    `₹${((p.amountPaise || 0) / 100).toLocaleString('en-IN')}`,
                    <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.status === 'CAPTURED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>,
                    p.provider || 'RAZORPAY',
                    new Date(p.createdAt).toLocaleDateString('en-IN'),
                  ])}
                  emptyText="No payments yet."
                />
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="space-y-6">
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Counsellor Performance</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Lifetime totals from confirmed sales.</p>
                    </div>
                    <button
                      onClick={loadPerformance}
                      disabled={performanceLoading}
                      className="btn-outline text-sm"
                    >
                      {performanceLoading ? 'Refreshing…' : '↻ Refresh'}
                    </button>
                  </div>
                  <Table
                    headers={['Name', 'Email', 'Status', 'Gross Sales', 'Net Sales', 'Commission', 'Sales', 'Consultation']}
                    rows={ccRows}
                    emptyText={performanceLoading ? 'Loading performance…' : 'No counsellors found.'}
                  />
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">CCL Performance</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Lifetime totals from confirmed sales.</p>
                    </div>
                  </div>
                  <Table
                    headers={['Name', 'Email', 'Status', 'Gross Sales', 'Net Sales', 'Commission', 'Sales']}
                    rows={cclRows}
                    emptyText={performanceLoading ? 'Loading performance…' : 'No CCL partners found.'}
                  />
                </div>
              </div>
            )}

            {activeTab === 'ai-usage' && aiStats && (
              <div className="card">
                <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg mb-6">AI Usage Breakdown</h3>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <StatCard icon="🤖" label="Total AI Sessions" value={aiStats.totals?._count?.id || 0} />
                  <StatCard
                    icon="🟢"
                    label="OpenAI"
                    value={(aiStats.byProvider || []).filter((r) => r.provider === 'OPENAI').reduce((sum, r) => sum + (r._count?.id || 0), 0)}
                    sub="Paid report heavy"
                  />
                  <StatCard
                    icon="🔵"
                    label="Gemini"
                    value={(aiStats.byProvider || []).filter((r) => r.provider === 'GEMINI').reduce((sum, r) => sum + (r._count?.id || 0), 0)}
                    sub="Question + free flow"
                  />
                </div>
                <Table
                  headers={['Provider', 'Model', 'Calls', 'Total Tokens', 'Prompt/Completion']}
                  rows={(aiStats.byProvider || []).map((s) => [
                    s.provider,
                    s.model,
                    s._count?.id || 0,
                    (s._sum?.totalTokens || 0).toLocaleString('en-IN'),
                    `${(s._sum?.promptTokens || 0).toLocaleString('en-IN')} / ${(s._sum?.completionTokens || 0).toLocaleString('en-IN')}`,
                  ])}
                  emptyText="No AI usage recorded."
                />
              </div>
            )}

            {/* ── Phase 6: Discount Policies ── */}
            {activeTab === 'discounts' && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg mb-4">Discount Policy Editor</h3>
                  <form onSubmit={handleSavePolicy} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Role</label>
                      <select value={policyForm.role} onChange={(e) => setPolicyForm((f) => ({ ...f, role: e.target.value }))} className="input-field text-sm w-full">
                        <option value="CAREER_COUNSELLOR_LEAD">Career Counsellor Lead (CCL)</option>
                        <option value="CAREER_COUNSELLOR">Career Counsellor (CC)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Plan Type</label>
                      <select value={policyForm.planType} onChange={(e) => setPolicyForm((f) => ({ ...f, planType: e.target.value }))} className="input-field text-sm w-full">
                        <option value="joining">joining (CCL joining fee)</option>
                        <option value="standard">standard (₹12,000 plan)</option>
                        <option value="499plan">499plan (₹499 plan)</option>
                        <option value="premium">premium</option>
                        <option value="consultation">consultation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Min Discount %</label>
                      <input type="number" min="0" max="100" step="0.5" value={policyForm.minPct} onChange={(e) => setPolicyForm((f) => ({ ...f, minPct: Number(e.target.value) }))} className="input-field text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Max Discount %</label>
                      <input type="number" min="0" max="100" step="0.5" value={policyForm.maxPct} onChange={(e) => setPolicyForm((f) => ({ ...f, maxPct: Number(e.target.value) }))} className="input-field text-sm w-full" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="policyActive" checked={policyForm.isActive} onChange={(e) => setPolicyForm((f) => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                      <label htmlFor="policyActive" className="text-sm text-gray-700 dark:text-gray-300">Policy active</label>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" disabled={policySaving} className="btn-primary text-sm w-full">
                        {policySaving ? 'Saving…' : 'Save Policy'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">
                        {discountSubTab === 'current' ? `Current Policies (${policies.length})` : `Deleted History (${policyHistory.length})`}
                      </h3>
                      <div className="flex gap-1">
                        {[
                          { key: 'current', label: 'Current' },
                          { key: 'history', label: '🗑 Deleted History' },
                        ].map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setDiscountSubTab(key)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${discountSubTab === key ? 'bg-brand-red text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={loadDiscountPolicies} className="btn-secondary text-sm">↻ Refresh</button>
                  </div>
                  {discountSubTab === 'current' ? (
                    <Table
                      headers={['Role', 'Plan Type', 'Min %', 'Max %', 'Active', 'Action']}
                      rows={policies.map((p) => [
                        p.role === 'CAREER_COUNSELLOR_LEAD' ? 'CCL' : 'CC',
                        p.planType,
                        `${p.minPct}%`,
                        `${p.maxPct}%`,
                        p.isActive
                          ? <span key="a" className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">Active</span>
                          : <span key="i" className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Inactive</span>,
                        <button
                          key="del"
                          onClick={() => handleDeletePolicy(p)}
                          disabled={deletingPolicyId === p.id}
                          className="text-xs px-2 py-1 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold transition disabled:opacity-50"
                        >
                          {deletingPolicyId === p.id ? '…' : '🗑 Delete'}
                        </button>,
                      ])}
                      emptyText="No active discount policies. Add one above."
                    />
                  ) : (
                    <Table
                      headers={['Role', 'Plan Type', 'Min %', 'Max %', 'Deleted On']}
                      rows={policyHistory.map((p) => [
                        p.role === 'CAREER_COUNSELLOR_LEAD' ? 'CCL' : 'CC',
                        p.planType,
                        `${p.minPct}%`,
                        `${p.maxPct}%`,
                        p.deletedAt ? new Date(p.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
                      ])}
                      emptyText="No deleted policies."
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Phase 6: Training Content Management ── */}
            {activeTab === 'training' && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg mb-4">Add Training Content</h3>
                  <form onSubmit={handleCreateTraining} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                      <input type="text" required value={trainingForm.title} onChange={(e) => setTrainingForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Career Counselling Guide" className="input-field text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Type</label>
                      <select value={trainingForm.type} onChange={(e) => setTrainingForm((f) => ({ ...f, type: e.target.value }))} className="input-field text-sm w-full">
                        <option value="document">Document</option>
                        <option value="video">Video</option>
                        <option value="book">Book</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Target Role</label>
                      <select value={trainingForm.targetRole} onChange={(e) => setTrainingForm((f) => ({ ...f, targetRole: e.target.value }))} className="input-field text-sm w-full">
                        <option value="ALL">All Staff (CCL + CC)</option>
                        <option value="CCL">CCL Only</option>
                        <option value="CC">CC Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">URL (if no file upload)</label>
                      <input type="url" value={trainingForm.url} onChange={(e) => setTrainingForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." className="input-field text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">File Upload (pdf, docx, mp4, etc.)</label>
                      <input type="file" accept=".pdf,.txt,.epub,.mp4,.mkv,.doc,.docx" onChange={(e) => setTrainingFile(e.target.files[0] || null)} className="text-sm w-full" />
                      <p className="text-xs text-gray-400 mt-0.5">Max 200MB (video), 50MB (document)</p>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="isDownloadable" checked={trainingForm.isDownloadable} onChange={(e) => setTrainingForm((f) => ({ ...f, isDownloadable: e.target.checked }))} className="w-4 h-4" />
                      <label htmlFor="isDownloadable" className="text-sm text-gray-700 dark:text-gray-300">Downloadable by staff</label>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" disabled={trainingUploading} className="btn-primary text-sm w-full">
                        {trainingUploading ? 'Uploading…' : 'Add Content'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Training Library ({trainingItems.length})</h3>
                      <div className="flex gap-1">
                        {['active', 'history'].map((st) => (
                          <button
                            key={st}
                            onClick={() => setTrainingSubTab(st)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${trainingSubTab === st ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {st === 'history' ? '🗑 Deleted History' : 'Active'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={loadTraining} className="btn-secondary text-sm">↻ Refresh</button>
                  </div>
                  {trainingSubTab === 'active' ? (
                    <Table
                      headers={['Title', 'Type', 'Target', 'Downloadable', 'Active', 'Actions']}
                      rows={trainingItems.map((item) => [
                        item.title,
                        item.type,
                        item.targetRole,
                        item.isDownloadable ? '✅' : '—',
                        item.isActive
                          ? <span key="a" className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Active</span>
                          : <span key="i" className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Hidden</span>,
                        <div key="actions" className="flex gap-2 flex-wrap">
                          {(item.storagePath || item.url?.startsWith('http')) && (
                            <button onClick={() => handleOpenTraining(item)} className="text-xs text-blue-600 hover:underline">
                              Open
                            </button>
                          )}
                          {(item.storagePath || item.url?.startsWith('http')) && (
                            <button onClick={() => handleDownloadTraining(item)} className="text-xs text-purple-600 hover:underline">
                              ⬇
                            </button>
                          )}
                          <button onClick={() => handleToggleTraining(item)} className="text-xs text-blue-600 hover:underline">
                            {item.isActive ? 'Hide' : 'Show'}
                          </button>
                          <button onClick={() => handleDeleteTraining(item)} className="text-xs text-red-600 hover:underline">
                            Delete
                          </button>
                        </div>,
                      ])}
                      emptyText="No training content yet. Add some above."
                    />
                  ) : (
                    <Table
                      headers={['Title', 'Type', 'Target', 'Deleted On']}
                      rows={trainingHistory.map((item) => [
                        item.title,
                        item.type,
                        item.targetRole,
                        item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
                      ])}
                      emptyText="No deleted training items."
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
