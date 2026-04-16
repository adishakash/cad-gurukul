import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { staffApiClient, staffLeadApi } from '../../services/api'

const StatCard = ({ icon, label, value }) => (
  <div className="card text-center hover:shadow-lg transition-shadow">
    <div className="text-3xl mb-2">{icon}</div>
    <div className="text-3xl font-extrabold text-brand-dark">{value ?? '—'}</div>
    <div className="text-sm font-semibold text-gray-600 mt-1">{label}</div>
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

  const tabs = ['leads', 'students', 'reports']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <div className="bg-brand-dark text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-lg">🎓 CAD Gurukul — Staff Portal</span>
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{staff.role || 'CAREER_COUNSELLOR_LEAD'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{staff.name}</span>
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
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap transition-all ${
                activeTab === t ? 'bg-brand-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >
              {t}
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
          </>
        )}
      </div>
    </div>
  )
}
