import { useState, useEffect } from 'react'
import { counsellorBizApi, staffLeadBizApi } from '../../services/api'

/**
 * BankAccountForm - shared for CC (role='cc') and CCL (role='ccl')
 */
export default function BankAccountForm({ role = 'cc' }) {
  const api = role === 'cc' ? counsellorBizApi : staffLeadBizApi
  const [bank, setBank] = useState(null)
  const [form, setForm] = useState({ accountHolder: '', accountNumber: '', ifscCode: '', bankName: '', accountType: 'savings' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    api.getBankAccount().then(r => {
      if (r.data?.data) {
        const b = r.data.data
        setBank(b)
        setForm(f => ({ ...f, accountHolder: b.accountHolder || '', ifscCode: b.ifscCode || '', bankName: b.bankName || '', accountType: b.accountType || 'savings' }))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      const r = await api.saveBankAccount(form)
      setMsg({ type: 'success', text: r.data?.message || 'Bank account saved!' })
      setBank(r.data?.data)
      setForm(f => ({ ...f, accountNumber: '' })) // clear sensitive field
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'Failed to save bank account' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Bank Account</h3>
      <p className="text-sm text-gray-500 mb-4">Your account details are encrypted. Only the last 4 digits are visible. Admin must verify before payouts are enabled.</p>

      {/* Current account status */}
      {bank && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${bank.isVerified ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
          {bank.isVerified
            ? `✅ Verified — ${bank.bankName} ****${bank.accountNumberLast4} (${bank.accountType})`
            : `⏳ Pending verification — ${bank.bankName} ****${bank.accountNumberLast4}`}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Holder Name</label>
          <input name="accountHolder" value={form.accountHolder} onChange={handle} required className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Number</label>
          <input name="accountNumber" value={form.accountNumber} onChange={handle} required pattern="\d{9,18}" placeholder="Enter full account number" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">IFSC Code</label>
            <input name="ifscCode" value={form.ifscCode} onChange={handle} required placeholder="e.g. SBIN0001234" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm uppercase focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bank Name</label>
            <input name="bankName" value={form.bankName} onChange={handle} required className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Account Type</label>
          <select name="accountType" value={form.accountType} onChange={handle} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </select>
        </div>

        {msg.text && <p className={`text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}

        <button type="submit" disabled={saving} className="w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving...' : bank ? 'Update Bank Account' : 'Save Bank Account'}
        </button>
      </form>
    </div>
  )
}
