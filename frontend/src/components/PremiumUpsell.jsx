import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadApi, trackEvent } from '../services/api'

/**
 * PremiumUpsell — 3-tier value ladder pricing
 * ───────────────────────────────────────────────────────
 * Props:
 *   assessmentId  string — needed to route to payment
 *   onClose       fn — if provided renders as dismissable modal
 *   inline        bool — renders inline (no modal wrapper)
 *   fromPlan      string — "free"|"standard" — determines which plans to highlight
 */

const PLANS = [
  {
    id: 'standard',
    label: 'Full Report',
    price: '₹499',
    priceNum: 499,
    badge: null,
    highlight: false,
    description: 'Everything you need to choose the right stream with confidence.',
    features: [
      '30 adaptive AI questions',
      'Stream recommendation with confidence %',
      '7 ranked career matches',
      'Subject recommendations',
      '3-year career roadmap',
      'Top college suggestions',
      'Parent guidance section',
      'PDF download (lifetime access)',
    ],
    cta: '🔓 Unlock Full Report — ₹499',
    ctaSecondary: null,
  },
  {
    id: 'premium',
    label: 'Premium AI Report',
    price: '₹1,999',
    priceNum: 1999,
    badge: '⭐ Most Popular',
    highlight: true,
    description: 'Deep AI analysis + personalised roadmap. Like having a top IIT/IIM counsellor.',
    features: [
      'Everything in Full Report',
      'Exhaustive AI-powered career blueprint',
      'Must-take vs avoid subject strategy',
      'Competitive exam timeline (JEE/NEET/CAT)',
      'Year-by-year roadmap: Class 11 → first job',
      'Salary outlook for each career match',
      'Future-scope analysis (2030–2040)',
      'Scholarship opportunities list',
    ],
    cta: '🚀 Get Premium AI Report — ₹1,999',
    ctaSecondary: 'Most students who see this choose Premium',
  },
  {
    id: 'consultation',
    label: '1:1 Career Blueprint Session',
    price: '₹9,999',
    priceNum: 9999,
    badge: '🔥 Limited — 3/day',
    highlight: false,
    description: 'Exclusive 45-min session with Adish Gupta. Personalised. Recorded. Life-changing.',
    features: [
      'Everything in Premium AI Report',
      '45-minute 1:1 with Adish Gupta',
      'Fully personalised career roadmap',
      'Live Q&A — parents can join',
      'Session recording shared within 24h',
      'Email support for 30 days post-session',
      'Priority report generation',
    ],
    cta: '📞 Book Session with Adish Gupta — ₹9,999',
    ctaSecondary: 'Only 3 slots per day — book now',
  },
]

export default function PremiumUpsell({ assessmentId, onClose, inline = false, fromPlan = 'free' }) {
  const navigate = useNavigate()
  const [loadingPlan, setLoadingPlan] = useState(null)

  // Only show plans above the user's current plan
  const visiblePlans = fromPlan === 'standard'
    ? PLANS.filter((p) => p.id === 'premium' || p.id === 'consultation')
    : PLANS

  const handleSelect = (plan) => {
    if (!assessmentId && plan.id !== 'consultation') {
      toast.error('Assessment details missing. Please open this from your report page.')
      navigate('/dashboard')
      return
    }
    setLoadingPlan(plan.id)
    leadApi.update({ selectedPlan: plan.id, planType: plan.id }).catch(() => {})
    trackEvent('plan_selected', { plan: plan.id, priceRupees: plan.priceNum, assessmentId, source: inline ? 'report_inline' : 'report_modal' })
    const params = new URLSearchParams({ plan: plan.id })
    if (assessmentId) params.set('assessmentId', assessmentId)
    navigate(`/payment?${params.toString()}`)
  }

  const content = (
    <div className="relative">
      {onClose && (
        <button onClick={onClose} className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">×</button>
      )}

      {/* Hook headline */}
      <div className="text-center mb-8">
        <div className="inline-block bg-red-50 text-brand-red text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wide">
          ⚠️ YOUR STRONGEST CAREER PATH IS LOCKED 🔒
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-brand-dark leading-tight">
          One Wrong Decision Can Cost
          <span className="text-brand-red"> 3–5 Years of Your Life</span>
        </h2>
        <p className="text-gray-600 mt-3 text-sm max-w-lg mx-auto leading-relaxed">
          You are <strong>NOT suited for random stream selection</strong>. Based on your answers, you have a clear aptitude signal — but the exact career path is locked behind your chosen plan.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-semibold px-4 py-2 rounded-full border border-orange-200">
          ⏳ 47 students from your city unlocked clarity this week
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {visiblePlans.map((plan) => (
          <div key={plan.id} className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all ${
            plan.highlight
              ? 'border-brand-red shadow-2xl scale-[1.02] bg-white'
              : 'border-gray-200 bg-gray-50'
          }`}>
            {plan.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                plan.id === 'premium' ? 'bg-brand-red text-white' : 'bg-orange-500 text-white'
              }`}>
                {plan.badge}
              </div>
            )}

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{plan.label}</div>
              <div className="text-3xl font-extrabold text-brand-dark">{plan.price}</div>
              <p className="text-xs text-gray-500 mt-1 leading-snug">{plan.description}</p>
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-brand-red' : 'text-green-600'}`}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect(plan)}
              disabled={loadingPlan !== null}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
                plan.highlight
                  ? 'bg-brand-red text-white hover:bg-red-700'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {loadingPlan === plan.id ? 'Redirecting…' : plan.cta}
            </button>
            {plan.ctaSecondary && (
              <p className="text-center text-xs text-gray-400 mt-2">{plan.ctaSecondary}</p>
            )}
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-1 text-yellow-500 mb-1">{'★'.repeat(5)}</div>
        <p className="text-sm text-gray-700 italic">
          "Beta ko pehle lagta tha Science lega. Report dekhi toh samjha Commerce aur CA uske liye better hai. Best ₹499 we spent this year!"
        </p>
        <p className="text-xs text-gray-500 mt-2">— Sunita Agarwal, Parent, Jaipur (Class 11 son)</p>
      </div>

      <p className="text-center text-xs text-gray-400">
        🔒 Secured by Razorpay &nbsp;|&nbsp; 💳 UPI, Cards, Net Banking accepted &nbsp;|&nbsp; ✅ One-time payment
      </p>
      {onClose && (
        <div className="text-center mt-3">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">
            No thanks, I'll figure it out myself
          </button>
        </div>
      )}
    </div>
  )

  if (inline) return <div className="card">{content}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        {content}
      </div>
    </div>
  )
}


const BENEFITS = [
  { icon: '🧠', title: 'Deep Personality Analysis', desc: '30 adaptive questions vs 10 — 3× more data points for a precise fit.' },
  { icon: '🎯', title: 'Stream Clarity', desc: 'Science, Commerce, or Arts — we break it down with confidence scores.' },
  { icon: '🗺️', title: 'Personalised Roadmap', desc: 'Year-by-year action plan from Class 11 to your first job.' },
  { icon: '💼', title: '7 Career Matches', desc: 'Ranked career fits with entrance exams, top colleges, and salary outlook.' },
  { icon: '📚', title: 'Subject Recommendations', desc: 'Exactly which subjects to pick and why, based on your aptitude.' },
  { icon: '📄', title: 'PDF Download', desc: 'Shareable PDF report to discuss with parents, teachers, and counsellors.' },
  { icon: '👨‍👩‍👧', title: 'Parent Guidance Section', desc: "How to support your child's career journey — specific to their profile." },
]

const COMPARISON = [
  { feature: 'Questions answered',         free: '10',    paid: '30 (adaptive)' },
  { feature: 'Career options shown',        free: '3',     paid: '7 ranked' },
  { feature: 'Stream recommendation',       free: '✓ Basic', paid: '✓ With confidence %' },
  { feature: 'Personality analysis',        free: '✗',     paid: '✓ Full' },
  { feature: 'Subject recommendations',     free: '✗',     paid: '✓ Detailed' },
  { feature: '3-year career roadmap',       free: '✗',     paid: '✓ Personalised' },
  { feature: 'Top college suggestions',     free: '✗',     paid: '✓' },
  { feature: 'Parent guidance section',     free: '✗',     paid: '✓' },
  { feature: 'PDF download',                free: '✗',     paid: '✓ Lifetime access' },
]

export default function PremiumUpsell({ assessmentId, onClose, inline = false }) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const handleGetPremium = () => {
    if (!assessmentId) {
      toast.error('Assessment details missing. Please open this from your report page.')
      navigate('/dashboard')
      return
    }

    setIsLoading(true)
    localStorage.setItem('cg_selected_plan', 'paid')
    leadApi.update({ selectedPlan: 'paid', status: 'plan_selected' }).catch(() => {})
    trackEvent('premium_cta_clicked', {
      assessmentId,
      source: inline ? 'report_inline' : 'report_modal',
    })
    navigate(`/payment?assessmentId=${assessmentId}`)
  }

  const content = (
    <div className="relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      )}

      {/* Headline */}
      <div className="text-center mb-6">
        <div className="inline-block bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full mb-3">
          💎 UPGRADE TO PREMIUM — ₹499 ONE-TIME
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-brand-dark leading-tight">
          One Wrong Stream Choice Can Cost
          <span className="text-brand-red"> 3 Years of Your Life</span>
        </h2>
        <p className="text-gray-600 mt-3 text-sm leading-relaxed max-w-lg mx-auto">
          Your free report shows you the direction. The premium report gives you the <strong>exact roadmap</strong> — which stream, which subjects, which colleges, and which career fits you best. Not guesswork. <strong>AI-powered precision.</strong>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
          <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-medium">✅ Instant delivery</span>
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium">✅ One-time payment</span>
          <span className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full font-medium">✅ Lifetime access</span>
        </div>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <span className="text-2xl shrink-0">{b.icon}</span>
            <div>
              <div className="font-semibold text-sm text-brand-dark">{b.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="text-left p-3">Feature</th>
              <th className="text-center p-3">Free</th>
              <th className="text-center p-3 text-brand-red bg-red-50">Premium ₹499</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row, i) => (
              <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="p-3 text-gray-700">{row.feature}</td>
                <td className="p-3 text-center text-gray-400">{row.free}</td>
                <td className="p-3 text-center font-semibold text-green-700 bg-green-50/30">{row.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Social proof */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-1 text-yellow-500 mb-1">{'★'.repeat(5)}</div>
        <p className="text-sm text-gray-700 italic">
          "Beta ko pehle lagta tha Science lega. Report dekhi toh samjha Commerce aur CA uske liye better hai. Best ₹499 we spent this year!"
        </p>
        <p className="text-xs text-gray-500 mt-2">— Sunita Agarwal, Parent, Jaipur (Class 11 son)</p>
      </div>

      {/* CTA */}
      <div className="text-center">
        <div className="text-4xl font-extrabold text-brand-red mb-1">₹499</div>
        <div className="text-xs text-gray-400 mb-1">One-time · Lifetime access · Instant delivery</div>
        <div className="text-xs text-orange-600 font-semibold mb-4">⏳ 47 students from your city upgraded this week</div>
        <button
          onClick={handleGetPremium}
          disabled={isLoading}
          className="w-full btn-primary py-4 text-lg font-bold disabled:opacity-60"
        >
          {isLoading ? 'Redirecting to Payment…' : '🔓 Unlock My Exact Career Path — ₹499'}
        </button>
        <p className="text-xs text-gray-400 mt-3">
          🔒 Secured by Razorpay &nbsp;|&nbsp; 💳 UPI, Cards, Net Banking accepted
        </p>
        {onClose && (
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline">
            No thanks, I'll take my chances
          </button>
        )}
      </div>
    </div>
  )

  if (inline) return <div className="card">{content}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {content}
      </div>
    </div>
  )
}
