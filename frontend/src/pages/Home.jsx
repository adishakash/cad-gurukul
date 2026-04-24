import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LeadCaptureForm from '../components/LeadCaptureForm'
import { useTranslation } from 'react-i18next'

const careers = ['Engineering', 'Medicine', 'Law', 'Commerce & Finance', 'Design & Arts', 'Civil Services', 'Teaching', 'Entrepreneurship', 'IT & Software', 'Media & Journalism', 'Architecture', 'Psychology']

export default function Home() {
  const navigate = useNavigate()
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [capturePlan, setCapturePlan] = useState('free')
  const { t } = useTranslation()

  const stats = t('home.stats', { returnObjects: true })
  const steps = t('home.howItWorks.steps', { returnObjects: true })
  const planCards = t('home.plans.cards', { returnObjects: true })
  const testimonials = t('home.testimonials.items', { returnObjects: true })

  const openLeadModal = (plan = 'free') => {
    setCapturePlan(plan)
    setShowLeadModal(true)
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-brand-dark via-brand-navy to-blue-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-brand-light mb-6 backdrop-blur-sm">
              {t('home.hero.badge')}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              {t('home.hero.title')}
              <span className="text-brand-red">{t('home.hero.titleEmphasis')}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-4 leading-relaxed max-w-2xl">
              {t('home.hero.subtitle')}
            </p>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 mb-6 text-sm text-gray-200 italic">
              {t('home.hero.quotePrefix')} <span className="text-yellow-300 font-semibold not-italic">{t('home.hero.quoteEmphasis')}</span>{t('home.hero.quoteSuffix')}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => navigate('/assessment')} className="btn-primary text-center text-lg px-8 py-4">
                {t('home.hero.ctaPrimary')}
              </button>
              <Link to="/how-it-works" className="border-2 border-white/40 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-all text-center">
                {t('home.hero.ctaSecondary')}
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              ✅ {t('home.hero.trust.free')} &nbsp;|&nbsp; ⏱ {t('home.hero.trust.time')} &nbsp;|&nbsp; 🔒 {t('home.hero.trust.secure')}
            </p>
          </div>
        </div>

        {/* Floating cards */}
        <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 space-y-3">
          {[
            { emoji: '🎯', text: t('home.floatingCards.streamSelection'), color: 'bg-blue-500' },
            { emoji: '🧩', text: t('home.floatingCards.aptitudeAnalysis'), color: 'bg-purple-500' },
            { emoji: '📈', text: t('home.floatingCards.roadmap'), color: 'bg-green-500' },
            { emoji: '🎓', text: t('home.floatingCards.collegeGuidance'), color: 'bg-orange-500' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-3">
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-sm font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Stats ────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-brand-navy">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">{t('home.howItWorks.title')}</h2>
          <p className="section-subtitle mb-14">{t('home.howItWorks.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-brand-red to-transparent z-0" />
                )}
                <div className="card text-center hover:shadow-lg transition-shadow relative z-10">
                  <div className="text-4xl mb-3">{s.emoji}</div>
                  <div className="text-xs font-bold text-brand-red tracking-widest mb-2">{t('home.howItWorks.stepLabel', { step: s.step })}</div>
                  <h3 className="font-bold text-brand-dark mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Careers Explored ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">{t('home.careers.title')}</h2>
          <p className="section-subtitle mb-10">{t('home.careers.subtitle')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {careers.map((c) => (
              <span key={c} className="bg-primary-50 text-primary-700 border border-primary-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-100 transition-colors cursor-default">
                {c}
              </span>
            ))}
            <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-medium">{t('home.careers.more')}</span>
          </div>
        </div>
      </section>

      {/* ─── Plans CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-brand-navy to-brand-dark text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('home.plans.title')} <span className="text-brand-red">{t('home.plans.priceHighlight')}</span>
          </h2>
          <p className="text-gray-300 mb-10 text-lg">
            {t('home.plans.subtitle')}
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
            {planCards.map((p) => (
              <div key={p.plan} className="bg-white/10 border border-white/20 rounded-2xl p-6 text-left">
                <div className="text-2xl font-bold text-white mb-1">{p.plan}</div>
                <div className="text-3xl font-bold text-brand-red mb-4">{p.price}</div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openLeadModal(p.value)}
                  className={p.outline ? 'btn-outline w-full text-center block' : 'btn-primary w-full text-center block'}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400">{t('home.plans.securityNote')}</p>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-center">{t('home.testimonials.title')}</h2>
          <p className="section-subtitle text-center mb-12">{t('home.testimonials.subtitle')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div key={item.name} className="card">
                <div className="flex text-yellow-400 mb-3">{'★'.repeat(item.rating)}</div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{item.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-red to-brand-navy flex items-center justify-center text-white font-bold text-sm">
                    {item.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-brand-dark">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.class} • {item.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-16 bg-brand-red text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">{t('home.finalCta.title')}</h2>
          <p className="text-lg text-red-100 mb-2">{t('home.finalCta.line1')}</p>
          <p className="text-sm text-red-200 mb-8">{t('home.finalCta.line2')}</p>
          <button onClick={() => navigate('/assessment')} className="bg-white text-brand-red px-8 py-4 rounded-lg font-bold text-lg hover:bg-red-50 transition-colors inline-block">
            {t('home.finalCta.button')}
          </button>
        </div>
      </section>

      {/* ─── Sticky mobile CTA ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-xl">
        <div className="flex-1 text-sm">
          <div className="font-bold text-brand-dark">{t('home.stickyCta.title')}</div>
          <div className="text-xs text-gray-500">{t('home.stickyCta.subtitle')}</div>
        </div>
        <button onClick={() => navigate('/assessment')} className="btn-primary text-sm px-5 py-2">
          {t('home.stickyCta.button')}
        </button>
      </div>

      {/* ─── Lead Capture Modal ──────────────────────────────────────────────── */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowLeadModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h2 className="font-bold text-brand-dark text-lg">
                {capturePlan === 'paid' ? t('home.leadModal.titlePaid') : t('home.leadModal.titleFree')}
              </h2>
              <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <LeadCaptureForm selectedPlan={capturePlan} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
