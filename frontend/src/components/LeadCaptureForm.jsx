import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadApi } from '../services/api'
import { useTranslation } from 'react-i18next'

/**
 * LeadCaptureForm
 * ──────────────────────────────────────────────────────
 * Collects and validates lead data.
 * Saves leadId to localStorage so it can be linked after registration.
 *
 * Props:
 *   selectedPlan  'free' | 'paid'      (default: 'free')
 *   onSuccess     fn(leadId) => void
 *   compact       bool — show only essential fields (for landing page modal)
 */
export default function LeadCaptureForm({ selectedPlan = 'free', defaultPlan, onSuccess, compact = false, midAssessment = false }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const normalizedPlan = useMemo(() => {
    const raw = (selectedPlan || defaultPlan || 'free').toString().toLowerCase()
    return raw === 'paid' ? 'paid' : 'free'
  }, [selectedPlan, defaultPlan])

  // Detect UTM / source from URL once on mount
  const urlParams = new URLSearchParams(window.location.search)
  const utmSource   = urlParams.get('utm_source')   || undefined
  const utmMedium   = urlParams.get('utm_medium')   || undefined
  const utmCampaign = urlParams.get('utm_campaign') || undefined
  const utmContent  = urlParams.get('utm_content')  || undefined

  const [form, setForm] = useState({
    fullName:      '',
    email:         '',
    mobileNumber:  '',
    classStandard: '',
    stream:        '',
    city:          '',
    pincode:       '',
    userType:      'student',
    consent:       false,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.fullName.trim() || form.fullName.trim().length < 2)
      e.fullName = t('leadCapture.errors.fullName')
    // Email required only when NOT in mid-assessment mode
    if (!midAssessment && !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      e.email = t('leadCapture.errors.email')
    if (!form.mobileNumber.match(/^[6-9]\d{9}$/))
      e.mobileNumber = t('leadCapture.errors.mobile')
    if (!compact && !midAssessment && !form.classStandard)
      e.classStandard = t('leadCapture.errors.class')
    if (midAssessment && !form.classStandard)
      e.classStandard = t('leadCapture.errors.class')
    if (form.pincode && !form.pincode.match(/^\d{6}$/))
      e.pincode = t('leadCapture.errors.pincode')
    if (!midAssessment && !form.consent)
      e.consent = t('leadCapture.errors.consent')
    return e
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const sourceFromUtm = (utmSource || '').toLowerCase()
      const leadSource = sourceFromUtm
        ? (['meta_ads', 'instagram', 'facebook', 'google_ads'].includes(sourceFromUtm) ? sourceFromUtm : 'other')
        : 'direct'

      // In mid-assessment mode, use phone-based placeholder email so dedup works
      const effectiveEmail = midAssessment && !form.email.trim()
        ? `${form.mobileNumber.trim()}@cadgurukul.temp`
        : form.email.trim().toLowerCase()

      const payload = {
        fullName:      form.fullName.trim(),
        email:         effectiveEmail,
        mobileNumber:  form.mobileNumber.trim(),
        classStandard: form.classStandard || undefined,
        stream:        form.stream        || undefined,
        city:          form.city.trim()   || undefined,
        pincode:       form.pincode.trim()|| undefined,
        userType:      form.userType,
        selectedPlan: normalizedPlan,
        leadSource,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
      }

      const { data } = await leadApi.create(payload)
      const leadId = data.data?.leadId

      if (leadId) localStorage.setItem('cg_lead_id', leadId)

      toast.success(t('leadCapture.toast.success'))

      if (onSuccess) {
        onSuccess(leadId)
      } else {
        navigate(`/register?leadId=${leadId}&plan=${normalizedPlan}`)
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || t('leadCapture.toast.error')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/50 transition ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`

  // ── Simplified 3-field mid-assessment form ─────────────────────────────────
  if (midAssessment) {
    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.mid.nameLabel')}</label>
          <input
            type="text" name="fullName" value={form.fullName}
            onChange={handleChange} placeholder={t('leadCapture.mid.namePlaceholder')}
            className={inputCls('fullName')} autoComplete="name"
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.mid.mobileLabel')}</label>
          <input
            type="tel" name="mobileNumber" value={form.mobileNumber}
            onChange={handleChange} placeholder={t('leadCapture.mid.mobilePlaceholder')} maxLength={10}
            className={inputCls('mobileNumber')} autoComplete="tel"
          />
          {errors.mobileNumber && <p className="text-xs text-red-500 mt-1">{errors.mobileNumber}</p>}
          <p className="text-xs text-gray-400 mt-1">{t('leadCapture.mid.mobileNote')}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.mid.classLabel')}</label>
          <select name="classStandard" value={form.classStandard} onChange={handleChange} className={inputCls('classStandard')}>
            <option value="">{t('leadCapture.mid.classPlaceholder')}</option>
            {['8','9','10','11','12'].map((c) => (
              <option key={c} value={c}>{t('leadCapture.mid.classOption', { class: c })}</option>
            ))}
          </select>
          {errors.classStandard && <p className="text-xs text-red-500 mt-1">{errors.classStandard}</p>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-base font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {t('leadCapture.mid.submitting')}
            </span>
          ) : t('leadCapture.mid.submit')}
        </button>
        <p className="text-xs text-center text-gray-400">
          {t('leadCapture.mid.footer')}
        </p>
      </form>
    )
  }
  // ── END midAssessment form ─────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.nameLabel')}</label>
        <input
          type="text" name="fullName" value={form.fullName}
          onChange={handleChange} placeholder={t('leadCapture.full.namePlaceholder')}
          className={inputCls('fullName')} autoComplete="name"
        />
        {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
      </div>

      {/* Email + Mobile */}
      <div className={compact ? 'space-y-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.emailLabel')}</label>
          <input
            type="email" name="email" value={form.email}
            onChange={handleChange} placeholder={t('leadCapture.full.emailPlaceholder')}
            className={inputCls('email')} autoComplete="email"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.mobileLabel')}</label>
          <input
            type="tel" name="mobileNumber" value={form.mobileNumber}
            onChange={handleChange} placeholder={t('leadCapture.full.mobilePlaceholder')} maxLength={10}
            className={inputCls('mobileNumber')} autoComplete="tel"
          />
          {errors.mobileNumber && <p className="text-xs text-red-500 mt-1">{errors.mobileNumber}</p>}
        </div>
      </div>

      {/* Class + Stream */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.classLabel')}</label>
            <select name="classStandard" value={form.classStandard} onChange={handleChange} className={inputCls('classStandard')}>
              <option value="">{t('leadCapture.full.classPlaceholder')}</option>
              {['8','9','10','11','12'].map((c) => (
                <option key={c} value={c}>{t('leadCapture.full.classOption', { class: c })}</option>
              ))}
            </select>
            {errors.classStandard && <p className="text-xs text-red-500 mt-1">{errors.classStandard}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.streamLabel')}</label>
            <select name="stream" value={form.stream} onChange={handleChange} className={inputCls('stream')}>
              <option value="">{t('leadCapture.full.streamPlaceholder')}</option>
              <option value="Science">{t('leadCapture.full.streamScience')}</option>
              <option value="Commerce">{t('leadCapture.full.streamCommerce')}</option>
              <option value="Arts">{t('leadCapture.full.streamArts')}</option>
              <option value="NA">{t('leadCapture.full.streamNA')}</option>
            </select>
          </div>
        </div>
      )}

      {/* City + Pincode */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.cityLabel')}</label>
            <input
              type="text" name="city" value={form.city}
              onChange={handleChange} placeholder={t('leadCapture.full.cityPlaceholder')}
              className={inputCls('city')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('leadCapture.full.pincodeLabel')}</label>
            <input
              type="text" name="pincode" value={form.pincode}
              onChange={handleChange} placeholder={t('leadCapture.full.pincodePlaceholder')} maxLength={6}
              className={inputCls('pincode')}
            />
            {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
          </div>
        </div>
      )}

      {/* Who is filling this? */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">{t('leadCapture.full.userTypeLabel')}</label>
        <div className="flex gap-3">
          {[['student', t('leadCapture.full.userTypeStudent')], ['parent', t('leadCapture.full.userTypeParent')]].map(([val, label]) => (
            <label key={val} className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer transition text-sm ${form.userType === val ? 'border-brand-red bg-red-50 text-brand-red font-semibold' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
              <input type="radio" name="userType" value={val} checked={form.userType === val} onChange={handleChange} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Consent */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox" name="consent" checked={form.consent}
            onChange={handleChange}
            className="mt-0.5 shrink-0 accent-brand-red w-4 h-4"
          />
          <span className="text-xs text-gray-500 leading-relaxed">
            {t('leadCapture.full.consentText')}{' '}
            <a href="/privacy" className="text-brand-red underline" target="_blank" rel="noopener noreferrer">{t('leadCapture.full.privacyLink')}</a>
          </span>
        </label>
        {errors.consent && <p className="text-xs text-red-500 mt-1">{errors.consent}</p>}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary py-3 text-base font-bold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {t('leadCapture.full.submitting')}
          </span>
        ) : normalizedPlan === 'paid' ? t('leadCapture.full.submitPaid') : t('leadCapture.full.submitFree')}
      </button>

      <p className="text-center text-xs text-gray-400">
        {t('leadCapture.full.footer')}
      </p>
    </form>
  )
}
