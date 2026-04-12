import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectAssessment } from '../store/slices/assessmentSlice'
import { selectUser } from '../store/slices/authSlice'
import { leadApi, paymentApi, trackEvent } from '../services/api'
import toast from 'react-hot-toast'

// ── Value ladder plan config ──────────────────────────────────────────────────
const PLAN_CONFIG = {
  standard: {
    label: 'Full Report',
    price: '₹499',
    priceNum: 499,
    originalPrice: '₹999',
    badge: null,
    color: 'brand-red',
    description: 'One-time · Instant access · Lifetime report',
    urgency: '47 students from your city upgraded this week',
    features: [
      '30 adaptive AI questions',
      '7 ranked career matches',
      'Stream recommendation with confidence %',
      'Subject recommendations',
      '3-year career roadmap',
      'Top college suggestions',
      'Parent guidance section',
      'PDF download (lifetime access)',
    ],
    cta: '💎 Pay ₹499 & Unlock Full Report',
    successMsg: 'Payment successful! Your report is being generated…',
  },
  premium: {
    label: 'Premium AI Report',
    price: '₹1,999',
    priceNum: 1999,
    originalPrice: '₹3,999',
    badge: '⭐ Most Popular',
    color: 'purple-600',
    description: 'One-time · Deeper AI · Lifetime access',
    urgency: 'Only 12 students have accessed this this week',
    features: [
      'Everything in Full Report',
      'Deep AI career blueprint',
      'Subject strategy: must-take vs avoid',
      'Year-by-year roadmap: Class 11 → job',
      'Competitive exam timeline',
      'Salary outlook per career match',
      'Scholarship opportunities list',
      'Future-scope analysis (2030–2040)',
    ],
    cta: '🚀 Pay ₹1,999 & Get Premium AI Report',
    successMsg: 'Payment successful! Your Premium AI Report is being generated…',
  },
  consultation: {
    label: '1:1 Career Blueprint Session',
    price: '₹9,999',
    priceNum: 9999,
    originalPrice: null,
    badge: '🔥 Limited — 3/day',
    color: 'orange-500',
    description: '45-min live session · Recording included',
    urgency: 'Only 3 slots per day — book before they fill up',
    features: [
      'Everything in Premium AI Report',
      '45-min 1:1 session with Adish Gupta',
      'Fully personalised career blueprint',
      'Live Q&A — parents can join',
      'Session recording within 24h',
      '30-day email support',
      'Priority report generation',
    ],
    cta: '📞 Book Session with Adish Gupta — ₹9,999',
    successMsg: 'Booking confirmed! Our team will contact you within 24 hours to schedule your session.',
  },
}

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

export default function Payment() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useSelector(selectUser)
  const assessment = useSelector(selectAssessment)

  // Plan comes from URL ?plan= (standard | premium | consultation)
  const planId      = searchParams.get('plan') || 'standard'
  const plan        = PLAN_CONFIG[planId] || PLAN_CONFIG.standard
  const assessmentId = searchParams.get('assessmentId') || assessment?.id

  const [loading, setLoading] = useState(false)

  // Track page view
  useEffect(() => {
    trackEvent('payment_page_viewed', { plan: planId, source: document.referrer })
  }, [planId])

  const handlePayment = async () => {
    if (planId !== 'consultation' && !assessmentId) {
      toast.error('Assessment not found. Please complete the assessment first.')
      navigate('/dashboard')
      return
    }
    setLoading(true)
    try {
      leadApi.update({ status: 'payment_pending', planType: planId }).catch(() => {})

      const loaded = await loadRazorpay()
      if (!loaded) {
        toast.error('Could not load payment gateway. Check your internet connection.')
        return
      }

      const { data } = await paymentApi.createOrder(assessmentId, planId)

      const options = {
        key: data.data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.data.amount,
        currency: data.data.currency,
        name: 'CAD Gurukul',
        description: plan.label,
        image: '/logo.svg',
        order_id: data.data.orderId,
        prefill: {
          name: user?.fullName || user?.email?.split('@')[0] || '',
          email: user?.email || '',
        },
        theme: { color: '#e53e3e' },
        handler: async (response) => {
          try {
            await paymentApi.verify({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            trackEvent('payment_success', { plan: planId, amount: plan.priceNum })
            leadApi.update({ planType: planId }).catch(() => {})
            toast.success(plan.successMsg)
            navigate('/dashboard')
          } catch {
            toast.error('Payment verification failed. Contact support if amount was deducted.')
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled. You can retry anytime.'),
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to initiate payment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Urgency header */}
        <div className="text-center mb-8">
          <p className="text-xs text-orange-600 font-semibold bg-orange-50 inline-block px-4 py-1.5 rounded-full border border-orange-200 mb-4">
            ⚠️ This decision impacts your next 5 years
          </p>
          <h1 className="text-3xl font-extrabold text-brand-dark">
            {plan.label}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
        </div>

        {/* Plan card */}
        <div className="card border-2 border-brand-red shadow-2xl mb-6 relative overflow-hidden">
          {plan.badge && (
            <div className="absolute top-4 right-4 bg-brand-red text-white text-xs font-bold px-3 py-1 rounded-full">
              {plan.badge}
            </div>
          )}

          <div className="mb-5">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-red">{plan.label}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-4xl font-extrabold text-brand-dark">{plan.price}</div>
              {plan.originalPrice && (
                <span className="text-sm text-gray-400 line-through">{plan.originalPrice}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">One-time payment · No subscription · Lifetime access</p>
          </div>

          <ul className="space-y-2 mb-6">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                <span className="text-brand-red mt-0.5 shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>

          {/* Urgency text */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-5 text-center">
            <p className="text-xs text-orange-700 font-semibold">⏳ {plan.urgency}</p>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Opening Payment…
              </>
            ) : plan.cta}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            🔒 Secured by Razorpay &nbsp;|&nbsp; 💳 UPI, Cards, Net Banking accepted
          </p>
        </div>

        {/* Plan switcher */}
        <div className="card mb-6">
          <h3 className="font-semibold text-brand-dark text-sm mb-3">Or choose a different plan:</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PLAN_CONFIG).map(([id, p]) => (
              <button
                key={id}
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  params.set('plan', id)
                  navigate(`/payment?${params.toString()}`, { replace: true })
                }}
                className={`text-center rounded-xl border-2 p-3 transition text-xs font-semibold ${
                  planId === id
                    ? 'border-brand-red bg-red-50 text-brand-red'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="font-bold">{p.price}</div>
                <div className="font-normal text-gray-500 mt-0.5 leading-tight">{p.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center text-xs text-gray-600">
          <div className="text-yellow-500 mb-1">★★★★★</div>
          <p className="italic">"Best investment we made for our child's future. The report was spot on."</p>
          <p className="text-gray-400 mt-1">— Rajesh Verma, Parent, Delhi</p>
        </div>
      </div>
    </div>
  )
}


const features = {
  free: [
    '10 adaptive AI questions',
    'Top 3 career suggestions',
    'Basic stream recommendation',
    'Personality overview',
  ],
  paid: [
    '30 in-depth adaptive AI questions',
    '15+ detailed career paths',
    'Full stream & subject mapping',
    'Downloadable PDF report',
    'Roadmap for each career',
    'Parent guidance section',
    'College & entrance exam guide',
    'Priority AI model (GPT-4o)',
  ],
}

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

export default function Payment() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useSelector(selectUser)
  const assessment = useSelector(selectAssessment)
  // assessmentId can come from URL param (when navigating from PremiumUpsell) or Redux state
  const assessmentId = searchParams.get('assessmentId') || assessment?.id
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    if (!assessmentId) {
      toast.error('Assessment not found. Please complete the assessment first.')
      navigate('/dashboard')
      return
    }
    setLoading(true)
    try {
      leadApi.update({ status: 'payment_pending' }).catch(() => {})

      const loaded = await loadRazorpay()
      if (!loaded) {
        toast.error('Could not load payment gateway. Check your internet connection.')
        return
      }

      const { data } = await paymentApi.createOrder(assessmentId)

      const options = {
        key: data.data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.data.amount,
        currency: data.data.currency,
        name: 'CAD Gurukul',
        description: 'Premium Career Report',
        image: '/logo.svg',
        order_id: data.data.orderId,
        prefill: {
          name: user?.fullName || user?.email?.split('@')[0] || '',
          email: user?.email || '',
        },
        theme: { color: '#e53e3e' },
        handler: async (response) => {
          try {
            await paymentApi.verify({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            leadApi.update({ status: 'premium_report_generating' }).catch(() => {})
            toast.success('Payment successful! Your premium report is being generated…')
            navigate('/dashboard')
          } catch {
            toast.error('Payment verification failed. Contact support if amount was deducted.')
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled. You can retry anytime.'),
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to initiate payment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-brand-dark mb-3">
            Upgrade to <span className="text-brand-red">Premium</span>
          </h1>
          <p className="text-gray-500 text-lg">One-time payment · Instant access · Lifetime report</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Free plan */}
          <div className="card border-2 border-gray-200">
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Free Plan</span>
              <div className="text-3xl font-extrabold text-gray-700 mt-1">₹0</div>
            </div>
            <ul className="space-y-2 mb-6">
              {features.free.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/assessment?plan=FREE')}
              className="btn-outline w-full"
            >
              Start Free Assessment
            </button>
          </div>

          {/* Premium plan */}
          <div className="card border-2 border-brand-red relative overflow-hidden shadow-xl">
            <div className="absolute top-4 right-4 bg-brand-red text-white text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </div>
            <div className="mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-red">Premium Plan</span>
              <div className="text-3xl font-extrabold text-brand-dark mt-1">
                ₹499 <span className="text-sm font-normal text-gray-400 line-through ml-1">₹999</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">One-time · No subscription</p>
            </div>
            <ul className="space-y-2 mb-6">
              {features.paid.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <span className="text-brand-red">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handlePayment}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Opening Payment...
                </>
              ) : '💎 Pay ₹499 & Get Full Report'}
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-400">
          🔒 Secured by Razorpay · UPI, Cards, Net Banking accepted · Instant download after payment
        </div>
      </div>
    </div>
  )
}
