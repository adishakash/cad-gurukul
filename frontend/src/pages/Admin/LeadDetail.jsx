import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminLeadApi } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  'new_lead','onboarding_started','plan_selected','assessment_started',
  'assessment_in_progress','assessment_completed','free_report_ready',
  'payment_pending','paid','premium_report_generating',
  'premium_report_ready','counselling_interested','closed',
]

function Timeline({ events }) {
  if (!events?.length) return <p className="text-sm text-gray-400">No events yet.</p>
  return (
    <ol className="relative border-l border-gray-200 space-y-4 pl-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <div className="absolute -left-5 top-1 w-3 h-3 rounded-full bg-brand-red border-2 border-white" />
          <div className="text-xs font-semibold text-gray-800">{ev.event.replace(/_/g, ' ')}</div>
          <div className="text-xs text-gray-400">
            {new Date(ev.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
            <pre className="text-[10px] text-gray-500 bg-gray-50 rounded p-1 mt-1 overflow-x-auto">
              {JSON.stringify(ev.metadata, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  )
}

function DataRow({ label, value }) {
  if (!value && value !== false) return null
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between text-sm py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 font-medium w-40 shrink-0">{label}</span>
      <span className="text-gray-800 mt-0.5 sm:mt-0 text-right">{String(value)}</span>
    </div>
  )
}

export default function LeadDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [lead,    setLead]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ status: '', counsellingInterested: false, counsellingNotes: '' })

  useEffect(() => {
    adminLeadApi.getDetail(id).then(({ data }) => {
      setLead(data.data)
      setForm({
        status:               data.data.status || 'new_lead',
        counsellingInterested: data.data.counsellingInterested || false,
        counsellingNotes:     data.data.counsellingNotes || '',
      })
    }).catch(() => toast.error('Failed to load lead'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminLeadApi.update(id, form)
      toast.success('Lead updated')
      // Refresh
      const { data } = await adminLeadApi.getDetail(id)
      setLead(data.data)
    } catch {
      toast.error('Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAction = async (action) => {
    try {
      const payload = action === 'mark_counselling'
        ? { action, interested: true, notes: form.counsellingNotes }
        : { action }
      await adminLeadApi.triggerAction(id, payload)
      toast.success(`Action "${action.replace(/_/g, ' ')}" triggered`)
      const { data } = await adminLeadApi.getDetail(id)
      setLead(data.data)
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Action failed')
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading lead…</div>
  if (!lead)   return <div className="p-8 text-center text-gray-400">Lead not found.</div>

  const user = lead.user

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button onClick={() => navigate('/admin/leads')} className="hover:text-gray-600">← All Leads</button>
        <span>/</span>
        <span className="text-gray-800 font-semibold">{lead.fullName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lead details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">Lead Details</h2>
            <DataRow label="Full Name"    value={lead.fullName} />
            <DataRow label="Email"        value={lead.email} />
            <DataRow label="Mobile"       value={lead.mobileNumber} />
            <DataRow label="Class"        value={lead.classStandard ? `Class ${lead.classStandard}` : undefined} />
            <DataRow label="Stream"       value={lead.stream} />
            <DataRow label="City"         value={lead.city} />
            <DataRow label="Pincode"      value={lead.pincode} />
            <DataRow label="User Type"    value={lead.userType} />
            <DataRow label="Selected Plan" value={lead.selectedPlan} />
            <DataRow label="Lead Source"  value={lead.leadSource?.replace(/_/g, ' ')} />
            <DataRow label="UTM Source"   value={lead.utmSource} />
            <DataRow label="UTM Campaign" value={lead.utmCampaign} />
            <DataRow label="UTM Medium"   value={lead.utmMedium} />
            <DataRow label="Created"      value={new Date(lead.createdAt).toLocaleString('en-IN')} />
          </div>

          {/* Linked user info */}
          {user && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-4">Linked User Account</h2>
              <DataRow label="Email"      value={user.email} />
              <DataRow label="Role"       value={user.role} />
              <DataRow label="Active"     value={user.isActive ? 'Yes' : 'No'} />
              <DataRow label="Joined"     value={new Date(user.createdAt).toLocaleDateString('en-IN')} />
              <DataRow label="Onboarding" value={user.studentProfile?.isOnboardingComplete ? 'Complete' : 'Incomplete'} />

              {user.assessments?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assessments</div>
                  {user.assessments.map((a) => (
                    <div key={a.id} className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-1 flex justify-between">
                      <span>{a.accessLevel} · {a.status}</span>
                      <span>{a.currentStep}/{a.totalQuestions} Q</span>
                    </div>
                  ))}
                </div>
              )}

              {user.payments?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payments</div>
                  {user.payments.map((p) => (
                    <div key={p.id} className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-1 flex justify-between">
                      <span>₹{(p.amountPaise / 100).toFixed(0)} · {p.status}</span>
                      <span>{new Date(p.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">Activity Timeline</h2>
            <Timeline events={lead.events} />
          </div>
        </div>

        {/* Sidebar: Actions */}
        <div className="space-y-5">
          {/* Status badge */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-1">Current Status</h2>
            <div className="text-sm font-semibold text-gray-700 bg-gray-100 rounded px-3 py-2 mb-4">
              {lead.status?.replace(/_/g, ' ')}
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1">Update Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.counsellingInterested}
                onChange={(e) => setForm((p) => ({ ...p, counsellingInterested: e.target.checked }))}
                className="accent-brand-red"
              />
              Counselling Interested
            </label>

            <textarea
              value={form.counsellingNotes}
              onChange={(e) => setForm((p) => ({ ...p, counsellingNotes: e.target.value }))}
              placeholder="Counselling notes (optional)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 resize-none"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full btn-primary text-sm py-2 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* Manual trigger actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-3">Manual Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => handleAction('regenerate_report')}
                className="w-full text-left text-sm border border-gray-200 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
              >
                🔄 Regenerate Report
              </button>
              <button
                onClick={() => handleAction('resend_report_link')}
                className="w-full text-left text-sm border border-gray-200 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
              >
                📲 Resend Report Link (WhatsApp)
              </button>
              <button
                onClick={() => handleAction('mark_counselling')}
                className="w-full text-left text-sm border border-gray-200 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition"
              >
                📞 Mark Counselling Interested
              </button>
            </div>
          </div>

          {/* Linked IDs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-3">Linked Records</h2>
            <div className="space-y-1.5 text-xs text-gray-500">
              <DataRow label="Lead ID"       value={lead.id} />
              <DataRow label="User ID"       value={lead.userId || '—'} />
              <DataRow label="Assessment ID" value={lead.assessmentId || '—'} />
              <DataRow label="Report ID"     value={lead.reportId || '—'} />
              <DataRow label="Payment ID"    value={lead.paymentId || '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
