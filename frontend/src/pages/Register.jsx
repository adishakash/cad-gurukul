import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import {
  registerUser,
  resendVerificationEmail,
  selectAuthLoading,
  selectPendingVerification,
  clearPendingVerification,
} from '../store/slices/authSlice'
import { setPlan } from '../store/slices/leadSlice'
import { leadApi } from '../services/api'
import { useTranslation } from 'react-i18next'
import Seo from '../components/SEO/Seo'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoading = useSelector(selectAuthLoading)
  const pendingVerification = useSelector(selectPendingVerification)
  const [resendCooldown, setResendCooldown] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState(null)
  const { t } = useTranslation()
  const seo = (
    <Seo
      title="Create an Account | CAD Gurukul"
      description="Create your CAD Gurukul account to start your career assessment."
      noIndex
    />
  )

  const { register, handleSubmit, formState: { errors }, watch } = useForm()

  useEffect(() => {
    const planParam = (searchParams.get('plan') || '').toLowerCase()
    const intentParam = (searchParams.get('intent') || '').toLowerCase()
    if (!planParam && !intentParam) return
    const selectedPlan = ['paid', 'premium', 'standard'].includes(planParam) || intentParam === 'paid'
      ? 'paid'
      : 'free'
    dispatch(setPlan(selectedPlan))
  }, [dispatch, searchParams])

  const loginHref = searchParams.toString() ? `/login?${searchParams.toString()}` : '/login'

  const onSubmit = async (data) => {
    setSubmittedEmail(data.email)
    const result = await dispatch(registerUser(data))
    if (registerUser.fulfilled.match(result)) {
      // Link any pending lead captured before registration
      const leadId = localStorage.getItem('cg_lead_id') || searchParams.get('leadId')
      if (leadId) {
        leadApi.linkUser(leadId).catch(() => {})
        localStorage.removeItem('cg_lead_id')
      }
      // Don't navigate — stay on this page and show the "check your email" state
    }
  }

  const handleResend = async () => {
    const email = pendingVerification?.email || submittedEmail
    if (!email || resendCooldown) return
    setResendCooldown(true)
    await dispatch(resendVerificationEmail(email))
    setTimeout(() => setResendCooldown(false), 30000) // 30s cooldown
  }

  // ── "Check your email" holding state ──────────────────────────────────────
  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
        {seo}
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center space-x-2 mb-6">
              <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
            </Link>
          </div>

          <div className="card shadow-xl text-center">
            <div className="text-5xl mb-4">📬</div>
            <h1 className="text-2xl font-bold text-brand-dark mb-3">{t('register.checkEmail.title')}</h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">{t('register.checkEmail.sentTo')}</p>
            <p className="font-semibold text-brand-dark text-sm mb-6 break-all">
              {pendingVerification.email}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-left text-sm text-blue-800 mb-4">
              <p className="font-semibold mb-1">{t('register.checkEmail.stepsTitle')}</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>{t('register.checkEmail.step1')}</li>
                <li>
                  {t('register.checkEmail.step2Prefix')}
                  <strong>{t('register.checkEmail.step2Emphasis')}</strong>
                  {t('register.checkEmail.step2Suffix')}
                </li>
                <li>{t('register.checkEmail.step3')}</li>
              </ol>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left text-xs text-gray-600 mb-4">
              📱 <strong>{t('register.checkEmail.mobileTitle')}</strong> {t('register.checkEmail.mobileBody')}{' '}
              <strong>{t('register.checkEmail.mobileEmphasis')}</strong> {t('register.checkEmail.mobileSuffix')}
            </div>

            <p className="text-xs text-gray-400 mb-4">
              ⏳ {t('register.checkEmail.linkExpires')}
            </p>

            <button
              onClick={handleResend}
              disabled={isLoading || resendCooldown}
              className="w-full py-2 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown ? t('register.checkEmail.resendCooldown') : t('register.checkEmail.resend')}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              {t('register.checkEmail.alreadyVerified')}{' '}
              <Link to="/login" className="text-brand-red font-semibold hover:underline">
                {t('register.checkEmail.signIn')}
              </Link>
              {' · '}
              {t('register.checkEmail.wrongEmail')}{' '}
              <button
                onClick={() => dispatch(clearPendingVerification())}
                className="text-brand-red font-semibold hover:underline"
              >
                {t('register.checkEmail.startOver')}
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
      {seo}
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
          </Link>
          <h1 className="text-2xl font-bold text-brand-dark">{t('register.title')}</h1>
          <p className="text-gray-500 mt-2 text-sm">{t('register.subtitle')}</p>
        </div>

        {/* Form */}
        <div className="card shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">{t('register.form.fullNameLabel')}</label>
              <input
                {...register('fullName', {
                  required: t('register.form.fullNameRequired'),
                  minLength: { value: 2, message: t('register.form.fullNameMin') },
                })}
                className="input-field"
                placeholder={t('register.form.fullNamePlaceholder')}
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="input-label">{t('register.form.emailLabel')}</label>
              <input
                {...register('email', {
                  required: t('register.form.emailRequired'),
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('register.form.emailInvalid') }
                })}
                type="email"
                className="input-field"
                placeholder={t('register.form.emailPlaceholder')}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="input-label">{t('register.form.passwordLabel')}</label>
              <input
                {...register('password', {
                  required: t('register.form.passwordRequired'),
                  minLength: { value: 8, message: t('register.form.passwordMin') },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: t('register.form.passwordPattern')
                  }
                })}
                type="password"
                className="input-field"
                placeholder={t('register.form.passwordPlaceholder')}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="input-label">{t('register.form.roleLabel')}</label>
              <select {...register('role')} className="input-field">
                <option value="STUDENT">{t('register.form.roleStudent')}</option>
                <option value="PARENT">{t('register.form.roleParent')}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t('register.form.submitting')}
                </>
              ) : t('register.form.submit')}
            </button>

            <p className="text-center text-xs text-gray-500 mt-2">
              {t('register.form.terms')}
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          {t('register.footer.prompt')}{' '}
          <Link to={loginHref} className="text-brand-red font-semibold hover:underline">{t('register.footer.link')}</Link>
        </p>

        {/* Trust badges */}
        <div className="flex justify-center items-center gap-4 mt-6 text-xs text-gray-400">
          <span>🔒 {t('register.trust.ssl')}</span>
          <span>•</span>
          <span>✅ {t('register.trust.free')}</span>
          <span>•</span>
          <span>🇮🇳 {t('register.trust.madeInIndia')}</span>
        </div>
      </div>
    </div>
  )
}
