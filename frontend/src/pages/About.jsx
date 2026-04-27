import { useTranslation } from 'react-i18next'
import Seo from '../components/SEO/Seo'

export default function About() {
  const { t } = useTranslation()
  const values = t('about.values.items', { returnObjects: true })
  const team = t('about.team.members', { returnObjects: true })

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="About CAD Gurukul | Our Mission and Team"
        description="Learn how CAD Gurukul helps Indian students choose the right stream and career path through AI-driven assessments and counselling."
      />
      {/* Hero */}
      <section className="bg-brand-dark text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{t('about.hero.title')}</h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          {t('about.hero.subtitle')}
        </p>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 max-w-3xl mx-auto text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-red">{t('about.mission.label')}</span>
        <h2 className="text-3xl font-extrabold text-brand-dark mt-2 mb-4">
          {t('about.mission.title')}
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          {t('about.mission.body')}
        </p>
      </section>

      {/* Values */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-brand-dark">{t('about.values.title')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="card flex gap-4">
                <div className="text-4xl shrink-0">{v.icon}</div>
                <div>
                  <h3 className="font-bold text-brand-dark mb-1">{v.title}</h3>
                  <p className="text-gray-600 text-sm">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-14 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold text-brand-dark">{t('about.team.title')}</h2>
          <p className="text-gray-500 mt-2 text-sm">{t('about.team.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {team.map((m) => (
            <div key={m.name} className="card text-center">
              <div className="text-5xl mb-3">{m.emoji}</div>
              <div className="font-bold text-brand-dark">{m.name}</div>
              <div className="text-sm text-gray-500 mt-1">{m.role}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
