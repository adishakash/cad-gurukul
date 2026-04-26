import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await api.post('/admin/login', data)
      const { accessToken, refreshToken, user } = response.data.data
      localStorage.setItem('cg_admin_token', accessToken)
      if (refreshToken) localStorage.setItem('cg_admin_refresh_token', refreshToken)
      localStorage.setItem('cg_admin', JSON.stringify(user))
      toast.success('Welcome, ' + (user.name || user.email))
      navigate('/admin')
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
          <div className="text-4xl mb-3">🛡️</div>
          <h1 className="text-2xl font-extrabold text-white">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">CAD Gurukul Control Panel</p>
        </div>

        <div className="card shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="input-label">Admin Email</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="input-field"
                placeholder="admin@cadgurukul.com"
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
            <div className="flex justify-end">
              <a href="/forgot-password?portal=admin" className="text-xs text-brand-red font-semibold hover:underline">
                Forgot password?
              </a>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In to Admin Panel'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">Unauthorised access is prohibited.</p>
        <p className="text-center text-xs text-gray-500 mt-2">
          Looking for the{' '}
          <a href="/staff/login" className="text-brand-red hover:underline">
            Staff Portal (CCL Login)?
          </a>
        </p>
      </div>
    </div>
  )
}
