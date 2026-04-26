import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import {
  loginUser,
  resendVerificationEmail,
  selectAuthLoading,
  selectAuthError,
  clearError,
} from '../store/slices/authSlice'
import { setPlan } from '../store/slices/leadSlice'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoading = useSelector(selectAuthLoading)
  const authError = useSelector(selectAuthError)
  const sessionExpired = searchParams.get('session') === 'expired'
  const [resendEmail, setResendEmail] = useState(null)
  const [resendCooldown, setResendCooldown] = useState(false)
  const { t } = useTranslation()

  const { register, handleSubmit, formState: { errors }, getValues } = useForm()

  // Clear any stale error when this page mounts
  useEffect(() => { dispatch(clearError()) }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const planParam = (searchParams.get('plan') || '').toLowerCase()
    const intentParam = (searchParams.get('intent') || '').toLowerCase()
    if (!planParam && !intentParam) return
    const selectedPlan = ['paid', 'premium', 'standard'].includes(planParam) || intentParam === 'paid'
      ? 'paid'
      : 'free'
    dispatch(setPlan(selectedPlan))
  }, [dispatch, searchParams])

  const registerHref = searchParams.toString() ? `/register?${searchParams.toString()}` : '/register'

  const buildPostAuthAssessmentPath = () => {
    const params = new URLSearchParams({
      plan: (searchParams.get('plan') || 'free').toLowerCase() === 'paid' ? 'PAID' : 'FREE',
    })
    const intent = searchParams.get('intent')
    if (intent) params.set('intent', intent)
    return `/assessment?${params.toString()}`
  }

  const onSubmit = async (data) => {
    const result = await dispatch(loginUser(data))
    if (loginUser.fulfilled.match(result)) {
      if (searchParams.get('next') === 'assessment') {
        navigate(buildPostAuthAssessmentPath())
        return
      }
      navigate('/dashboard')
    } else {
      // If email not verified, surface resend option pre-filled with their email
      if (result.payload?.code === 'EMAIL_NOT_VERIFIED') {
        setResendEmail(data.email)
      }
    }
  }

  const handleResend = async () => {
    if (!resendEmail || resendCooldown) return
    setResendCooldown(true)
    await dispatch(resendVerificationEmail(resendEmail))
    setTimeout(() => setResendCooldown(false), 30000)
  }

  // Resolve displayable error string (authError may be { message, code } or plain string)
  const errorMessage = typeof authError === 'object' ? authError?.message : authError

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
          </Link>
          <h1 className="text-2xl font-bold text-brand-dark">{t('login.title')}</h1>
          <p className="text-gray-500 mt-2 text-sm">{t('login.subtitle')}</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
            ⚠️ {t('login.sessionExpired')}
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {errorMessage}
            {/* Resend option when the account is unverified */}
            {authError?.code === 'EMAIL_NOT_VERIFIED' && resendEmail && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <button
                  onClick={handleResend}
                  disabled={isLoading || resendCooldown}
                  className="text-brand-red font-semibold text-xs hover:underline disabled:opacity-50"
                >
                  {resendCooldown ? t('login.resendSent') : t('login.resendAction')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="card shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} onChange={() => { if (authError) dispatch(clearError()) }} className="space-y-4">
            <div>
              <label className="input-label">{t('login.form.emailLabel')}</label>
              <input
                {...register('email', {
                  required: t('login.form.emailRequired'),
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('login.form.emailInvalid') },
                })}
                type="email"
                className="input-field"
                placeholder={t('login.form.emailPlaceholder')}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="input-label">{t('login.form.passwordLabel')}</label>
              <input
                {...register('password', { required: t('login.form.passwordRequired') })}
                type="password"
                className="input-field"
                placeholder={t('login.form.passwordPlaceholder')}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t('login.form.submitting')}
                </>
              ) : t('login.form.submit')}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          {t('login.footer.prompt')}{' '}
          <Link to={registerHref} className="text-brand-red font-semibold hover:underline">{t('login.footer.link')}</Link>
        </p>
      </div>
    </div>
  )
}
