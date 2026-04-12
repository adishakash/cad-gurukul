import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '../store/slices/authSlice'
import api, { leadApi } from '../services/api'
import toast from 'react-hot-toast'

// ── Funnel progress bar ───────────────────────────────────────────────────────
const FUNNEL_STEPS = [
  { key: 'new_lead',             label: 'Lead Created',         icon: '✅', includes: ['new_lead', 'onboarding_started', 'plan_selected'] },
  { key: 'assessment_started',   label: 'Assessment Started',   icon: '📝', includes: ['assessment_started', 'assessment_in_progress'] },
  { key: 'assessment_completed', label: 'Assessment Done',      icon: '🎯', includes: ['assessment_completed'] },
  { key: 'free_report_ready',    label: 'Free Report Ready',    icon: '📊', includes: ['free_report_ready'] },
  { key: 'paid',                 label: 'Payment Complete',     icon: '💳', includes: ['payment_pending', 'paid', 'premium_report_generating'] },
  { key: 'premium_report_ready', label: 'Premium Report Ready', icon: '📄', includes: ['premium_report_ready', 'counselling_interested', 'closed'] },
]

const resolveStatusIndex = (status) => {
  const idx = FUNNEL_STEPS.findIndex((step) => step.includes.includes(status))
  return idx >= 0 ? idx : 0
}

function FunnelProgress({ status }) {
  const currentIdx = resolveStatusIndex(status)
  return (
    <div className="card mb-6">
      <h3 className="font-bold text-brand-dark mb-4 text-sm">🗺️ Your Career Journey Progress</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {FUNNEL_STEPS.map((step, idx) => {
          const done    = idx <= currentIdx
          const current = idx === currentIdx
          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div className={`flex flex-col items-center gap-1 ${done ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${current ? 'border-brand-red bg-red-50' : done ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  {step.icon}
                </div>
                <span className="text-[10px] text-center text-gray-500 leading-tight max-w-[56px]">{step.label}</span>
              </div>
              {idx < FUNNEL_STEPS.length - 1 && (
                <div className={`w-4 h-0.5 mb-4 rounded ${idx < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">Current status: {status?.replace(/_/g, ' ') || 'new lead'}</p>
    </div>
  )
}

function ProfileRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-brand-dark">{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const user = useSelector(selectUser)
  const navigate = useNavigate()
  const [profile, setProfile]   = useState(null)
  const [reports, setReports]   = useState([])
  const [lead, setLead]         = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, reportsRes, leadRes] = await Promise.all([
          api.get('/students/me').catch(() => ({ data: { data: null } })),
          api.get('/reports/my').catch(() => ({ data: { data: [] } })),
          leadApi.getMe().catch(() => ({ data: { data: null } })),
        ])
        setProfile(profileRes.data.data)
        setReports(reportsRes.data.data || [])
        setLead(leadRes.data.data)
      } catch {
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const completedReports  = reports.filter((r) => r.status === 'COMPLETED')
  const generatingReports = reports.filter((r) => r.status === 'GENERATING')
  const freeReport        = completedReports.find((r) => r.accessLevel === 'FREE')
  const paidReport        = completedReports.find((r) => r.accessLevel === 'PAID')
  const planType          = lead?.planType || 'free'   // "free" | "standard" | "premium" | "consultation"
  const hasPremium        = planType === 'premium' || planType === 'consultation'
  const hasStandard       = planType === 'standard'

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
        {/* Funnel progress */}
        {lead && <FunnelProgress status={lead.status} />}

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

        {/* ── Revenue upsell banners ─────────────────────────────────────────────── */}

        {/* Paid ₹499 → Upsell ₹1,999 */}
        {hasStandard && paidReport && (
          <div className="mb-6 rounded-2xl border-2 border-purple-400 bg-gradient-to-r from-purple-50 to-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-1">🚀 Unlock Deeper Clarity</div>
              <div className="font-bold text-brand-dark">Upgrade to Premium AI Report — ₹1,999</div>
              <p className="text-sm text-gray-600 mt-0.5">Year-by-year roadmap · Subject strategy · Exam timeline · Scholarship list</p>
            </div>
            <button
              onClick={() => navigate(`/payment?plan=premium&assessmentId=${paidReport.assessmentId || ''}`)}
              className="bg-purple-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-700 transition shrink-0"
            >
              Upgrade Now →
            </button>
          </div>
        )}

        {/* Paid ₹1,999 → Upsell ₹9,999 session */}
        {hasPremium && planType !== 'consultation' && (
          <div className="mb-6 rounded-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-block bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">🔥 Limited — 3 slots/day</div>
              <div className="font-bold text-brand-dark">Book 1:1 Session with Adish Gupta — ₹9,999</div>
              <p className="text-sm text-gray-600 mt-0.5">45-min personalised session · Recording included · Parents can join</p>
            </div>
            <button
              onClick={() => navigate('/payment?plan=consultation')}
              className="bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-orange-600 transition shrink-0"
            >
              Book My Slot →
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => navigate('/assessment?plan=FREE')}
            className="card hover:shadow-lg transition-shadow text-left border-l-4 border-brand-red cursor-pointer"
          >
            <div className="text-3xl mb-2">📝</div>
            <div className="font-bold text-brand-dark">Free Assessment</div>
            <div className="text-sm text-gray-500 mt-1">10 AI questions · Basic report</div>
            <div className="mt-3 text-brand-red text-sm font-semibold">Start Now →</div>
          </button>

          <button
            onClick={() => navigate('/payment?plan=standard')}
            className="card hover:shadow-lg transition-shadow text-left border-l-4 border-green-500 cursor-pointer"
          >
            <div className="text-3xl mb-2">💎</div>
            <div className="font-bold text-brand-dark">Full Report</div>
            <div className="text-sm text-gray-500 mt-1">7 careers · roadmap · PDF · ₹499</div>
            <div className="mt-3 text-green-600 text-sm font-semibold">Get Report →</div>
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
                            {report.accessLevel === 'PAID' ? '💎 Paid' : '🆓 Free'}
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

                  {/* Conversion: has free report but no paid */}
                  {freeReport && !paidReport && (
                    <div className="bg-gradient-to-r from-brand-dark to-brand-navy text-white rounded-xl p-5 mt-2">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl shrink-0">🔐</span>
                        <div className="flex-1">
                          <div className="font-bold text-base">Unlock your full career blueprint 🔓</div>
                          <p className="text-gray-300 text-sm mt-1">
                            4 more high-fit career matches · 3-year roadmap · Subject strategy · Downloadable PDF
                          </p>
                          <p className="text-yellow-300 text-xs mt-1 font-semibold">
                            ⚠️ One wrong stream can cost 3 years. Unlock clarity today.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => navigate(`/payment?plan=standard&assessmentId=${freeReport.assessmentId || ''}`)}
                          className="flex-1 bg-white text-brand-dark font-bold py-2.5 rounded-xl text-sm hover:bg-gray-100 transition"
                        >
                          Full Report — ₹499
                        </button>
                        <button
                          onClick={() => navigate(`/payment?plan=premium&assessmentId=${freeReport.assessmentId || ''}`)}
                          className="flex-1 bg-brand-red text-white font-bold py-2.5 rounded-xl text-sm hover:bg-red-700 transition"
                        >
                          🚀 Premium AI — ₹1,999 ⭐
                        </button>
                      </div>
                      <p className="text-center text-xs text-gray-400 mt-2">🔒 Secured by Razorpay</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
