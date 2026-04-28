import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { counsellorApi, counsellorBizApi } from '../../services/api'
import ThemeToggle from '../../components/ThemeToggle'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPaise = (p) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

// ─── Shared UI primitives ─────────────────────────────────────────────────────

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

// ─── Status labels ────────────────────────────────────────────────────────────

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

const STATUS_COLORS = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  paid:       'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CounsellorDashboard() {
  const navigate = useNavigate()

  // Existing data
  const [leads, setLeads]       = useState([])
  const [students, setStudents] = useState([])
  const [reports, setReports]   = useState([])
  const [stats, setStats]       = useState({ leads: 0, students: 0, reports: 0 })
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [profile, setProfile]   = useState(null)

  // CC business data
  const [account, setAccount]         = useState(null)
  const [transactions, setTransactions] = useState([])
  const [payouts, setPayouts]         = useState([])
  const [training, setTraining]       = useState([])
  const [bizLoading, setBizLoading]   = useState(false)
  const [referralLink, setReferralLink] = useState(null)
  const [referralStats, setReferralStats] = useState(null)
  const [referralLoading, setReferralLoading] = useState(false)
  const [coupons, setCoupons] = useState([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [couponSaving, setCouponSaving] = useState(false)
  const [couponForm, setCouponForm] = useState({ code: '', planType: 'standard', discountPct: 0, maxRedemptions: '', expiresAt: '', isActive: true })
  const [editingCoupon, setEditingCoupon] = useState(null) // { id, discountPct }
  const [consultations, setConsultations] = useState([])
  const [consultationsLoading, setConsultationsLoading] = useState(false)
  // Assigned Prospects
  const [prospects, setProspects]     = useState([])
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const prospectsLastFetched = useRef(null) // 30-second cache TTL


  const [activeTab, setActiveTab] = useState('leads')

  const counsellor = JSON.parse(localStorage.getItem('cg_staff') || '{}')

  useEffect(() => {
    const token = localStorage.getItem('cg_staff_token')
    if (!token) {
      navigate('/staff/login')
      return
    }
    loadData()
  }, [])

  // Load existing counsellor data
  const loadData = async () => {
    setLoading(true)
    try {
      const [leadsRes, studentsRes, reportsRes, profileRes] = await Promise.all([
        counsellorApi.leads({ limit: 50 }),
        counsellorApi.students({ limit: 20 }),
        counsellorApi.reports({ limit: 20 }),
        counsellorApi.getProfile(),
      ])

      const leadsData    = leadsRes.data.data
      const studentsData = studentsRes.data.data
      const reportsData  = reportsRes.data.data

      setLeads(leadsData?.leads       || [])
      setStudents(studentsData?.users || [])
      setReports(reportsData?.reports || [])
      setProfile(profileRes.data.data?.user || null)
      setStats({
        leads:    leadsData?.total    ?? 0,
        students: studentsData?.total ?? 0,
        reports:  reportsData?.total  ?? 0,
      })
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        navigate('/staff/login')
      } else {
        toast.error('Failed to load dashboard data.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Load CC business layer data
  const loadBizData = async () => {
    setBizLoading(true)
    try {
      const [accountRes, txRes, payoutsRes, trainingRes] = await Promise.all([
        counsellorBizApi.getAccount(),
        counsellorBizApi.getTransactions(1, 20),
        counsellorBizApi.getPayouts(),
        counsellorBizApi.getTraining(),
      ])
      setAccount(accountRes.data.data)
      setTransactions(txRes.data.data?.sales || [])
      setPayouts(payoutsRes.data.data || [])
      setTraining(trainingRes.data.data || [])
    } catch {
      toast.error('Failed to load business data.')
    } finally {
      setBizLoading(false)
    }
  }

  const loadReferralData = async () => {
    setReferralLoading(true)
    try {
      const [linkRes, statsRes] = await Promise.all([
        counsellorBizApi.getReferralLink(),
        counsellorBizApi.getReferralStats(),
      ])
      setReferralLink(linkRes.data.data)
      setReferralStats(statsRes.data.data)
    } catch {
      toast.error('Failed to load referral data.')
    } finally {
      setReferralLoading(false)
    }
  }

  const loadCoupons = async () => {
    setCouponsLoading(true)
    try {
      const res = await counsellorBizApi.listCoupons()
      setCoupons(res.data.data || [])
    } catch {
      toast.error('Failed to load coupons.')
    } finally {
      setCouponsLoading(false)
    }
  }

  const loadConsultations = async () => {
    setConsultationsLoading(true)
    try {
      const res = await counsellorBizApi.getUpcomingConsultations()
      setConsultations(res.data.data || [])
    } catch (err) {
      if (err?.response?.status === 403) {
        setConsultations([])
      } else {
        toast.error('Failed to load consultations.')
      }
    } finally {
      setConsultationsLoading(false)
    }
  }

  const fetchProspects = useCallback((force = false) => {
    const now = Date.now()
    if (!force && prospectsLastFetched.current && now - prospectsLastFetched.current < 30_000) return
    setProspectsLoading(true)
    counsellorApi.getAssignedProspects()
      .then((r) => { setProspects(r.data.data?.prospects || []); prospectsLastFetched.current = Date.now() })
      .catch(() => toast.error('Failed to load assigned prospects'))
      .finally(() => setProspectsLoading(false))
  }, [])

  // Load biz data when switching to biz tabs
  useEffect(() => {
    if (['account', 'training', 'payouts'].includes(activeTab)) {
      loadBizData()
    }
    if (activeTab === 'referral') loadReferralData()
    if (activeTab === 'coupons') loadCoupons()
    if (activeTab === 'consultations') loadConsultations()
    // Re-fetch assigned prospects on tab switch, with 30-second cache to avoid
    // unnecessary API calls when quickly switching between tabs
    if (activeTab === 'assigned-prospects') fetchProspects()
  }, [activeTab])

  const handleLeadSearch = async () => {
    try {
      const params = { limit: 50 }
      if (search) params.search = search
      const res = await counsellorApi.leads(params)
      setLeads(res.data.data?.leads || [])
    } catch {
      toast.error('Search failed.')
    }
  }

  const handleCreateCoupon = async (e) => {
    e.preventDefault()
    setCouponSaving(true)
    try {
      const payload = {
        planType: couponForm.planType,
        discountPct: Number(couponForm.discountPct) || 0,
        isActive: couponForm.isActive,
      }
      if (couponForm.code.trim()) payload.code = couponForm.code.trim().toUpperCase()
      if (couponForm.maxRedemptions) payload.maxRedemptions = Number(couponForm.maxRedemptions)
      if (couponForm.expiresAt) payload.expiresAt = new Date(couponForm.expiresAt).toISOString()

      await counsellorBizApi.createCoupon(payload)
      toast.success('Coupon created.')
      setCouponForm({ code: '', planType: 'standard', discountPct: 0, maxRedemptions: '', expiresAt: '', isActive: true })
      await loadCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create coupon.')
    } finally {
      setCouponSaving(false)
    }
  }

  const toggleCouponStatus = async (coupon) => {
    try {
      await counsellorBizApi.updateCoupon(coupon.id, { isActive: !coupon.isActive })
      await loadCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update coupon.')
    }
  }

  const deactivateCoupon = async (coupon) => {
    try {
      await counsellorBizApi.deleteCoupon(coupon.id)
      await loadCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to deactivate coupon.')
    }
  }

  const saveEditCouponDiscount = async () => {
    if (!editingCoupon) return
    try {
      await counsellorBizApi.updateCoupon(editingCoupon.id, { discountPct: Number(editingCoupon.discountPct) })
      toast.success('Discount updated.')
      setEditingCoupon(null)
      await loadCoupons()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update discount.')
    }
  }

  const handleUpdateDiscount = async (e) => {
    e.preventDefault()
    // Discount tab removed (Phase 6) — this handler is kept for backward compat but not called
  }

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => toast.success('URL copied!')).catch(() => toast.error('Copy failed'))
  }

  const logout = () => {
    localStorage.removeItem('cg_staff_token')
    localStorage.removeItem('cg_staff_refresh_token')
    localStorage.removeItem('cg_staff')
    navigate('/staff/login')
  }

  const tabs = ['leads', 'students', 'reports', 'referral', 'coupons', 'account', 'training', 'payouts', 'consultations', 'assigned-prospects']

  const TAB_LABELS = {
    leads: 'Leads',
    students: 'Students',
    reports: 'Reports',
    referral: 'Referral Link',
    coupons: 'Coupons',
    account: 'Account',
    training: 'Training',
    payouts: 'Payouts',
    consultations: 'Consultations',
    'assigned-prospects': '📌 Assigned Prospects',
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Navbar */}
      <div className="bg-brand-dark dark:bg-gray-900 border-b border-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-lg">🎓 CAD Gurukul — Counsellor Portal</span>
          <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded-full">CAREER_COUNSELLOR</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{counsellor.name}</span>
          <ThemeToggle />
          <button onClick={logout} className="text-sm hover:text-brand-red transition-colors">Logout</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon="🤝" label="Counselling Leads" value={stats.leads}    />
          <StatCard icon="🎓" label="Total Students"    value={stats.students} />
          <StatCard icon="📄" label="Total Reports"     value={stats.reports}  />
        </div>

        {/* Scope notice — shown on counsellor-scoped tabs */}
        {['leads', 'students', 'reports'].includes(activeTab) && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm">
            <strong>Counsellor view:</strong> You are viewing data scoped to your assigned leads. Student and report data are read-only.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === t ? 'bg-brand-red text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border dark:border-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── Existing tabs ── */}
        {loading && ['leads', 'students', 'reports'].includes(activeTab) ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === 'leads' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-bold text-brand-dark text-lg">Counselling Leads ({stats.leads})</h3>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLeadSearch()}
                      placeholder="Search name / email…"
                      className="input-field text-sm w-48"
                    />
                    <button onClick={handleLeadSearch} className="btn-primary text-sm">Search</button>
                    <button onClick={loadData} className="btn-secondary text-sm">Reset</button>
                  </div>
                </div>
                <Table
                  headers={['Name', 'Email', 'Mobile', 'Class', 'Status', 'Notes', 'Joined']}
                  rows={leads.map((l) => [
                    l.fullName,
                    l.email,
                    l.mobileNumber,
                    l.classStandard ? `Class ${l.classStandard}` : '—',
                    <span key="s" className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      {STATUS_LABELS[l.status] || l.status}
                    </span>,
                    l.counsellingNotes
                      ? <span key="n" className="text-xs text-gray-500 italic max-w-xs truncate block">{l.counsellingNotes}</span>
                      : '—',
                    new Date(l.createdAt).toLocaleDateString('en-IN'),
                  ])}
                  emptyText="No counselling leads found."
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

            {activeTab === 'referral' && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-bold text-brand-dark text-lg mb-3">Your Referral Link</h3>
                  {referralLoading ? (
                    <div className="py-8 text-center text-gray-400">Loading…</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          readOnly
                          value={referralLink?.url || '—'}
                          className="input-field text-sm flex-1"
                        />
                        <button
                          onClick={() => referralLink?.url && copyUrl(referralLink.url)}
                          className="btn-secondary text-sm px-4"
                          disabled={!referralLink?.url}
                        >
                          Copy Link
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Share this single link to attribute all student revenue to your profile.</p>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 className="font-bold text-brand-dark text-lg mb-4">Referral Stats</h3>
                  {referralLoading ? (
                    <div className="py-8 text-center text-gray-400">Loading…</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <StatCard icon="👥" label="Leads" value={referralStats?.totals?.leads ?? 0} />
                      <StatCard icon="🧠" label="Started" value={referralStats?.totals?.assessmentStarted ?? 0} />
                      <StatCard icon="✅" label="Completed" value={referralStats?.totals?.assessmentCompleted ?? 0} />
                      <StatCard icon="💳" label="Paid" value={referralStats?.totals?.paid ?? 0} />
                      <StatCard icon="📞" label="Consultations" value={referralStats?.totals?.consultations ?? 0} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'coupons' && (
              <div className="space-y-6">
                <div className="card">
                  <h3 className="font-bold text-brand-dark text-lg mb-4">Create Coupon</h3>
                  <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code (optional)</label>
                      <input
                        type="text"
                        value={couponForm.code}
                        onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                        placeholder="Auto-generate if blank"
                        className="input-field text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                      <select
                        value={couponForm.planType}
                        onChange={(e) => setCouponForm((f) => ({ ...f, planType: e.target.value }))}
                        className="input-field text-sm w-full"
                      >
                        <option value="standard">Standard (₹499)</option>
                        <option value="premium">Premium (₹1,999)</option>
                        <option value="consultation">Consultation (₹9,999)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount %{' '}
                        <span className="text-gray-400 font-normal">
                          (max {couponForm.planType === 'standard' ? '100' : '20'}%)
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={couponForm.planType === 'standard' ? 100 : 20}
                        value={couponForm.discountPct}
                        onChange={(e) => setCouponForm((f) => ({ ...f, discountPct: e.target.value }))}
                        className="input-field text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Redemptions</label>
                      <input
                        type="number"
                        min="1"
                        value={couponForm.maxRedemptions}
                        onChange={(e) => setCouponForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                        placeholder="Optional"
                        className="input-field text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={couponForm.expiresAt}
                        onChange={(e) => setCouponForm((f) => ({ ...f, expiresAt: e.target.value }))}
                        className="input-field text-sm w-full"
                      />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" disabled={couponSaving} className="btn-primary text-sm w-full">
                        {couponSaving ? 'Saving…' : 'Create Coupon'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <h3 className="font-bold text-brand-dark text-lg mb-4">My Coupons</h3>
                  {couponsLoading ? (
                    <div className="py-10 text-center text-gray-400">Loading coupons…</div>
                  ) : (
                    <Table
                      headers={['Code', 'Plan', 'Discount', 'Usage', 'Status', 'Expires', 'Actions']}
                      rows={coupons.map((c) => [
                        <code key="code" className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.code}</code>,
                        c.planType,
                        editingCoupon?.id === c.id ? (
                          <div key="disc-edit" className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max={c.planType === 'standard' ? 100 : 20}
                              className="input-field text-xs w-16 py-0.5 px-1"
                              value={editingCoupon.discountPct}
                              onChange={(e) => setEditingCoupon((p) => ({ ...p, discountPct: e.target.value }))}
                              autoFocus
                            />
                            <span className="text-xs">%</span>
                            <button onClick={saveEditCouponDiscount} className="text-xs text-green-600 hover:underline">Save</button>
                            <button onClick={() => setEditingCoupon(null)} className="text-xs text-gray-400 hover:underline">✕</button>
                          </div>
                        ) : `${c.discountPct}%`,
                        `${c.usageCount || 0}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}`,
                        c.isActive ? 'Active' : 'Inactive',
                        c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : '—',
                        <div key="actions" className="flex gap-2">
                          <button onClick={() => toggleCouponStatus(c)} className="text-xs text-indigo-600 hover:underline">
                            {c.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => setEditingCoupon({ id: c.id, discountPct: c.discountPct })}
                            className="text-xs text-yellow-600 hover:underline"
                          >Edit %</button>
                          <button onClick={() => deactivateCoupon(c)} className="text-xs text-red-600 hover:underline">Deactivate</button>
                        </div>,
                      ])}
                      emptyText="No coupons created yet."
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'consultations' && (
              <div className="card">
                <h3 className="font-bold text-brand-dark text-lg mb-4">Upcoming Consultations</h3>
                {profile?.isConsultationAuthorized ? (
                  consultationsLoading ? (
                    <div className="py-10 text-center text-gray-400">Loading consultations…</div>
                  ) : (
                    <Table
                      headers={['Student', 'Email', 'Phone', 'Scheduled', 'Status', 'Meeting']}
                      rows={consultations.map((c) => [
                        c.studentName,
                        c.studentEmail || '—',
                        c.studentPhone || '—',
                        c.scheduledStartAt ? new Date(c.scheduledStartAt).toLocaleString('en-IN') : '—',
                        c.status,
                        c.meetingLink
                          ? <a key="m" href={c.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Open</a>
                          : '—',
                      ])}
                      emptyText="No upcoming sessions assigned yet."
                    />
                  )
                ) : (
                  <div className="text-sm text-gray-500">You are not authorized for ₹9,999 consultations yet.</div>
                )}
              </div>
            )}

            {/* ── CC Business tabs ── */}
            {bizLoading && ['account', 'training', 'payouts'].includes(activeTab) && (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
              </div>
            )}

            {!bizLoading && activeTab === 'account' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard icon="💰" label="Total Sales"      value={account ? formatPaise(account.totalSalesPaise)        : '—'} />
                  <StatCard icon="🏆" label="Total Commission" value={account ? formatPaise(account.totalCommissionPaise)    : '—'} />
                  <StatCard icon="🗓️" label="This Month Income" value={account ? formatPaise(account.monthIncomePaise || 0) : '—'} />
                  <StatCard icon="📆" label="This Week Income"  value={account ? formatPaise(account.weekIncomePaise || 0)  : '—'} />
                  <StatCard icon="⏳" label="Pending Payout"   value={account ? formatPaise(account.pendingPayoutPaise)      : '—'} />
                  <StatCard icon="✅" label="Paid Out"         value={account ? formatPaise(account.paidAmountPaise)         : '—'} />
                </div>
                <div className="card text-sm text-gray-600">
                  <p>📅 Next payout scheduled: <strong>{account?.nextPayoutDate || '—'}</strong></p>
                  <p className="mt-1">🔢 Total sales count: <strong>{account?.totalSalesCount ?? 0}</strong></p>
                  <p className="mt-1 text-xs text-gray-400">Commission rate: 70% on ₹499/₹1,999; 10% or 50% on ₹9,999 (authorized)</p>
                </div>
                {transactions.length > 0 && (
                  <div className="card">
                    <h3 className="font-bold text-brand-dark text-lg mb-4">Recent Transactions</h3>
                    <Table
                      headers={['Payment ID', 'Gross', 'Discount', 'Net', 'Commission', 'Status', 'Date']}
                      rows={transactions.map((t) => [
                        t.paymentId?.slice(0, 12) + '…',
                        formatPaise(t.grossAmountPaise),
                        formatPaise(t.discountAmountPaise),
                        formatPaise(t.netAmountPaise),
                        formatPaise(t.commissionPaise),
                        <span key="s" className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {t.status}
                        </span>,
                        new Date(t.createdAt).toLocaleDateString('en-IN'),
                      ])}
                    />
                  </div>
                )}
              </div>
            )}

            {!bizLoading && activeTab === 'training' && (
              <div className="space-y-4">
                <h3 className="font-bold text-brand-dark text-lg">Training Content</h3>
                {training.length === 0 ? (
                  <div className="card text-center text-gray-400 py-10">No training content available yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {training.map((item) => (
                      <div key={item.id} className="card hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">
                            {item.type === 'video' ? '🎥' : item.type === 'book' ? '📚' : '📄'}
                          </span>
                          <span className="text-xs font-medium text-gray-500 uppercase">{item.type}</span>
                        </div>
                        <h4 className="font-semibold text-brand-dark mb-1">{item.title}</h4>
                        {item.description && <p className="text-sm text-gray-500 mb-3">{item.description}</p>}
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              try {
                                if (item.url?.startsWith('http')) {
                                  window.open(item.url, '_blank')
                                  return
                                }
                                const res = await counsellorBizApi.getTrainingFile(item.id)
                                const url = URL.createObjectURL(res.data)
                                window.open(url, '_blank')
                                setTimeout(() => URL.revokeObjectURL(url), 30000)
                              } catch (err) {
                                console.error('[Training] open error', err)
                                toast.error('Could not open file')
                              }
                            }}
                            className="text-sm text-indigo-600 hover:underline"
                          >Open →</button>
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
                                  const res = await counsellorBizApi.downloadTrainingFile(item.id)
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
                              className="text-sm text-green-600 hover:underline"
                            >⬇ Download</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!bizLoading && activeTab === 'payouts' && (
              <div className="card">
                <h3 className="font-bold text-brand-dark text-lg mb-4">Payouts</h3>
                <Table
                  headers={['Payout ID', 'Amount', 'Status', 'Scheduled', 'Processed', 'Commissions']}
                  rows={payouts.map((p) => [
                    p.id.slice(0, 8) + '…',
                    formatPaise(p.amountPaise),
                    <span key="s" className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status}
                    </span>,
                    new Date(p.scheduledFor).toLocaleDateString('en-IN'),
                    p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-IN') : '—',
                    p._count?.commissions ?? '—',
                  ])}
                  emptyText="No payouts yet."
                />
              </div>
            )}

            {activeTab === 'assigned-prospects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-brand-dark dark:text-gray-100 text-lg">Assigned Prospects</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leads assigned to you by the admin team for counselling follow-up.</p>
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
                    <p className="text-sm text-gray-400 mt-1">Your admin will assign leads here for counselling follow-up.</p>
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
                            <td className="px-4 py-3 font-semibold text-gray-800">{p.fullName || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="text-gray-700">{p.email}</div>
                              <div className="text-xs text-gray-500">{p.mobileNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-gray-700">Class {p.classStandard || '—'}</div>
                              <div className="text-xs text-gray-500">{p.city || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
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
