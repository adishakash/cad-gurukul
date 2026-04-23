import { useState } from 'react'
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
import { leadApi } from '../services/api'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoading = useSelector(selectAuthLoading)
  const pendingVerification = useSelector(selectPendingVerification)
  const [resendCooldown, setResendCooldown] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState(null)

  const { register, handleSubmit, formState: { errors }, watch } = useForm()

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
            <h1 className="text-2xl font-bold text-brand-dark mb-3">Check your email</h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              We've sent a verification link to:
            </p>
            <p className="font-semibold text-brand-dark text-sm mb-6 break-all">
              {pendingVerification.email}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-left text-sm text-blue-800 mb-4">
              <p className="font-semibold mb-1">What to do next:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Open the email from CAD Gurukul</li>
                <li>Click the <strong>Verify My Email</strong> button in the email</li>
                <li>You'll be redirected to complete your profile setup</li>
              </ol>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left text-xs text-gray-600 mb-4">
              📱 <strong>On mobile?</strong> If the link opens inside your email app (Outlook, Yahoo, etc.),
              the page will guide you to copy the link and open it in Chrome or Safari to stay signed in.
            </div>

            <p className="text-xs text-gray-400 mb-4">
              ⏳ The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>

            <button
              onClick={handleResend}
              disabled={isLoading || resendCooldown}
              className="w-full py-2 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown ? 'Resent! Wait 30 seconds before trying again' : 'Resend verification email'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              Already verified?{' '}
              <Link to="/login" className="text-brand-red font-semibold hover:underline">
                Sign in
              </Link>
              {' · '}
              Wrong email?{' '}
              <button
                onClick={() => dispatch(clearPendingVerification())}
                className="text-brand-red font-semibold hover:underline"
              >
                Start over
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
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
          </Link>
          <h1 className="text-2xl font-bold text-brand-dark">Create Your Free Account</h1>
          <p className="text-gray-500 mt-2 text-sm">Start your career discovery journey today</p>
        </div>

        {/* Form */}
        <div className="card shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">Full Name *</label>
              <input
                {...register('fullName', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })}
                className="input-field"
                placeholder="Your full name"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="input-label">Email Address *</label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' }
                })}
                type="email"
                className="input-field"
                placeholder="student@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="input-label">Password *</label>
              <input
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: 'Must include uppercase, lowercase, and number'
                  }
                })}
                type="password"
                className="input-field"
                placeholder="Create a strong password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="input-label">I am registering as</label>
              <select {...register('role')} className="input-field">
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent (for my child)</option>
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
                  Creating Account...
                </>
              ) : 'Create Free Account →'}
            </button>

            <p className="text-center text-xs text-gray-500 mt-2">
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to={loginHref} className="text-brand-red font-semibold hover:underline">Sign In</Link>
        </p>

        {/* Trust badges */}
        <div className="flex justify-center items-center gap-4 mt-6 text-xs text-gray-400">
          <span>🔒 SSL Secured</span>
          <span>•</span>
          <span>✅ Free to Start</span>
          <span>•</span>
          <span>🇮🇳 Made in India</span>
        </div>
      </div>
    </div>
  )
}
