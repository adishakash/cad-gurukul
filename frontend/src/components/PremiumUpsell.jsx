import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadApi, trackEvent } from '../services/api'
import { useTranslation } from 'react-i18next'

/**
 * PremiumUpsell — 3-tier value ladder pricing
 * ───────────────────────────────────────────────────────
 * Props:
 *   assessmentId  string — needed to route to payment
 *   onClose       fn — if provided renders as dismissable modal
 *   inline        bool — renders inline (no modal wrapper)
 *   fromPlan      string — "free"|"standard" — determines which plans to highlight
 */


export default function PremiumUpsell({ assessmentId, onClose, inline = false, fromPlan = 'free' }) {
  const navigate = useNavigate()
  const [loadingPlan, setLoadingPlan] = useState(null)
  const { t } = useTranslation()

  const plans = t('premiumUpsell.plans', { returnObjects: true })

  // Only show plans above the user's current plan
  const visiblePlans = fromPlan === 'standard'
    ? plans.filter((p) => p.id === 'premium' || p.id === 'consultation')
    : plans

  const handleSelect = (plan) => {
    if (!assessmentId && plan.id !== 'consultation') {
      toast.error(t('premiumUpsell.errors.missingAssessment'))
      navigate('/dashboard')
      return
    }
    setLoadingPlan(plan.id)
    leadApi.update({ selectedPlan: 'paid', planType: plan.id, status: 'plan_selected' }).catch(() => {})
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
          {t('premiumUpsell.badge')}
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-brand-dark leading-tight">
          {t('premiumUpsell.headline')}
          <span className="text-brand-red">{t('premiumUpsell.headlineEmphasis')}</span>
        </h2>
        <p className="text-gray-600 mt-3 text-sm max-w-lg mx-auto leading-relaxed">
          {t('premiumUpsell.subtext')}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-xs font-semibold px-4 py-2 rounded-full border border-orange-200">
          {t('premiumUpsell.urgency')}
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
              {loadingPlan === plan.id ? t('premiumUpsell.redirecting') : plan.cta}
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
          {t('premiumUpsell.socialProof.quote')}
        </p>
        <p className="text-xs text-gray-500 mt-2">{t('premiumUpsell.socialProof.author')}</p>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t('premiumUpsell.footer')}
      </p>
      {onClose && (
        <div className="text-center mt-3">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 underline">
            {t('premiumUpsell.noThanks')}
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
