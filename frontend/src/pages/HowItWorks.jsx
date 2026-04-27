import { useTranslation } from 'react-i18next'
import Seo from '../components/SEO/Seo'

export default function HowItWorks() {
  const { t } = useTranslation()
  const steps = t('howItWorks.steps', { returnObjects: true })
  const faqs = t('howItWorks.faq.items', { returnObjects: true })
  const faqStructuredData = Array.isArray(faqs) && faqs.length
    ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    }
    : null

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="How CAD Gurukul Works | AI Career Guidance Steps"
        description="See how our assessment, stream mapping, and counselling workflow builds a personalized career roadmap."
        structuredData={faqStructuredData}
      />
      {/* Hero */}
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t('howItWorks.hero.title')}</h1>
        <p className="text-lg text-gray-300 max-w-xl mx-auto">
          {t('howItWorks.hero.subtitle')}
        </p>
      </section>

      {/* Steps */}
      <section className="py-16 px-4 max-w-4xl mx-auto">
        <div className="space-y-12">
          {steps.map((step, i) => (
            <div key={step.number} className={`flex gap-6 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-brand-red text-white flex flex-col items-center justify-center font-extrabold text-xs md:w-20 md:h-20">
                <span className="text-2xl">{step.icon}</span>
                <span className="opacity-70">{step.number}</span>
              </div>
              <div className="card flex-1 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-extrabold text-brand-dark mb-2">{step.title}</h3>
                <p className="text-gray-700 mb-3">{step.desc}</p>
                <p className="text-sm text-gray-500 border-t pt-3">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-brand-dark text-center mb-10">{t('howItWorks.faq.title')}</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="card group cursor-pointer">
                <summary className="font-semibold text-brand-dark flex items-center justify-between list-none">
                  {faq.q}
                  <span className="text-brand-red group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
