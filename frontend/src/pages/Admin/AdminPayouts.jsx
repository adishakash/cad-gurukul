import { useState, useEffect } from 'react'
import { settlementApi } from '../../services/api'

export default function AdminPayouts() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')

  const loadStatus = async () => {
    try {
      const r = await settlementApi.getStatus()
      setStatus(r.data?.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

  const trigger = async (dryRun = false) => {
    setRunning(true)
    setMsg('')
    try {
      const r = await settlementApi.trigger({ dryRun, role: 'ALL' })
      setMsg(r.data?.message || 'Settlement run started')
      loadStatus()
    } catch (err) {
      setMsg(err.response?.data?.error?.message || 'Failed to trigger settlement')
    }
    setRunning(false)
  }

  const pause  = async () => { await settlementApi.pause(); loadStatus() }
  const resume = async () => { await settlementApi.resume(); loadStatus() }

  const exportCsv = async () => {
    try {
      const r = await settlementApi.exportCsv({ role: 'ALL' })
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a'); a.href = url; a.download = 'payouts.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settlement & Payouts</h1>
        <button onClick={exportCsv} className="text-sm text-blue-600 hover:underline">Export CSV</button>
      </div>

      {loading ? <div className="text-gray-400">Loading...</div> : (
        <>
          {/* Schedule Status */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Schedule Status</h2>
            {status ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {status.map?.((s) => (
                  <div key={s.role} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase">{s.role}</div>
                    <div className={`font-semibold mt-1 ${s.isPaused ? 'text-red-600' : 'text-green-600'}`}>{s.isPaused ? 'Paused' : 'Active'}</div>
                    {s.nextRunAt && <div className="text-xs text-gray-400 mt-1">Next: {new Date(s.nextRunAt).toLocaleString('en-IN')}</div>}
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No schedule data</p>}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Manual Controls</h2>
            {msg && <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">{msg}</p>}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => trigger(false)} disabled={running} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {running ? 'Running...' : '▶ Trigger Settlement'}
              </button>
              <button onClick={() => trigger(true)} disabled={running} className="px-4 py-2 bg-gray-100 text-gray-800 text-sm rounded-lg hover:bg-gray-200">
                🔍 Dry Run
              </button>
              <button onClick={pause} className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm rounded-lg hover:bg-yellow-200">
                ⏸ Pause Schedule
              </button>
              <button onClick={resume} className="px-4 py-2 bg-green-100 text-green-800 text-sm rounded-lg hover:bg-green-200">
                ▶ Resume Schedule
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>Note:</strong> Payouts run automatically every Thursday at 10:00 AM IST. Manual settlement processes all pending commissions for CC and CCL partners with verified bank accounts.
          </div>
        </>
      )}
    </div>
  )
}
