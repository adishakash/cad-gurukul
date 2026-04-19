import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { loginUser, selectAuthLoading, selectAuthError, clearError } from '../store/slices/authSlice'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoading = useSelector(selectAuthLoading)
  const authError = useSelector(selectAuthError)
  const sessionExpired = searchParams.get('session') === 'expired'

  const { register, handleSubmit, formState: { errors } } = useForm()

  // Clear any stale error carried over from a previous page (e.g. a failed registration)
  // when this page first mounts. The error will persist after a failed login attempt
  // until the user retries or modifies their input.
  useEffect(() => { dispatch(clearError()) }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <h1 className="text-2xl font-bold text-brand-dark">Welcome Back</h1>
          <p className="text-gray-500 mt-2 text-sm">Continue your career discovery journey</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
            ⚠️ Your session expired. Please log in again.
          </div>
        )}

        {authError && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {authError}
          </div>
        )}

        <div className="card shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} onChange={() => { if (authError) dispatch(clearError()) }} className="space-y-4">
            <div>
              <label className="input-label">Email Address</label>
              <input
                {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                type="email"
                className="input-field"
                placeholder="your@email.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="input-label">Password</label>
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                className="input-field"
                placeholder="Your password"
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
                  Signing In...
                </>
              ) : 'Sign In →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          New here?{' '}
          <Link to={registerHref} className="text-brand-red font-semibold hover:underline">Create a free account</Link>
        </p>
      </div>
    </div>
  )
}
