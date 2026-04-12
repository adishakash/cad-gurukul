import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leadApi } from '../services/api'

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
      e.fullName = 'Enter your full name'
    // Email required only when NOT in mid-assessment mode
    if (!midAssessment && !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      e.email = 'Enter a valid email address'
    if (!form.mobileNumber.match(/^[6-9]\d{9}$/))
      e.mobileNumber = 'Enter a valid 10-digit mobile number'
    if (!compact && !midAssessment && !form.classStandard)
      e.classStandard = 'Select your class'
    if (midAssessment && !form.classStandard)
      e.classStandard = 'Select your class'
    if (form.pincode && !form.pincode.match(/^\d{6}$/))
      e.pincode = 'Enter a valid 6-digit pincode'
    if (!midAssessment && !form.consent)
      e.consent = 'Please accept the privacy policy to continue'
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

      toast.success('Details saved! Taking you to your free report →')

      if (onSuccess) {
        onSuccess(leadId)
      } else {
        navigate(`/register?leadId=${leadId}&plan=${normalizedPlan}`)
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Something went wrong. Please try again.'
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
          <label className="block text-xs font-semibold text-gray-700 mb-1">Your Name *</label>
          <input
            type="text" name="fullName" value={form.fullName}
            onChange={handleChange} placeholder="Riya Sharma"
            className={inputCls('fullName')} autoComplete="name"
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number (WhatsApp) *</label>
          <input
            type="tel" name="mobileNumber" value={form.mobileNumber}
            onChange={handleChange} placeholder="9876543210" maxLength={10}
            className={inputCls('mobileNumber')} autoComplete="tel"
          />
          {errors.mobileNumber && <p className="text-xs text-red-500 mt-1">{errors.mobileNumber}</p>}
          <p className="text-xs text-gray-400 mt-1">Your report will be sent on WhatsApp 📲</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Which class are you in? *</label>
          <select name="classStandard" value={form.classStandard} onChange={handleChange} className={inputCls('classStandard')}>
            <option value="">Select class</option>
            {['8','9','10','11','12'].map((c) => (
              <option key={c} value={c}>Class {c}</option>
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
              Saving…
            </span>
          ) : 'Continue & Unlock My Report 🎯'}
        </button>
        <p className="text-xs text-center text-gray-400">
          🔒 No spam. We send only your career report and AI insights.
        </p>
      </form>
    )
  }
  // ── END midAssessment form ─────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
        <input
          type="text" name="fullName" value={form.fullName}
          onChange={handleChange} placeholder="Riya Sharma"
          className={inputCls('fullName')} autoComplete="name"
        />
        {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
      </div>

      {/* Email + Mobile */}
      <div className={compact ? 'space-y-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
          <input
            type="email" name="email" value={form.email}
            onChange={handleChange} placeholder="riya@gmail.com"
            className={inputCls('email')} autoComplete="email"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number *</label>
          <input
            type="tel" name="mobileNumber" value={form.mobileNumber}
            onChange={handleChange} placeholder="9876543210" maxLength={10}
            className={inputCls('mobileNumber')} autoComplete="tel"
          />
          {errors.mobileNumber && <p className="text-xs text-red-500 mt-1">{errors.mobileNumber}</p>}
        </div>
      </div>

      {/* Class + Stream */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Class *</label>
            <select name="classStandard" value={form.classStandard} onChange={handleChange} className={inputCls('classStandard')}>
              <option value="">Select class</option>
              {['8','9','10','11','12'].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
            {errors.classStandard && <p className="text-xs text-red-500 mt-1">{errors.classStandard}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Stream (if applicable)</label>
            <select name="stream" value={form.stream} onChange={handleChange} className={inputCls('stream')}>
              <option value="">Not decided yet</option>
              <option value="Science">Science</option>
              <option value="Commerce">Commerce</option>
              <option value="Arts">Arts / Humanities</option>
              <option value="NA">Not Applicable (Class 8-10)</option>
            </select>
          </div>
        </div>
      )}

      {/* City + Pincode */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
            <input
              type="text" name="city" value={form.city}
              onChange={handleChange} placeholder="Jaipur"
              className={inputCls('city')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label>
            <input
              type="text" name="pincode" value={form.pincode}
              onChange={handleChange} placeholder="302001" maxLength={6}
              className={inputCls('pincode')}
            />
            {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
          </div>
        </div>
      )}

      {/* Who is filling this? */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">I am a…</label>
        <div className="flex gap-3">
          {[['student', '🎓 Student'], ['parent', '👨‍👩‍👧 Parent / Guardian']].map(([val, label]) => (
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
            I agree to receive career guidance information via email and WhatsApp. My data is safe and will not be shared with third parties.{' '}
            <a href="/privacy" className="text-brand-red underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
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
            Saving details…
          </span>
        ) : normalizedPlan === 'paid' ? 'Proceed to Premium Report →' : 'Get My Free Career Report →'}
      </button>

      <p className="text-center text-xs text-gray-400">
        🔒 Safe & Secure &nbsp;|&nbsp; ✅ No spam &nbsp;|&nbsp; 🇮🇳 Built for Indian students
      </p>
    </form>
  )
}
