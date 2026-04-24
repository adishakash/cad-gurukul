import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { joiningApi } from '../../services/api'
import { splitGstFromInclusive } from '../../utils/gst'

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('ref')

  const [link, setLink]   = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | expired | paid | success | error
  const [errMsg, setErrMsg] = useState('')

  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [formErr, setFormErr] = useState({})
  const [paying, setPaying] = useState(false)

  const razorpayRef = useRef(null)

  // ── Resolve joining link on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!code) {
      setStatus('error')
      setErrMsg('No joining link code provided.')
      return
    }
    joiningApi.resolve(code)
      .then(({ data }) => {
        const d = data.data
        if (d.isUsed || d.isExpired) {
          setStatus('expired')
        } else {
          setLink(d)
          setStatus('ready')
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Invalid or expired joining link.'
        setStatus('error')
        setErrMsg(msg)
      })
  }, [code])

  // ── Form validation ───────────────────────────────────────────────────────────
  function validate() {
    const errs = {}
    if (!form.name.trim())  errs.name  = 'Name is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email required'
    if (!/^\d{10}$/.test(form.phone)) errs.phone = 'Valid 10-digit phone required'
    setFormErr(errs)
    return Object.keys(errs).length === 0
  }

  // ── Start Razorpay checkout ───────────────────────────────────────────────────
  async function handlePay() {
    if (!validate()) return
    setPaying(true)
    setErrMsg('')

    try {
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load payment gateway. Please try again.')

      const { data } = await joiningApi.createOrder(code, {
        candidateName:  form.name,
        candidateEmail: form.email,
        candidatePhone: form.phone,
      })
      const { orderId, amountPaise, currency, keyId } = data.data

      const options = {
        key:       keyId,
        amount:    amountPaise,
        currency:  currency || 'INR',
        order_id:  orderId,
        name:      'CAD Gurukul',
        description: link?.label || 'CAD Gurukul Enrolment',
        prefill: {
          name:    form.name,
          email:   form.email,
          contact: form.phone,
        },
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await joiningApi.verify(code, {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            setStatus('success')
          } catch (err) {
            setErrMsg(err.response?.data?.message || 'Payment verification failed. Please contact support.')
          } finally {
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      }

      razorpayRef.current = new window.Razorpay(options)
      razorpayRef.current.open()
    } catch (err) {
      setErrMsg(err.message || 'Something went wrong. Please try again.')
      setPaying(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading joining link…</div>
      </div>
    )
  }

  if (status === 'expired' || status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            {status === 'expired' ? 'Link Expired or Inactive' : 'Invalid Link'}
          </h1>
          <p className="text-gray-500">{errMsg || 'This joining link is no longer valid. Please contact your counsellor.'}</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">
            Welcome to CAD Gurukul. Your enrolment has been confirmed. You will receive further details on your email.
          </p>
        </div>
      </div>
    )
  }

  // status === 'ready'
  const discountAmount = link?.discountAmountPaise
    ?? Math.round((link?.feeAmountPaise || 0) * (link?.discountPct || 0) / 100)
  const netPaise = link?.netAmountPaise ?? Math.max(0, (link?.feeAmountPaise || 0) - discountAmount)
  const gstRate = link?.gstRate ?? 18
  const gstIncluded = link?.gstIncluded ?? true
  const gstBreakdown = splitGstFromInclusive(netPaise, gstRate)
  const gstAmount = link?.gstAmountPaise ?? gstBreakdown.gstPaise
  const fmt = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white">
          <p className="text-xs uppercase tracking-widest opacity-75">CAD Gurukul</p>
          <h1 className="text-xl font-bold mt-1">{link?.label || 'Enrol Now'}</h1>
          {link?.counsellorName && (
            <p className="text-sm opacity-80 mt-1">via {link.counsellorName}</p>
          )}
        </div>

        {/* Fee summary */}
        <div className="px-6 py-4 border-b border-gray-100 bg-indigo-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Course Fee</span>
            <span>{fmt(link?.feeAmountPaise)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600 mt-1">
              <span>Discount ({link?.discountPct}%)</span>
              <span>− {fmt(discountAmount)}</span>
            </div>
          )}
          {gstIncluded && gstAmount > 0 && (
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>GST ({gstRate}%) included</span>
              <span>{fmt(gstAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-800 mt-2 text-base">
            <span>You Pay</span>
            <span>{fmt(netPaise)}</span>
          </div>
        </div>

        {/* Candidate form */}
        <div className="px-6 py-5 space-y-4">
          {[
            { id: 'name',  label: 'Full Name',    type: 'text',  placeholder: 'Your name' },
            { id: 'email', label: 'Email',         type: 'email', placeholder: 'you@example.com' },
            { id: 'phone', label: 'Mobile Number', type: 'tel',   placeholder: '10-digit number' },
          ].map(({ id, label, type, placeholder }) => (
            <div key={id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                value={form[id]}
                onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
                placeholder={placeholder}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  formErr[id] ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {formErr[id] && <p className="text-xs text-red-500 mt-1">{formErr[id]}</p>}
            </div>
          ))}

          {errMsg && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errMsg}</p>
          )}

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition"
          >
            {paying ? 'Processing…' : `Pay ${fmt(netPaise)}`}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Secured by Razorpay · Payments go directly to CAD Gurukul
          </p>
        </div>
      </div>
    </div>
  )
}
