import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { staffApiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function StaffLogin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await staffApiClient.post('/staff/login', data)
      const { accessToken, refreshToken, user } = response.data.data
      localStorage.setItem('cg_staff_token', accessToken)
      if (refreshToken) localStorage.setItem('cg_staff_refresh_token', refreshToken)
      localStorage.setItem('cg_staff', JSON.stringify(user))
      toast.success('Welcome, ' + (user.name || user.email))
      // Route based on role: CCL → staff portal, CC → counsellor portal
      if (user.role === 'CAREER_COUNSELLOR') {
        navigate('/counsellor')
      } else {
        navigate('/staff')
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-extrabold text-white">Staff Access</h1>
          <p className="text-gray-400 text-sm mt-1">Career Counsellor Lead &amp; Counsellor Portal</p>
        </div>

        <div className="card shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">Staff Email</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="input-field"
                placeholder="lead@cadgurukul.com"
                autoComplete="username"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="input-label">Password</label>
              <input
                type="password"
                {...register('password', { required: 'Password is required' })}
                className="input-field"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In to Staff Portal'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">Unauthorised access is prohibited.</p>
        <p className="text-center text-xs text-gray-500 mt-2">
          Looking for the{' '}
          <a href="/admin/login" className="text-brand-red hover:underline">
            Admin Panel?
          </a>
        </p>
      </div>
    </div>
  )
}
