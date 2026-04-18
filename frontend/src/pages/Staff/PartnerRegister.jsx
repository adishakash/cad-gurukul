import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { partnerAuthApi } from '../../services/api'

const ROLES = [
  { value: 'CAREER_COUNSELLOR', label: 'Career Counsellor (CC)', desc: 'Promote and sell CAD courses directly to students' },
  { value: 'CAREER_COUNSELLOR_LEAD', label: 'Career Counsellor Lead (CCL)', desc: 'Recruit and manage Career Counsellors, earn override commissions' },
]

export default function PartnerRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'CAREER_COUNSELLOR', city: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await partnerAuthApi.register(form)
      navigate('/partner/pending-approval')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Become a Partner</h2>
          <p className="mt-1 text-sm text-gray-500">Join the CAD Gurukul partner network and start earning.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Your Role</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label key={r.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${form.role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handle} className="mt-1" />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{r.label}</div>
                    <div className="text-xs text-gray-500">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input name="name" value={form.name} onChange={handle} required className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input name="email" type="email" value={form.email} onChange={handle} required className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input name="phone" value={form.phone} onChange={handle} required pattern="[6-9][0-9]{9}" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input name="city" value={form.city} onChange={handle} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input name="password" type="password" value={form.password} onChange={handle} required minLength={8} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">Already a partner? <Link to="/staff/login" className="text-blue-600 hover:underline">Log in</Link></p>
      </div>
    </div>
  )
}
