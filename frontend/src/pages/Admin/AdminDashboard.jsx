import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { adminLeadApi } from '../../services/api'

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1')

const adminApi = axios.create({ baseURL: BASE })
adminApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('cg_admin_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

const StatCard = ({ icon, label, value, sub, highlight }) => (
  <div className={`card text-center hover:shadow-lg transition-shadow ${highlight ? 'border-2 border-brand-red bg-red-50' : ''}`}>
    <div className="text-3xl mb-2">{icon}</div>
    <div className="text-3xl font-extrabold text-brand-dark">{value ?? '—'}</div>
    <div className="text-sm font-semibold text-gray-600 mt-1">{label}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
)

const Table = ({ headers, rows, emptyText = 'No data.' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b">
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} className="text-center py-8 text-gray-400">{emptyText}</td></tr>
        ) : rows.map((row, i) => (
          <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-gray-700">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers]         = useState([])
  const [payments, setPayments]   = useState([])
  const [aiStats, setAiStats]     = useState(null)
  const [funnel, setFunnel]       = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]     = useState(true)

  const admin = JSON.parse(localStorage.getItem('cg_admin') || '{}')

  useEffect(() => {
    const token = localStorage.getItem('cg_admin_token')
    if (!token) navigate('/admin/login')
    else loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [analyticsRes, usersRes, paymentsRes, aiStatsRes, funnelRes] = await Promise.all([
        adminLeadApi.getAnalytics(30),
        adminApi.get('/admin/users?limit=50'),
        adminApi.get('/admin/payments?limit=50'),
        adminApi.get('/admin/ai-usage').catch(() => ({ data: { data: null } })),
        adminLeadApi.getFunnel(30).catch(() => ({ data: { data: null } })),
      ])
      setAnalytics(analyticsRes.data.data)
      setUsers(usersRes.data.data?.users || [])
      setPayments(paymentsRes.data.data?.payments || [])
      setAiStats(aiStatsRes.data.data)
      setFunnel(funnelRes.data.data)
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

  const tabs = ['overview', 'leads', 'users', 'payments', 'ai-usage']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <div className="bg-brand-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-lg">⚙️ CAD Gurukul Admin</span>
          <span className="text-xs bg-brand-red px-2 py-0.5 rounded-full">{admin.role || 'ADMIN'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{admin.name}</span>
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
                activeTab === t ? 'bg-brand-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
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
                {/* Funnel metrics */}
                {funnel && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-bold text-gray-900">Conversion Funnel (Last 30 days)</h2>
                      <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
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
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-green-900">Total Revenue (30 days)</div>
                        <div className="text-sm text-green-700">From verified Razorpay payments</div>
                      </div>
                      <div className="text-3xl font-extrabold text-green-700">₹{Number(funnel.totalRevenueRupees).toLocaleString('en-IN')}</div>
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

                {/* Quick links */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card">
                    <h3 className="font-bold text-brand-dark mb-4">Quick Actions</h3>
                    <div className="flex flex-wrap gap-3">
                      <Link to="/admin/leads" className="btn-outline text-sm">👥 Manage Leads</Link>
                      <button onClick={() => handleExport('leads')} className="btn-outline text-sm">⬇ Export Leads CSV</button>
                      <button onClick={loadData} className="btn-secondary text-sm">↻ Refresh</button>
                    </div>
                  </div>
                  {aiStats && (
                    <div className="card">
                      <h3 className="font-bold text-brand-dark mb-4">AI Usage</h3>
                      <div className="space-y-2 text-sm text-gray-700">
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
                  <h3 className="font-bold text-brand-dark text-lg">Lead Management</h3>
                  <Link to="/admin/leads" className="btn-primary text-sm">Open Full Lead Manager →</Link>
                </div>
                <p className="text-sm text-gray-500">Use the full lead manager for filters, search, status updates, and manual actions.</p>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-dark text-lg">Users ({users.length})</h3>
                  <button onClick={() => handleExport('leads')} className="btn-outline text-sm">⬇ Export CSV</button>
                </div>
                <Table
                  headers={['Name', 'Email', 'Role', 'Class', 'City', 'Joined']}
                  rows={users.map((u) => [
                    u.studentProfile?.fullName || u.email.split('@')[0],
                    u.email,
                    u.role,
                    u.studentProfile?.classStandard?.replace('CLASS_', 'Class ') || '—',
                    u.studentProfile?.city || '—',
                    new Date(u.createdAt).toLocaleDateString('en-IN'),
                  ])}
                  emptyText="No users found."
                />
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-brand-dark text-lg">Payments ({payments.length})</h3>
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

            {activeTab === 'ai-usage' && aiStats && (
              <div className="card">
                <h3 className="font-bold text-brand-dark text-lg mb-6">AI Usage Breakdown</h3>
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
          </>
        )}
      </div>
    </div>
  )
}
