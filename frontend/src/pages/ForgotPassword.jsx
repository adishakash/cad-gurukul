import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'

const PORTAL_CONFIG = {
  student: { label: 'Student', loginPath: '/login' },
  staff: { label: 'Staff', loginPath: '/staff/login' },
  admin: { label: 'Admin', loginPath: '/admin/login' },
}

const resolvePortal = (value) => {
  const key = (value || '').toString().toLowerCase()
  return PORTAL_CONFIG[key] ? key : 'student'
}

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const portalKey = resolvePortal(searchParams.get('portal'))
  const portal = PORTAL_CONFIG[portalKey]
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await authApi.forgotPassword(data.email)
      setSent(true)
      toast.success('If that account exists, a reset link will arrive shortly.')
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-brand-dark">Forgot your password?</h1>
          <p className="text-gray-500 mt-2 text-sm">Enter your {portal.label.toLowerCase()} email to receive a reset link.</p>
        </div>

        <div className="card shadow-xl">
          {sent ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-bold text-brand-dark mb-2">Check your inbox</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                If that account exists, we just sent a password reset link. Please check your email.
              </p>
              <Link to={portal.loginPath} className="btn-primary w-full text-center mt-6">
                Back to {portal.label} Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="input-label">Email</label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                  })}
                  className="input-field"
                  placeholder="you@example.com"
                  autoComplete="username"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending reset link...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        {!sent && (
          <p className="text-center text-sm text-gray-600 mt-6">
            Remembered your password?{' '}
            <Link to={portal.loginPath} className="text-brand-red font-semibold hover:underline">
              Back to {portal.label} Login
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
