import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '../store/slices/authSlice'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const user = useSelector(selectUser)
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [reports, setReports] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, reportsRes] = await Promise.all([
          api.get('/students/me').catch(() => ({ data: { data: null } })),
          api.get('/reports/my').catch(() => ({ data: { data: [] } })),
        ])
        setProfile(profileRes.data.data)
        setReports(reportsRes.data.data || [])
      } catch (err) {
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const completedReports = reports.filter((r) => r.status === 'COMPLETED')
  const generatingReports = reports.filter((r) => r.status === 'GENERATING')

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header strip */}
      <div className="bg-gradient-to-r from-brand-dark to-brand-navy text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold">Welcome back, {profile?.fullName || user?.email?.split('@')[0]}! 👋</h1>
          <p className="text-gray-300 text-sm mt-1">Your career journey dashboard</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile not complete notice */}
        {(!profile || !profile.isOnboardingComplete) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-amber-800">⚠️ Complete Your Profile First</div>
              <p className="text-amber-700 text-sm mt-0.5">Fill in your details to get an accurate, personalized career report.</p>
            </div>
            <Link to="/onboarding" className="btn-primary shrink-0 text-sm px-5 py-2">Complete Profile →</Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => {
              if (!profile?.isOnboardingComplete) return toast.error('Complete your profile first!')
              navigate('/assessment?plan=FREE')
            }}
            className="card hover:shadow-lg transition-shadow text-left border-l-4 border-brand-red cursor-pointer"
          >
            <div className="text-3xl mb-2">🧠</div>
            <div className="font-bold text-brand-dark">Free Assessment</div>
            <div className="text-sm text-gray-500 mt-1">10 AI questions · Basic report</div>
            <div className="mt-3 text-brand-red text-sm font-semibold">Start Now →</div>
          </button>

          <button
            onClick={() => navigate('/plans')}
            className="card hover:shadow-lg transition-shadow text-left border-l-4 border-green-500 cursor-pointer"
          >
            <div className="text-3xl mb-2">💎</div>
            <div className="font-bold text-brand-dark">Premium Report</div>
            <div className="text-sm text-gray-500 mt-1">30 questions · Full analysis · ₹499</div>
            <div className="mt-3 text-green-600 text-sm font-semibold">Get Premium →</div>
          </button>

          <button
            onClick={() => navigate('/onboarding')}
            className="card hover:shadow-lg transition-shadow text-left border-l-4 border-blue-500 cursor-pointer"
          >
            <div className="text-3xl mb-2">✏️</div>
            <div className="font-bold text-brand-dark">Edit Profile</div>
            <div className="text-sm text-gray-500 mt-1">Update your details</div>
            <div className="mt-3 text-blue-600 text-sm font-semibold">Edit →</div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <div className="lg:col-span-1">
            <div className="card">
              <h3 className="font-bold text-brand-dark mb-4">📋 Your Profile</h3>
              {profile ? (
                <div className="space-y-3">
                  <ProfileRow label="Name" value={profile.fullName} />
                  <ProfileRow label="Class" value={profile.classStandard?.replace('_', ' ')} />
                  <ProfileRow label="Board" value={profile.board?.replace('_', ' ')} />
                  <ProfileRow label="School" value={profile.schoolName} />
                  <ProfileRow label="City" value={profile.city} />
                  <ProfileRow label="State" value={profile.state} />
                  {profile.preferredSubjects?.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Subjects</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.preferredSubjects.slice(0, 4).map((s) => (
                          <span key={s} className="bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No profile yet. Complete onboarding to get started.</p>
              )}
            </div>
          </div>

          {/* Reports */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="font-bold text-brand-dark mb-4">📊 Your Career Reports</h3>

              {generatingReports.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-700">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span className="font-semibold text-sm">AI is generating your report...</span>
                  </div>
                  <p className="text-blue-600 text-xs mt-1">This usually takes 1-2 minutes. Refresh the page to check.</p>
                </div>
              )}

              {completedReports.length === 0 && generatingReports.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-gray-500 text-sm">No reports yet. Start an assessment to get your first career report.</p>
                  <button
                    onClick={() => navigate('/assessment?plan=FREE')}
                    className="btn-primary mt-4 text-sm"
                  >
                    Start Free Assessment
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${report.accessLevel === 'PAID' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                            {report.accessLevel === 'PAID' ? '💎 Premium' : '🆓 Free'}
                          </span>
                          {report.confidenceScore && (
                            <span className="text-xs text-green-600 font-semibold">✓ {report.confidenceScore}% fit score</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-brand-dark mt-1">
                          {report.recommendedStream ? `Recommended: ${report.recommendedStream}` : 'Career Analysis Ready'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(report.generatedAt || report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <Link to={`/reports/${report.id}`} className="btn-primary text-xs px-4 py-2">
                        View Report
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ProfileRow = ({ label, value }) =>
  value ? (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{value}</span>
    </div>
  ) : null
