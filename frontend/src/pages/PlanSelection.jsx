import { useNavigate } from 'react-router-dom'

const plans = [
  {
    name: 'Free',
    price: '₹0',
    hint: 'Great start',
    color: 'border-gray-200',
    action: '/assessment?plan=FREE',
    actionLabel: 'Start Free Assessment',
    actionClass: 'btn-outline',
    features: [
      { text: '10 adaptive AI questions', ok: true },
      { text: 'Top 3 career suggestions', ok: true },
      { text: 'Stream recommendation', ok: true },
      { text: 'Personality overview', ok: true },
      { text: 'Detailed career roadmaps', ok: false },
      { text: 'PDF report download', ok: false },
      { text: 'Parent guidance section', ok: false },
      { text: 'College & entrance guide', ok: false },
    ],
  },
  {
    name: 'Premium',
    price: '₹499',
    hint: 'One-time · No subscription',
    color: 'border-brand-red',
    badge: 'MOST POPULAR',
    action: '/payment',
    actionLabel: '💎 Get Full Report',
    actionClass: 'btn-primary',
    features: [
      { text: '30 in-depth adaptive questions', ok: true },
      { text: '15+ detailed career paths', ok: true },
      { text: 'Full stream & subject mapping', ok: true },
      { text: 'In-depth aptitude analysis', ok: true },
      { text: 'Career roadmaps for each path', ok: true },
      { text: 'Downloadable PDF report', ok: true },
      { text: 'Parent guidance section', ok: true },
      { text: 'College & entrance exam guide', ok: true },
    ],
  },
]

export default function PlanSelection() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-red">Pricing</span>
        <h1 className="text-4xl font-extrabold text-brand-dark mt-2 mb-3">
          Choose Your Path
        </h1>
        <p className="text-gray-500 text-lg">
          Start free or unlock a complete AI-powered career breakdown for your future.
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
              onClick={() => navigate(plan.action)}
              className={`${plan.actionClass} w-full`}
            >
              {plan.actionLabel}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-10 text-sm text-gray-400">
        🔒 Payments secured by Razorpay · UPI, Cards, Net Banking · Trusted by 10,000+ students
      </div>
    </div>
  )
}
