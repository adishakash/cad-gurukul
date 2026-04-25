import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { partnerJoinApi } from '../../services/api'

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true)
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.onload = () => resolve(true)
  script.onerror = () => resolve(false)
  document.body.appendChild(script)
})

const formatPaise = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN')}`

export default function PartnerRegister() {
  const [form, setForm] = useState({
    fullName: '',
    education: '',
    address: '',
    pincode: '',
    email: '',
    phone: '',
  })
  const [docs, setDocs] = useState({ graduation: null, idProof: null })
  const [coupon, setCoupon] = useState('')
  const [quote, setQuote] = useState(null)
  const [couponMsg, setCouponMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    partnerJoinApi.quote({}).then((res) => setQuote(res.data?.data)).catch(() => {})
  }, [])

  const applyCoupon = async () => {
    setCouponMsg('')
    try {
      const { data } = await partnerJoinApi.quote({ couponCode: coupon.trim() })
      setQuote(data.data)
      setCouponMsg(coupon.trim() ? 'Coupon applied.' : '')
    } catch (err) {
      setCouponMsg(err.response?.data?.error?.message || 'Invalid coupon')
    }
  }

  const summary = useMemo(() => ({
    baseAmountPaise: quote?.baseAmountPaise ?? 4999900,
    discountPaise: quote?.discountPaise ?? 0,
    gstAmountPaise: quote?.gstAmountPaise ?? 0,
    totalAmountPaise: quote?.totalAmountPaise ?? quote?.amountPaise ?? 4999900,
    gstRate: quote?.gstRate ?? 18,
    gstIncluded: quote?.gstIncluded ?? true,
  }), [quote])

  const updateForm = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required'
    if (!form.education.trim()) return 'Education is required'
    if (!form.address.trim()) return 'Address is required'
    if (!/^\d{6}$/.test(form.pincode.trim())) return 'Valid 6-digit pin code is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Valid email is required'
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) return 'Valid 10-digit phone is required'
    if (!docs.graduation) return 'Graduation certificate is required'
    if (!docs.idProof) return 'ID proof is required'
    return ''
  }

  const startPayment = async () => {
    const error = validate()
    if (error) {
      setCouponMsg(error)
      return
    }

    setLoading(true)
    setCouponMsg('')

    try {
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load payment gateway. Please try again.')

      const payload = new FormData()
      payload.append('fullName', form.fullName.trim())
      payload.append('education', form.education.trim())
      payload.append('address', form.address.trim())
      payload.append('pincode', form.pincode.trim())
      payload.append('email', form.email.trim())
      payload.append('phone', form.phone.trim())
      if (coupon.trim()) payload.append('couponCode', coupon.trim())
      payload.append('graduationCertificate', docs.graduation)
      payload.append('idProof', docs.idProof)

      const { data } = await partnerJoinApi.createOrder(payload)
      const order = data.data
      setQuote(order)

      const options = {
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: 'CAD Gurukul',
        description: 'Counsellor Onboarding',
        order_id: order.orderId,
        prefill: {
          name: form.fullName.trim(),
          email: form.email.trim(),
          contact: form.phone.trim(),
        },
        theme: { color: '#0f172a' },
        handler: async (response) => {
          try {
            await partnerJoinApi.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            setSuccess(true)
          } catch (err) {
            setCouponMsg(err.response?.data?.error?.message || 'Payment verification failed.')
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setCouponMsg(err.response?.data?.error?.message || err.message || 'Payment initiation failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-semibold">Welcome to CAD Gurukul</h1>
          <p className="text-slate-300 mt-2">
            Your counsellor account is active. Login ID and password have been sent to your email and WhatsApp.
          </p>
          <div className="mt-6">
            <Link to="/staff/login" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold">
              Go to Counsellor Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-amber-50 to-rose-50 px-4 py-12">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
        <section className="space-y-6">
          <div className="bg-white/80 border border-amber-200 rounded-3xl p-8 shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-600 font-semibold">Counsellor Network</p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 mt-3">
              Join as a CAD Gurukul Counsellor
            </h1>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Build credibility, get verified, and start serving students with CAD Gurukul tools, training, and referrals.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {[
                { label: 'Verified badge', desc: 'Stand out in your city' },
                { label: 'Lead pipeline', desc: 'Warm student referrals' },
                { label: 'Tools + training', desc: 'Weekly enablement kits' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-900 text-white rounded-2xl p-4">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-slate-300 mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Why we ask for documents</h2>
            <p className="text-sm text-slate-600 mt-2">
              We verify credentials to maintain student trust. Documents are kept private and reviewed only by admin.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="bg-slate-100 px-3 py-1 rounded-full">Accepted: PDF, JPG, PNG</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full">Max 10 MB each</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full">GST included in fee</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <h2 className="text-xl font-semibold text-slate-900">Counsellor Application</h2>
          <p className="text-sm text-slate-500 mt-1">Complete all fields to proceed to payment.</p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">Counsellor Name</label>
              <input
                name="fullName"
                value={form.fullName}
                onChange={updateForm}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Education</label>
              <input
                name="education"
                value={form.education}
                onChange={updateForm}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Highest qualification"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={updateForm}
                rows={3}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Street, city, state"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">PIN</label>
                <input
                  name="pincode"
                  value={form.pincode}
                  onChange={updateForm}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="6-digit PIN"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={updateForm}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="10-digit mobile"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                name="email"
                value={form.email}
                onChange={updateForm}
                className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="you@example.com"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Upload Graduation Certificate</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocs((prev) => ({ ...prev, graduation: e.target.files?.[0] || null }))}
                  className="mt-1 w-full text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Upload Aadhar / Licence / Passport</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocs((prev) => ({ ...prev, idProof: e.target.files?.[0] || null }))}
                  className="mt-1 w-full text-sm"
                />
              </div>
            </div>

            <div className="border border-dashed border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Join fee</span>
                <span className="font-semibold text-slate-900">{formatPaise(summary.baseAmountPaise)}</span>
              </div>
              {summary.discountPaise > 0 && (
                <div className="flex items-center justify-between text-sm text-green-600 mt-2">
                  <span>Discount</span>
                  <span>-{formatPaise(summary.discountPaise)}</span>
                </div>
              )}
              {summary.gstIncluded && summary.gstAmountPaise > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                  <span>GST ({summary.gstRate}%) included</span>
                  <span>{formatPaise(summary.gstAmountPaise)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-semibold text-slate-900 mt-3">
                <span>Total payable</span>
                <span>{formatPaise(summary.totalAmountPaise)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Apply discount coupon"
              />
              <button
                type="button"
                onClick={applyCoupon}
                className="px-4 py-2.5 rounded-xl border border-slate-900 text-slate-900 text-sm font-semibold hover:bg-slate-900 hover:text-white"
              >
                Apply
              </button>
            </div>

            {couponMsg && <p className="text-sm text-slate-600">{couponMsg}</p>}

            <button
              type="button"
              onClick={startPayment}
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Opening payment...' : `Pay ${formatPaise(summary.totalAmountPaise)} & Submit`}
            </button>

            <p className="text-xs text-slate-500 text-center">
              By continuing, you agree to CAD Gurukul partner terms. Payments are secured by Razorpay.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
