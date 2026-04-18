import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminStaffApi } from '../../services/api'

// ── Helpers ────────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  CAREER_COUNSELLOR_LEAD: 'Career Counsellor Lead',
  CAREER_COUNSELLOR:      'Career Counsellor',
}

const ROLE_COLORS = {
  CAREER_COUNSELLOR_LEAD: 'bg-purple-100 text-purple-800 border-purple-300',
  CAREER_COUNSELLOR:      'bg-blue-100 text-blue-800 border-blue-300',
}

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create Staff Modal ────────────────────────────────────────────────────────
function CreateStaffModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CAREER_COUNSELLOR' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('All fields are required')
      return
    }
    setLoading(true)
    try {
      const res = await adminStaffApi.create(form)
      toast.success(`Staff user "${res.data.data.name}" created!`)
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create staff user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Create Staff User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
            <input
              name="name" type="text" required value={form.name} onChange={handleChange}
              placeholder="e.g. Ravi Sharma"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input
              name="email" type="email" required value={form.email} onChange={handleChange}
              placeholder="ravi@cadgurukul.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Password</label>
            <input
              name="password" type="password" required value={form.password} onChange={handleChange}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <select
              name="role" value={form.role} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="CAREER_COUNSELLOR">Career Counsellor (CC)</option>
              <option value="CAREER_COUNSELLOR_LEAD">Career Counsellor Lead (CCL)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose} disabled={loading}
              className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Staff User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Staff Table Row ───────────────────────────────────────────────────────────
function StaffRow({ staff, onRoleChange, onStatusToggle }) {
  const [loadingRole, setLoadingRole] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const handleRoleChange = async (newRole) => {
    if (newRole === staff.role) return
    setLoadingRole(true)
    try {
      await adminStaffApi.updateRole(staff.id, newRole)
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`)
      onRoleChange(staff.id, newRole)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Role update failed')
    } finally {
      setLoadingRole(false)
    }
  }

  const handleStatusToggle = async () => {
    setLoadingStatus(true)
    try {
      const res = await adminStaffApi.toggleStatus(staff.id)
      const newActive = res.data.data.isActive
      toast.success(`Staff user ${newActive ? 'activated' : 'deactivated'}`)
      onStatusToggle(staff.id, newActive)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed')
    } finally {
      setLoadingStatus(false)
    }
  }

  return (
    <tr className={`border-b border-gray-100 text-sm transition ${staff.isActive ? '' : 'opacity-50 bg-gray-50'}`}>
      <td className="px-4 py-3">
        <div className="font-semibold text-gray-800">{staff.name || '—'}</div>
        <div className="text-xs text-gray-500">{staff.email}</div>
      </td>
      <td className="px-4 py-3">
        <select
          value={staff.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={loadingRole}
          className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer ${ROLE_COLORS[staff.role]} focus:outline-none`}
        >
          <option value="CAREER_COUNSELLOR">CC (Counsellor)</option>
          <option value="CAREER_COUNSELLOR_LEAD">CCL (Lead)</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${staff.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {staff.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmt(staff.createdAt)}</td>
      <td className="px-4 py-3">
        <button
          onClick={handleStatusToggle}
          disabled={loadingStatus}
          className={`text-xs font-semibold px-3 py-1 rounded-lg border transition ${
            staff.isActive
              ? 'border-red-300 text-red-600 hover:bg-red-50'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          } disabled:opacity-40`}
        >
          {loadingStatus ? '…' : staff.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffManagement() {
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter]         = useState('all')  // 'all' | 'CCL' | 'CC'

  const fetchStaff = async () => {
    setLoading(true)
    try {
      const res = await adminStaffApi.list()
      setStaff(res.data.data.staff || [])
    } catch {
      toast.error('Failed to load staff list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  const handleRoleChange = (id, newRole) => {
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, role: newRole } : s))
  }

  const handleStatusToggle = (id, newActive) => {
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, isActive: newActive } : s))
  }

  const filtered = staff.filter((s) => {
    if (filter === 'CCL') return s.role === 'CAREER_COUNSELLOR_LEAD'
    if (filter === 'CC')  return s.role === 'CAREER_COUNSELLOR'
    return true
  })

  const cclCount = staff.filter((s) => s.role === 'CAREER_COUNSELLOR_LEAD').length
  const ccCount  = staff.filter((s) => s.role === 'CAREER_COUNSELLOR').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-1">
              <Link to="/admin/dashboard" className="hover:text-blue-600">Admin</Link> › Staff Management
            </div>
            <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">Create and manage Career Counsellors and CCL staff.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-blue-700 transition"
          >
            + Create Staff User
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Staff', value: staff.length, color: 'bg-blue-50 text-blue-800' },
            { label: 'CCL (Leads)', value: cclCount, color: 'bg-purple-50 text-purple-800' },
            { label: 'CC (Counsellors)', value: ccCount, color: 'bg-indigo-50 text-indigo-800' },
          ].map((t) => (
            <div key={t.label} className={`${t.color} rounded-xl p-4 text-center`}>
              <div className="text-3xl font-bold">{t.value}</div>
              <div className="text-sm font-medium mt-0.5 opacity-80">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'CCL', label: 'CCL Leads' },
            { key: 'CC',  label: 'Counsellors' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`text-sm px-4 py-1.5 rounded-full border font-medium transition ${
                filter === tab.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading staff…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="font-medium">No staff users found.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 text-sm text-blue-600 underline"
              >
                Create the first one →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-widest border-b border-gray-200">
                    <th className="px-4 py-3 text-left">Name / Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <StaffRow
                      key={s.id}
                      staff={s}
                      onRoleChange={handleRoleChange}
                      onStatusToggle={handleStatusToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchStaff}
        />
      )}
    </div>
  )
}
