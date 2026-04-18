import { useState, useEffect } from 'react'
import { partnerAdminApi } from '../../services/api'
import { Link } from 'react-router-dom'

const STATUS_BADGE = {
  true:  'bg-green-100 text-green-800',
  false: 'bg-yellow-100 text-yellow-800',
}

export default function AdminPartners() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ role: '', approved: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20, ...(filter.role && { role: filter.role }), ...(filter.approved !== '' && { isApproved: filter.approved }) }
      const r = await partnerAdminApi.list(params)
      setPartners(r.data?.data?.items || r.data?.data || [])
      setTotal(r.data?.data?.total || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, filter])

  const approve = async (id) => {
    await partnerAdminApi.approve(id)
    load()
  }

  const reject = async (id) => {
    const reason = prompt('Rejection reason (optional):')
    await partnerAdminApi.reject(id, { reason })
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partner Management</h1>
        <div className="flex gap-3">
          <select value={filter.role} onChange={e => { setFilter(f => ({ ...f, role: e.target.value })); setPage(1) }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">All Roles</option>
            <option value="CAREER_COUNSELLOR">Career Counsellor (CC)</option>
            <option value="CAREER_COUNSELLOR_LEAD">Counsellor Lead (CCL)</option>
          </select>
          <select value={filter.approved} onChange={e => { setFilter(f => ({ ...f, approved: e.target.value })); setPage(1) }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">All Status</option>
            <option value="false">Pending</option>
            <option value="true">Approved</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Role', 'Email', 'Phone', 'Status', 'Bank', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {partners.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link to={`/admin/partners/${p.id}`} className="hover:text-blue-600">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.role === 'CAREER_COUNSELLOR' ? 'CC' : 'CCL'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[String(p.isApproved)]}`}>
                      {p.isApproved ? 'Approved' : p.suspendedAt ? 'Suspended' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {p.bankAccount ? (p.bankAccount.isVerified ? <span className="text-green-600">✅ Verified</span> : <span className="text-yellow-600">⏳ Pending</span>) : '—'}
                  </td>
                  <td className="px-4 py-3 flex gap-2 text-sm">
                    {!p.isApproved && !p.suspendedAt && (
                      <>
                        <button onClick={() => approve(p.id)} className="text-green-600 hover:underline">Approve</button>
                        <button onClick={() => reject(p.id)} className="text-red-500 hover:underline">Reject</button>
                      </>
                    )}
                    <Link to={`/admin/partners/${p.id}`} className="text-blue-500 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {!partners.length && <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">No partners found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-between text-sm text-gray-500">
        <span>{total} total</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={partners.length < 20} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}
