import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  verifyEmailToken,
  resendVerificationEmail,
  selectAuthLoading,
} from '../store/slices/authSlice'

const STATUS = {
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  INVALID: 'invalid',
  EXPIRED: 'expired',
}

export default function VerifyEmail() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoading = useSelector(selectAuthLoading)
  const [status, setStatus] = useState(STATUS.VERIFYING)
  const [resendEmail, setResendEmail] = useState('')
  const [resendCooldown, setResendCooldown] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus(STATUS.INVALID)
      return
    }

    const doVerify = async () => {
      const result = await dispatch(verifyEmailToken(token))
      if (verifyEmailToken.fulfilled.match(result)) {
        setStatus(STATUS.SUCCESS)
        // Navigate to onboarding after short delay so the user sees the success screen
        setTimeout(() => navigate('/onboarding', { replace: true }), 1500)
      } else {
        const code = result.payload?.code
        setStatus(code === 'TOKEN_EXPIRED' ? STATUS.EXPIRED : STATUS.INVALID)
      }
    }

    doVerify()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = async () => {
    if (!resendEmail || resendCooldown) return
    setResendCooldown(true)
    await dispatch(resendVerificationEmail(resendEmail))
    setResendSent(true)
    setTimeout(() => setResendCooldown(false), 30000)
  }

  const Logo = () => (
    <Link to="/" className="inline-flex items-center space-x-2 mb-6">
      <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
        <span className="text-white font-bold text-lg">C</span>
      </div>
      <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
    </Link>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo />
        </div>

        {/* ── Verifying (spinner) ── */}
        {status === STATUS.VERIFYING && (
          <div className="card shadow-xl text-center">
            <div className="flex justify-center mb-4">
              <svg className="animate-spin w-10 h-10 text-brand-red" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-brand-dark mb-2">Verifying your email…</h2>
            <p className="text-gray-500 text-sm">Just a moment while we confirm your address.</p>
          </div>
        )}

        {/* ── Success ── */}
        {status === STATUS.SUCCESS && (
          <div className="card shadow-xl text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-brand-dark mb-2">Email Verified!</h2>
            <p className="text-gray-600 text-sm mb-4">
              Your email has been confirmed. Taking you to your profile setup…
            </p>
            <div className="flex justify-center mb-4">
              <svg className="animate-spin w-5 h-5 text-brand-red" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <Link
              to="/onboarding"
              className="inline-block btn-primary w-full text-center mb-3"
            >
              Continue to Profile Setup →
            </Link>
            <p className="text-xs text-gray-400">
              Already set up?{' '}
              <Link to="/dashboard" className="text-brand-red font-semibold hover:underline">
                Go to Dashboard →
              </Link>
            </p>
          </div>
        )}

        {/* ── Expired ── */}
        {status === STATUS.EXPIRED && (
          <div className="card shadow-xl text-center">
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold text-brand-dark mb-2">Link Expired</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              This verification link has expired (links are valid for 24 hours).
              Enter your email below to receive a fresh link.
            </p>
            {resendSent ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
                ✅ A new verification email has been sent. Check your inbox!
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-field w-full"
                />
                <button
                  onClick={handleResend}
                  disabled={!resendEmail || resendCooldown || isLoading}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending…' : 'Resend Verification Email'}
                </button>
              </div>
            )}
            <p className="text-center text-sm text-gray-500 mt-4">
              Already verified?{' '}
              <Link to="/login" className="text-brand-red font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* ── Invalid ── */}
        {status === STATUS.INVALID && (
          <div className="card shadow-xl text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-brand-dark mb-2">Invalid Link</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              This verification link is invalid or has already been used.
              {!token && ' No verification token was found in the URL.'}
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/register"
                className="btn-primary w-full text-center"
              >
                Create a new account
              </Link>
              <Link
                to="/login"
                className="py-2 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 text-center"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
