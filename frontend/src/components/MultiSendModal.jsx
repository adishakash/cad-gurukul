import { useState, useRef } from 'react'

/**
 * MultiSendModal - bulk send WA links (joining links for CCL)
 * Props:
 *   isOpen: bool
 *   onClose: fn
 *   onSend: fn(recipients) => Promise<{sent, failed}>
 *   title: string
 *   placeholder: string (CSV format hint)
 */
export default function MultiSendModal({ isOpen, onClose, onSend, title = 'Bulk Send', placeholder }) {
  const [csv, setCsv] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  if (!isOpen) return null

  const parseRecipients = (raw) => {
    return raw.trim().split('\n').map(line => {
      const [name, phone, email] = line.split(',').map(s => s.trim())
      return { name, phone, email: email || undefined }
    }).filter(r => r.name && r.phone)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsv(ev.target.result)
    reader.readAsText(file)
  }

  const send = async () => {
    const recipients = parseRecipients(csv)
    if (!recipients.length) { setError('No valid recipients found. Format: Name, Phone, Email (optional)'); return }
    if (recipients.length > 50) { setError('Maximum 50 recipients allowed per batch'); return }
    setError(''); setSending(true); setResult(null)
    try {
      const res = await onSend(recipients)
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const reset = () => { setCsv(''); setResult(null); setError(''); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-500">
                Enter recipients below (one per line) in the format:<br />
                <code className="text-xs bg-gray-100 px-1 rounded">Name, Phone, Email (optional)</code>
              </p>

              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm text-gray-500" />
                <span className="text-xs text-gray-400">or paste below</span>
              </div>

              <textarea
                value={csv}
                onChange={e => setCsv(e.target.value)}
                rows={8}
                placeholder={placeholder || 'John Doe, 9876543210, john@example.com\nJane Smith, 9123456789'}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
              />

              <p className="text-xs text-gray-400">{parseRecipients(csv).length} valid recipients (max 50)</p>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button onClick={send} disabled={sending || !csv.trim()} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {sending ? 'Sending...' : `Send to ${parseRecipients(csv).length || 0} recipients`}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-4 text-center">
                <div className="flex-1 bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{result.sent?.length || 0}</div>
                  <div className="text-xs text-green-600 mt-1">Sent</div>
                </div>
                <div className="flex-1 bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">{result.failed?.length || 0}</div>
                  <div className="text-xs text-red-600 mt-1">Failed</div>
                </div>
              </div>
              {result.failed?.length > 0 && (
                <div className="bg-red-50 rounded p-3 text-xs text-red-700 max-h-32 overflow-y-auto">
                  {result.failed.map((f, i) => <div key={i}>{f.phone || f.error}</div>)}
                </div>
              )}
              <button onClick={reset} className="w-full py-2 text-sm text-blue-600 hover:underline">Send another batch</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
