import { useState } from 'react'
import { useForm } from 'react-hook-form'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import Seo from '../components/SEO/Seo'

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors }, reset } = useForm()
  const { t } = useTranslation()

  const contacts = [
    { icon: '📧', label: t('contact.info.contacts.emailLabel'), value: t('contact.info.contacts.emailValue') },
    { icon: '📞', label: t('contact.info.contacts.phoneLabel'), value: t('contact.info.contacts.phoneValue') },
    { icon: '🕐', label: t('contact.info.contacts.hoursLabel'), value: t('contact.info.contacts.hoursValue') },
  ]

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      await api.post('/contact', data)
      toast.success(t('contact.toast.success'))
      setSent(true)
      reset()
    } catch {
      toast.error(t('contact.toast.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Contact CAD Gurukul | Career Guidance Support"
        description="Reach the CAD Gurukul team for student guidance, consultations, or partnership questions."
      />
      {/* Hero */}
      <section className="bg-brand-dark text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-extrabold mb-3">{t('contact.hero.title')}</h1>
        <p className="text-gray-300 max-w-md mx-auto">{t('contact.hero.subtitle')}</p>
      </section>

      <section className="py-16 px-4 max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
        {/* Info */}
        <div>
          <h2 className="text-xl font-bold text-brand-dark mb-6">{t('contact.info.title')}</h2>
          <div className="space-y-4 mb-8">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">{c.icon}</div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest">{c.label}</div>
                  <div className="font-semibold text-brand-dark">{c.value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card bg-orange-50 border border-brand-red/20">
            <h3 className="font-bold text-brand-dark mb-1">{t('contact.info.studentCardTitle')}</h3>
            <p className="text-sm text-gray-600">
              {t('contact.info.studentCardBody')}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="card shadow-xl">
          {sent ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-brand-dark mb-2">{t('contact.form.sentTitle')}</h3>
              <p className="text-gray-500 text-sm">{t('contact.form.sentSubtitle')}</p>
              <button onClick={() => setSent(false)} className="btn-outline mt-6">{t('contact.form.sendAnother')}</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="input-label">{t('contact.form.labels.name')}</label>
                <input
                  {...register('name', { required: t('contact.form.errors.nameRequired') })}
                  className="input-field"
                  placeholder={t('contact.form.placeholders.name')}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="input-label">{t('contact.form.labels.email')}</label>
                <input
                  type="email"
                  {...register('email', { required: t('contact.form.errors.emailRequired') })}
                  className="input-field"
                  placeholder={t('contact.form.placeholders.email')}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="input-label">{t('contact.form.labels.subject')}</label>
                <input
                  {...register('subject', { required: t('contact.form.errors.subjectRequired') })}
                  className="input-field"
                  placeholder={t('contact.form.placeholders.subject')}
                />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>
              <div>
                <label className="input-label">{t('contact.form.labels.message')}</label>
                <textarea
                  {...register('message', {
                    required: t('contact.form.errors.messageRequired'),
                    minLength: { value: 20, message: t('contact.form.errors.messageMin') },
                  })}
                  className="input-field"
                  rows={5}
                  placeholder={t('contact.form.placeholders.message')}
                />
                {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? t('contact.form.submitting') : t('contact.form.submit')}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
