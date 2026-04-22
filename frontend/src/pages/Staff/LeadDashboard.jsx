import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { staffApiClient, staffLeadApi, staffApi, staffLeadBizApi } from '../../services/api'
import ThemeToggle from '../../components/ThemeToggle'

const StatCard = ({ icon, label, value }) => (
  <div className="card text-center hover:shadow-lg transition-shadow">
    <div className="text-3xl mb-2">{icon}</div>
    <div className="text-3xl font-extrabold text-brand-dark dark:text-gray-100">{value ?? '—'}</div>
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{label}</div>
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

const STATUS_LABELS = {
  new_lead: 'New Lead',
  onboarding_started: 'Onboarding',
  assessment_started: 'Assessment Started',
  assessment_completed: 'Assessment Done',
  free_report_ready: 'Free Report Ready',
  paid: 'Paid',
  premium_report_ready: 'Premium Report',
  counselling_interested: 'Counselling',
  closed: 'Closed',
}

export default function LeadDashboard() {
  const navigate = useNavigate()
  const [leads, setLeads]       = useState([])
  const [students, setStudents] = useState([])
  const [reports, setReports]   = useState([])
  const [stats, setStats]       = useState({ leads: 0, students: 0, reports: 0 })
  const [activeTab, setActiveTab] = useState('leads')
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // ── Phase 4: CCL business layer state ──────────────────────────────────────
  const [account, setAccount]         = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txPage, setTxPage]           = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)
  const [joiningLinks, setJoiningLinks] = useState([])
  const [payouts, setPayouts]         = useState([])
  const [training, setTraining]       = useState([])
  const [bizLoading, setBizLoading]   = useState(false)
  const [linkFormOpen, setLinkFormOpen] = useState(false)
  const [newLink, setNewLink] = useState({ candidateName: '', candidateEmail: '', candidatePhone: '', expiresInDays: '', discountPct: 0, applyDiscount: false })
  const [linkCreating, setLinkCreating] = useState(false)
  // Phase 6: discount policy (fetched on joining-links tab open)
  const [discountPolicy, setDiscountPolicy] = useState({ minPct: 0, maxPct: 20, isActive: true })
  // Assigned Prospects
  const [prospects, setProspects]     = useState([])
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const prospectsLastFetched = useRef(null) // 30-second cache TTL

  const staff = JSON.parse(localStorage.getItem('cg_staff') || '{}')

  useEffect(() => {
    const token = localStorage.getItem('cg_staff_token')
    if (!token) navigate('/staff/login')
    else loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [leadsRes, studentsRes, reportsRes] = await Promise.all([
        staffLeadApi.list({ limit: 50 }),
        staffApiClient.get('/staff/students?limit=20'),
        staffApiClient.get('/staff/reports?limit=20'),
      ])
      const leadsData    = leadsRes.data.data
      const studentsData = studentsRes.data.data
      const reportsData  = reportsRes.data.data

      setLeads(leadsData?.leads || [])
      setStudents(studentsData?.users || [])
      setReports(reportsData?.reports || [])
      setStats({
        leads:    leadsData?.total    ?? 0,
        students: studentsData?.total ?? 0,
        reports:  reportsData?.total  ?? 0,
      })
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Session expired.')
        navigate('/staff/login')
      } else {
        toast.error('Failed to load dashboard data.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLeadSearch = async () => {
    try {
      const params = { limit: 50 }
      if (search)       params.search = search
      if (statusFilter) params.status = statusFilter
      const res = await staffLeadApi.list(params)
      setLeads(res.data.data?.leads || [])
    } catch {
      toast.error('Search failed.')
    }
  }

  const logout = () => {
    localStorage.removeItem('cg_staff_token')
    localStorage.removeItem('cg_staff_refresh_token')
    localStorage.removeItem('cg_staff')
    navigate('/staff/login')
  }

  // ── Phase 4: load CCL business data ────────────────────────────────────────
  const loadBizData = useCallback(async (tab) => {
    setBizLoading(true)
    try {
      if (tab === 'account') {
        const [accRes, txRes] = await Promise.all([
          staffApi.getAccount(),
          staffApi.getTransactions({ page: 1, limit: 15 }),
        ])
        setAccount(accRes.data.data)
        const txData = txRes.data.data
        setTransactions(Array.isArray(txData) ? txData : txData?.items || [])
        setTxPage(txData?.page || 1)
        setTxTotalPages(txData?.totalPages || 1)
      } else if (tab === 'joining-links') {
        // Phase 6: fetch discount policy and links in parallel
        const [res, policyRes] = await Promise.all([
          staffApi.getJoiningLinks(),
          staffApi.getDiscountPolicy('joining').catch(() => ({ data: { data: { minPct: 0, maxPct: 20, isActive: true } } })),
        ])
        setJoiningLinks(res.data.data?.links || [])
        setDiscountPolicy(policyRes.data.data || { minPct: 0, maxPct: 20, isActive: true })
      } else if (tab === 'payouts') {
        const res = await staffApi.getPayouts()
        setPayouts(res.data.data || [])
      } else if (tab === 'training') {
        const res = await staffApi.getTraining()
        setTraining(res.data.data || [])
      }
    } catch {
      toast.error('Failed to load data.')
    } finally {
      setBizLoading(false)
    }
  }, [])

  const fetchProspects = useCallback((force = false) => {
    const now = Date.now()
    if (!force && prospectsLastFetched.current && now - prospectsLastFetched.current < 30_000) return
    setProspectsLoading(true)
    staffLeadBizApi.getAssignedProspects()
      .then((r) => { setProspects(r.data.data?.prospects || []); prospectsLastFetched.current = Date.now() })
      .catch(() => toast.error('Failed to load assigned prospects'))
      .finally(() => setProspectsLoading(false))
  }, [])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    const bizTabs = ['account', 'joining-links', 'payouts', 'training']
    if (bizTabs.includes(tab)) loadBizData(tab)
    if (tab === 'assigned-prospects') fetchProspects()
  }

  const loadTxPage = async (page) => {
    setBizLoading(true)
    try {
      const res = await staffApi.getTransactions({ page, limit: 15 })
      const txData = res.data.data
      setTransactions(Array.isArray(txData) ? txData : txData?.items || [])
      setTxPage(txData?.page || page)
      setTxTotalPages(txData?.totalPages || 1)
    } catch {
      toast.error('Failed to load transactions.')
    } finally {
      setBizLoading(false)
    }
  }

  const handleCreateLink = async (e) => {
    e.preventDefault()
    setLinkCreating(true)
    try {
      const payload = {}
      if (newLink.candidateName)  payload.candidateName  = newLink.candidateName
      if (newLink.candidateEmail) payload.candidateEmail = newLink.candidateEmail
      if (newLink.candidatePhone) payload.candidatePhone = newLink.candidatePhone
      if (newLink.expiresInDays)  payload.expiresInDays  = Number(newLink.expiresInDays)
      if (newLink.applyDiscount && Number(newLink.discountPct) > 0) {
        payload.discountPct = Number(newLink.discountPct)
      }
      const res = await staffApi.createJoiningLink(payload)
      setJoiningLinks((prev) => [res.data.data, ...prev])
      setNewLink({ candidateName: '', candidateEmail: '', candidatePhone: '', expiresInDays: '', discountPct: 0, applyDiscount: false })
      setLinkFormOpen(false)
      toast.success('Joining link created!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create link.')
    } finally {
      setLinkCreating(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Link copied!')).catch(() => toast.error('Copy failed.'))
  }

  const formatPaise = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const tabs = ['leads', 'students', 'reports', 'account', 'joining-links', 'payouts', 'training', 'assigned-prospects']

  const TAB_LABELS = {
    leads: '👥 Leads',
    students: '🎓 Students',
    reports: '📄 Reports',
    account: '💰 Account',
    'joining-links': '🔗 Joining Links',
    payouts: '💳 Payouts',
    training: '📚 Training',
    'assigned-prospects': '📌 Assigned Prospects',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Navbar */}
      <div className="bg-brand-dark dark:bg-gray-900 border-b border-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-lg">🎓 CAD Gurukul — Staff Portal</span>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{staff.role || 'CAREER_COUNSELLOR_LEAD'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{staff.name}</span>
          <ThemeToggle />
          <button onClick={logout} className="text-sm hover:text-brand-red transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon="👥" label="Total Leads"    value={stats.leads}    />
          <StatCard icon="🎓" label="Total Students" value={stats.students} />
          <StatCard icon="📄" label="Total Reports"  value={stats.reports}  />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === t ? 'bg-brand-red text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'
              }`}
            >
              {TAB_LABELS[t] || t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === 'leads' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-bold text-brand-dark text-lg">Leads ({stats.leads})</h3>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLeadSearch()}
                      placeholder="Search name / email…"
                      className="input-field text-sm w-48"
                    />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="input-field text-sm w-44"
                    >
                      <option value="">All Statuses</option>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <button onClick={handleLeadSearch} className="btn-primary text-sm">Search</button>
                    <button onClick={loadData} className="btn-secondary text-sm">Reset</button>
                  </div>
                </div>
                <Table
                  headers={['Name', 'Email', 'Mobile', 'Class', 'Status', 'Source', 'Joined']}
                  rows={leads.map((l) => [
                    l.fullName,
                    l.email,
                    l.mobileNumber,
                    l.classStandard ? `Class ${l.classStandard}` : '—',
                    <span key="s" className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {STATUS_LABELS[l.status] || l.status}
                    </span>,
                    l.leadSource,
                    new Date(l.createdAt).toLocaleDateString('en-IN'),
                  ])}
                  emptyText="No leads found."
                />
              </div>
            )}

            {activeTab === 'students' && (
              <div className="card">
                <h3 className="font-bold text-brand-dark text-lg mb-4">Students ({stats.students})</h3>
                <Table
                  headers={['Name', 'Email', 'Class', 'City', 'Active', 'Joined']}
                  rows={students.map((u) => [
                    u.studentProfile?.fullName || u.email.split('@')[0],
                    u.email,
                    u.studentProfile?.classStandard?.replace('CLASS_', 'Class ') || '—',
                    u.studentProfile?.city || '—',
                    u.isActive ? '✅' : '❌',
                    new Date(u.createdAt).toLocaleDateString('en-IN'),
                  ])}
                  emptyText="No students found."
                />
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="card">
                <h3 className="font-bold text-brand-dark text-lg mb-4">Reports ({stats.reports})</h3>
                <Table
                  headers={['Report ID', 'Access', 'Status', 'Stream', 'Confidence', 'Generated']}
                  rows={reports.map((r) => [
                    r.id.slice(0, 8) + '…',
                    <span key="a" className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.accessLevel === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{r.accessLevel}</span>,
                    r.status,
                    r.recommendedStream || '—',
                    r.confidenceScore ? `${r.confidenceScore.toFixed(0)}%` : '—',
                    r.generatedAt ? new Date(r.generatedAt).toLocaleDateString('en-IN') : '—',
                  ])}
                  emptyText="No reports found."
                />
              </div>
            )}

            {/* ── Phase 4: Account ─────────────────────────────────────── */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {bizLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard icon="💼" label="Total Sales"       value={formatPaise(account?.totalSalesPaise)} />
                      <StatCard icon="💸" label="Total Commission"  value={formatPaise(account?.totalCommissionPaise)} />
                      <StatCard icon="⏳" label="Pending Payout"    value={formatPaise(account?.pendingPayoutPaise)} />
                      <StatCard icon="✅" label="Paid Out"          value={formatPaise(account?.paidAmountPaise)} />
                    </div>

                    {account?.nextPayoutDate && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-sm text-blue-700 font-medium">
                        📅 Next payout scheduled: <strong>{account.nextPayoutDate}</strong> (Thursday)
                      </div>
                    )}

                    <div className="card">
                      <h3 className="font-bold text-brand-dark text-lg mb-4">Transaction History</h3>
                      {transactions.length === 0 ? (
                        <p className="text-gray-400 text-sm py-6 text-center">No transactions yet. Sales attributed to you will appear here.</p>
                      ) : (
                        <>
                          <Table
                            headers={['Date', 'Type', 'Gross', 'Commission', 'Status']}
                            rows={transactions.map((t) => [
                              new Date(t.createdAt).toLocaleDateString('en-IN'),
                              t.saleType,
                              formatPaise(t.grossAmountPaise),
                              formatPaise(t.commission?.amountPaise),
                              <span key="s" className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                t.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                t.status === 'refunded'  ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{t.status}</span>,
                            ])}
                            emptyText="No transactions."
                          />
                          {txTotalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <button
                                disabled={txPage <= 1 || bizLoading}
                                onClick={() => loadTxPage(txPage - 1)}
                                className="btn-secondary text-xs disabled:opacity-40"
                              >
                                ← Prev
                              </button>
                              <span className="text-xs text-gray-500">Page {txPage} of {txTotalPages}</span>
                              <button
                                disabled={txPage >= txTotalPages || bizLoading}
                                onClick={() => loadTxPage(txPage + 1)}
                                className="btn-secondary text-xs disabled:opacity-40"
                              >
                                Next →
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Phase 4: Joining Links ───────────────────────────────── */}
            {activeTab === 'joining-links' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-brand-dark text-lg">Joining Links</h3>
                    <p className="text-sm text-gray-500 mt-1">Each link carries a ₹12,000 joining fee. All payments go to the platform; your commission is credited automatically.</p>
                  </div>
                  <button
                    onClick={() => {
                      setLinkFormOpen((o) => !o)
                      if (!linkFormOpen) {
                        // Re-fetch discount policy whenever form is opened (Task 9)
                        staffApi.getDiscountPolicy('joining')
                          .then((r) => setDiscountPolicy(r.data.data || { minPct: 0, maxPct: 20, isActive: true }))
                          .catch(() => {})
                      }
                    }}
                    className="btn-primary text-sm"
                  >
                    {linkFormOpen ? 'Cancel' : '+ New Link'}
                  </button>
                </div>

                {linkFormOpen && (
                  <form onSubmit={handleCreateLink} className="card space-y-4">
                    <h4 className="font-semibold text-brand-dark">Create Joining Link</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Candidate Name</label>
                        <input
                          className="input-field text-sm"
                          placeholder="Optional"
                          value={newLink.candidateName}
                          onChange={(e) => setNewLink((p) => ({ ...p, candidateName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Candidate Email</label>
                        <input
                          type="email"
                          className="input-field text-sm"
                          placeholder="Optional"
                          value={newLink.candidateEmail}
                          onChange={(e) => setNewLink((p) => ({ ...p, candidateEmail: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Candidate Phone</label>
                        <input
                          className="input-field text-sm"
                          placeholder="10-digit mobile (optional)"
                          value={newLink.candidatePhone}
                          onChange={(e) => setNewLink((p) => ({ ...p, candidatePhone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Expires in (days)</label>
                        <input
                          type="number"
                          className="input-field text-sm"
                          placeholder="e.g. 30 (optional)"
                          min={1}
                          max={90}
                          value={newLink.expiresInDays}
                          onChange={(e) => setNewLink((p) => ({ ...p, expiresInDays: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Phase 6: Inline Discount */}
                    {discountPolicy.isActive && discountPolicy.maxPct > 0 && (
                      <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            id="applyDiscount"
                            checked={newLink.applyDiscount}
                            onChange={(e) => setNewLink((p) => ({ ...p, applyDiscount: e.target.checked }))}
                            className="w-4 h-4 accent-red-600"
                          />
                          <label htmlFor="applyDiscount" className="text-sm font-semibold text-gray-700">Apply Discount to this link</label>
                        </div>
                        {newLink.applyDiscount && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Discount (%) <span className="text-gray-400">({discountPolicy.minPct}%–{discountPolicy.maxPct}% allowed)</span>
                            </label>
                            <input
                              type="number"
                              className="input-field text-sm"
                              min={discountPolicy.minPct}
                              max={discountPolicy.maxPct}
                              step="0.5"
                              value={newLink.discountPct}
                              onChange={(e) => setNewLink((p) => ({ ...p, discountPct: e.target.value }))}
                            />
                            {Number(newLink.discountPct) > 0 && (
                              <p className="text-xs text-yellow-700 mt-1">
                                💡 Candidate will receive {newLink.discountPct}% off ₹12,000 = ₹{((12000 * (1 - Number(newLink.discountPct) / 100))).toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="submit" disabled={linkCreating} className="btn-primary text-sm">
                      {linkCreating ? 'Creating…' : 'Create Link'}
                    </button>
                  </form>
                )}

                {bizLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="card">
                    {joiningLinks.length === 0 ? (
                      <p className="text-gray-400 text-sm py-6 text-center">No joining links yet. Create one above.</p>
                    ) : (
                      <div className="space-y-3">
                        {joiningLinks.map((l) => (
                          <div key={l.id} className="border rounded-xl p-4 flex items-start justify-between gap-3 bg-white">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-bold text-brand-dark">{l.code}</span>
                                {l.isExpired ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-500">Expired</span>
                                ) : l.isUsed ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700">Used ✓</span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-yellow-100 text-yellow-700">Active</span>
                                )}
                              </div>
                              {l.candidateName  && <p className="text-xs text-gray-600">👤 {l.candidateName}</p>}
                              {l.candidateEmail && <p className="text-xs text-gray-500">✉️ {l.candidateEmail}</p>}
                              {l.discountPctUsed > 0 && <p className="text-xs text-yellow-600 font-medium">🏷️ {l.discountPctUsed}% discount applied</p>}
                              <p className="text-xs text-gray-400 mt-1 font-mono truncate">{l.joinUrl}</p>
                              <p className="text-xs text-gray-400">Created: {new Date(l.createdAt).toLocaleDateString('en-IN')}{l.expiresAt ? ` · Expires: ${new Date(l.expiresAt).toLocaleDateString('en-IN')}` : ''}</p>
                            </div>
                            <button
                              onClick={() => copyToClipboard(l.joinUrl)}
                              className="shrink-0 text-xs btn-secondary"
                            >
                              Copy Link
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Phase 4: Payouts ─────────────────────────────────────── */}
            {activeTab === 'payouts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-brand-dark text-lg">My Payouts</h3>
                  <p className="text-sm text-gray-500 mt-1">Commissions are batched every Thursday and paid out to your registered bank account.</p>
                </div>
                {bizLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
                  </div>
                ) : payouts.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-3">💳</div>
                    <p className="font-semibold text-gray-600">No payouts yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Payouts are generated every Thursday based on your attributed sales commissions.</p>
                  </div>
                ) : (
                  <div className="card">
                    <Table
                      headers={['Payout Date', 'Amount', 'Commissions', 'Scheduled For', 'Status']}
                      rows={payouts.map((p) => [
                        new Date(p.createdAt).toLocaleDateString('en-IN'),
                        formatPaise(p.amountPaise),
                        p._count?.commissions ?? p.commissions?.length ?? '—',
                        p.scheduledFor ? new Date(p.scheduledFor).toLocaleDateString('en-IN') : '—',
                        <span key="s" className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'paid'       ? 'bg-green-100 text-green-700' :
                          p.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          p.status === 'failed'     ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{p.status}</span>,
                      ])}
                      emptyText="No payouts."
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Phase 4: Training ────────────────────────────────────── */}
            {activeTab === 'training' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-brand-dark text-lg">Training Material</h3>
                  <p className="text-sm text-gray-500 mt-1">Books, videos, and documents shared by the admin team.</p>
                </div>
                {bizLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
                  </div>
                ) : training.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="font-semibold text-gray-600">No training content yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Your admin team will add books and videos here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {training.map((item) => (
                      <div key={item.id} className="card hover:shadow-md transition-shadow">
                        <div className="text-2xl mb-2">
                          {item.type === 'video' ? '🎬' : item.type === 'book' ? '📖' : '📄'}
                        </div>
                        <h4 className="font-bold text-brand-dark">{item.title}</h4>
                        {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={async () => {
                              try {
                                if (item.url?.startsWith('http')) {
                                  window.open(item.url, '_blank')
                                  return
                                }
                                const res = await staffApi.getTrainingFile(item.id)
                                const url = URL.createObjectURL(res.data)
                                window.open(url, '_blank')
                                setTimeout(() => URL.revokeObjectURL(url), 30000)
                              } catch (err) {
                                console.error('[Training] open error', err)
                                toast.error('Could not open file')
                              }
                            }}
                            className="text-sm text-blue-600 hover:underline font-medium"
                          >
                            Open →
                          </button>
                          {item.isDownloadable && (
                            <button
                              onClick={async () => {
                                try {
                                  if (item.url?.startsWith('http')) {
                                    const a = document.createElement('a')
                                    a.href = item.url
                                    a.download = item.title
                                    a.target = '_blank'
                                    a.click()
                                    return
                                  }
                                  const res = await staffApi.downloadTrainingFile(item.id)
                                  const url = URL.createObjectURL(res.data)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = item.title
                                  a.click()
                                  setTimeout(() => URL.revokeObjectURL(url), 5000)
                                } catch (err) {
                                  console.error('[Training] download error', err)
                                  toast.error('Download failed')
                                }
                              }}
                              className="text-sm text-green-600 hover:underline font-medium"
                            >
                              ⬇ Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'assigned-prospects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Assigned Prospects</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leads assigned to you by the admin team for follow-up.</p>
                  </div>
                  <button onClick={() => fetchProspects(true)} disabled={prospectsLoading} className="btn-secondary text-sm px-4 py-2 disabled:opacity-50">↻ Refresh</button>
                </div>
                {prospectsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
                  </div>
                ) : prospects.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-3">📌</div>
                    <p className="font-semibold text-gray-600">No prospects assigned yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Ask your admin to assign leads here for follow-up.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">
                        <tr>
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="text-left px-4 py-3">Contact</th>
                          <th className="text-left px-4 py-3">Class / City</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-left px-4 py-3">Assigned On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {prospects.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-800">{p.fullName || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-gray-700">{p.email}</div>
                              <div className="text-xs text-gray-500">{p.mobileNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-gray-700">Class {p.classStandard || '—'}</div>
                              <div className="text-xs text-gray-500">{p.city || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                {(p.status || 'new_lead').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {p.assignedAt ? new Date(p.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
