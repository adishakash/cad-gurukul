import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectAssessment } from '../store/slices/assessmentSlice'
import { selectUser } from '../store/slices/authSlice'
import api from '../services/api'
import toast from 'react-hot-toast'

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
  const user = useSelector(selectUser)
  const assessment = useSelector(selectAssessment)
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)
    try {
      const loaded = await loadRazorpay()
      if (!loaded) {
        toast.error('Could not load payment gateway. Check your internet connection.')
        return
      }

      const { data } = await api.post('/payments/create-order', {
        assessmentId: assessment?.id,
      })

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.data.amount,
        currency: data.data.currency,
        name: 'CAD Gurukul',
        description: 'Premium Career Report',
        image: '/logo.png',
        order_id: data.data.razorpayOrderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: '#e53e3e' },
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              internalOrderId: data.data.id,
            })
            toast.success('Payment successful! Starting premium assessment...')
            navigate('/assessment?plan=PAID')
          } catch {
            toast.error('Payment verification failed. Contact support.')
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled.'),
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to initiate payment.')
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
