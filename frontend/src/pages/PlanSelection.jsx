import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setPlan } from '../store/slices/leadSlice'
import { leadApi } from '../services/api'
import { useTranslation } from 'react-i18next'

export default function PlanSelection() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const planCopy = t('planSelection.plans', { returnObjects: true })
  const plans = [
    {
      key: 'free',
      color: 'border-gray-200',
      action: '/assessment?plan=FREE',
      actionClass: 'btn-outline',
    },
    {
      key: 'paid',
      color: 'border-brand-red',
      action: '/assessment?plan=FREE&intent=paid',
      actionClass: 'btn-primary',
    },
  ].map((plan) => {
    const copy = Array.isArray(planCopy) ? planCopy.find((item) => item.key === plan.key) : null
    return { ...plan, ...(copy || {}) }
  })

  const handlePlanSelect = async (plan) => {
    const planKey = plan.key
    dispatch(setPlan(planKey))
    // Fire-and-forget lead update so funnel status advances
    leadApi.update({ selectedPlan: planKey, status: 'plan_selected' }).catch(() => {})
    navigate(plan.action)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-red">{t('planSelection.eyebrow')}</span>
        <h1 className="text-4xl font-extrabold text-brand-dark mt-2 mb-3">
          {t('planSelection.title')}
        </h1>
        <p className="text-gray-500 text-lg">
          {t('planSelection.subtitle')}
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`card border-2 ${plan.color} relative overflow-hidden transition-transform hover:-translate-y-1`}
          >
            {plan.badge && (
              <div className="absolute top-4 right-4 bg-brand-red text-white text-xs font-bold px-3 py-1 rounded-full">
                {plan.badge}
              </div>
            )}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500">{plan.name}</div>
              <div className="text-4xl font-extrabold text-brand-dark mt-1">{plan.price}</div>
              <div className="text-xs text-gray-400 mt-1">{plan.hint}</div>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f.text} className={`flex items-center gap-2 text-sm ${f.ok ? 'text-gray-700' : 'text-gray-300'}`}>
                  <span className={f.ok ? 'text-green-500 font-bold' : 'text-gray-300'}>
                    {f.ok ? '✓' : '✗'}
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePlanSelect(plan)}
              className={`${plan.actionClass} w-full`}
            >
              {plan.actionLabel}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-10 text-sm text-gray-400">
        {t('planSelection.footerNote')}
      </div>
    </div>
  )
}
