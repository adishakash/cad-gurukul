import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminLeadApi } from '../../services/api'
import toast from 'react-hot-toast'

const handleExportCsv = async () => {
  try {
    const response = await adminLeadApi.exportCsv()
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cad-gurukul-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Export failed')
  }
}

const STATUS_COLORS = {
  new_lead:               'bg-gray-100 text-gray-700',
  onboarding_started:     'bg-sky-100 text-sky-700',
  plan_selected:          'bg-cyan-100 text-cyan-700',
  assessment_started:     'bg-blue-100 text-blue-700',
  assessment_in_progress: 'bg-blue-200 text-blue-800',
  assessment_completed:   'bg-indigo-100 text-indigo-700',
  free_report_ready:      'bg-purple-100 text-purple-700',
  payment_pending:        'bg-yellow-100 text-yellow-700',
  paid:                   'bg-green-100 text-green-700',
  premium_report_generating: 'bg-amber-100 text-amber-700',
  premium_report_ready:   'bg-emerald-100 text-emerald-700',
  counselling_interested: 'bg-pink-100 text-pink-700',
  closed:                 'bg-red-100 text-red-700',
}

const STATUSES = Object.keys(STATUS_COLORS)
const SOURCES  = ['meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other']

export default function LeadList() {
  const [leads,    setLeads]    = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [funnel,   setFunnel]   = useState(null)

  const [filters, setFilters] = useState({
    status: '', leadSource: '', classStandard: '',
    selectedPlan: '', search: '', dateFrom: '', dateTo: '',
  })

  const LIMIT = 25

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: LIMIT, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
      const { data } = await adminLeadApi.list(params)
      setLeads(data.data.leads)
      setTotal(data.data.total)
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  const fetchFunnel = useCallback(async () => {
    try {
      const { data } = await adminLeadApi.getFunnel(30)
      setFunnel(data.data)
    } catch {}
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchFunnel() }, [])  // funnel metrics only load once

  const handleFilterChange = (e) => {
    setFilters((p) => ({ ...p, [e.target.name]: e.target.value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ status: '', leadSource: '', classStandard: '', selectedPlan: '', search: '', dateFrom: '', dateTo: '' })
    setPage(1)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} total leads</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="btn-primary text-sm px-4 py-2"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Funnel metrics */}
      {funnel && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: 'Total Leads',          value: funnel.funnel.totalLeads,          color: 'bg-gray-50' },
            { label: 'Assessment Started',   value: funnel.funnel.assessmentStarted,   color: 'bg-blue-50' },
            { label: 'Assessment Done',      value: funnel.funnel.assessmentCompleted, color: 'bg-indigo-50' },
            { label: 'Free Report',          value: funnel.funnel.freeReportReady,     color: 'bg-purple-50' },
            { label: 'Paid',                 value: funnel.funnel.paid,                color: 'bg-green-50' },
            { label: 'Premium Report',       value: funnel.funnel.premiumReportReady,  color: 'bg-emerald-50' },
            { label: 'Conversion Rate',      value: funnel.conversionRate,             color: 'bg-yellow-50' },
          ].map((m) => (
            <div key={m.label} className={`${m.color} rounded-xl p-3 border border-gray-100`}>
              <div className="text-2xl font-extrabold text-gray-900">{m.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <input
            type="text" name="search" value={filters.search}
            onChange={handleFilterChange}
            placeholder="Search name / email / mobile…"
            className="col-span-2 sm:col-span-3 lg:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select name="status" value={filters.status} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select name="leadSource" value={filters.leadSource} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select name="classStandard" value={filters.classStandard} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Classes</option>
            {['8','9','10','11','12'].map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select name="selectedPlan" value={filters.selectedPlan} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
          <button onClick={resetFilters} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
            Reset
          </button>
        </div>

        <div className="flex gap-3 mt-3">
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input type="date" name="dateTo"   value={filters.dateTo}   onChange={handleFilterChange} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No leads found for this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left p-4">Lead</th>
                  <th className="text-left p-4">Contact</th>
                  <th className="text-left p-4">Class / Stream</th>
                  <th className="text-left p-4">Plan</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Source</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{lead.fullName}</div>
                      <div className="text-xs text-gray-500">{lead.city || '—'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-700">{lead.email}</div>
                      <div className="text-xs text-gray-500">{lead.mobileNumber}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-700">Class {lead.classStandard || '—'}</div>
                      <div className="text-xs text-gray-500">{lead.stream || 'Not decided'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lead.selectedPlan === 'paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                        {lead.selectedPlan === 'paid' ? '💎 Paid' : '🆓 Free'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                        {lead.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {lead.leadSource?.replace(/_/g, ' ')}
                      {lead.utmCampaign && <div className="text-gray-400">{lead.utmCampaign}</div>}
                    </td>
                    <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/admin/leads/${lead.id}`}
                        className="text-xs text-brand-red font-semibold hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {total} leads
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
