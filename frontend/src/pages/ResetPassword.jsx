import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import Seo from '../components/SEO/Seo'

const PORTAL_CONFIG = {
  student: { label: 'Student', loginPath: '/login' },
  staff: { label: 'Staff', loginPath: '/staff/login' },
  admin: { label: 'Admin', loginPath: '/admin/login' },
}

const resolvePortal = (value) => {
  const key = (value || '').toString().toLowerCase()
  return PORTAL_CONFIG[key] ? key : 'student'
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const portalKey = resolvePortal(searchParams.get('portal'))
  const portal = PORTAL_CONFIG[portalKey]
  const { register, handleSubmit, setError, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      setError('confirmPassword', { message: 'Passwords do not match' })
      return
    }

    if (!token) {
      setErrorMessage('This reset link is missing or invalid. Please request a new one.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      await authApi.resetPassword({ token, password: data.password })
      setSuccess(true)
      toast.success('Password updated. You can now sign in.')
    } catch (err) {
      const message = err?.response?.data?.error?.message || 'Unable to reset password. Please try again.'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <Seo
        title="Reset Password | CAD Gurukul"
        description="Set a new password for your CAD Gurukul account."
        noIndex
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-brand-dark">CAD Gurukul</span>
          </Link>
          <h1 className="text-2xl font-bold text-brand-dark">Set a new password</h1>
          <p className="text-gray-500 mt-2 text-sm">Choose a strong password to secure your account.</p>
        </div>

        <div className="card shadow-xl">
          {success ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-bold text-brand-dark mb-2">Password reset successful</h2>
              <p className="text-gray-600 text-sm leading-relaxed">You can now sign in with your new password.</p>
              <Link to={portal.loginPath} className="btn-primary w-full text-center mt-6">
                Go to {portal.label} Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="input-label">New Password</label>
                <input
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Use uppercase, lowercase, and a number' },
                  })}
                  className="input-field"
                  placeholder="Create a new password"
                  autoComplete="new-password"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="input-label">Confirm Password</label>
                <input
                  type="password"
                  {...register('confirmPassword', { required: 'Please confirm your password' })}
                  className="input-field"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Saving new password...' : 'Reset Password'}
              </button>
              <p className="text-xs text-gray-500">
                Password must be at least 8 characters and include uppercase, lowercase, and a number.
              </p>
            </form>
          )}
        </div>

        {!success && (
          <p className="text-center text-sm text-gray-600 mt-6">
            Need a new reset link?{' '}
            <Link to={`/forgot-password?portal=${portalKey}`} className="text-brand-red font-semibold hover:underline">
              Request another
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
