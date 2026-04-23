import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { reportApi, trackEvent } from '../services/api'
import toast from 'react-hot-toast'
import PremiumUpsell from '../components/PremiumUpsell'
import { formatRupees, getUpgradePrice } from '../utils/planPricing'

const POLL_INTERVAL = 12000

const ScoreRadar = ({ evaluation }) => {
  if (!evaluation?.categoryScores) return null
  const data = Object.entries(evaluation.categoryScores).map(([key, value]) => ({
    category: key.replace(/_/g, ' ').slice(0, 14),
    score: Math.round(Number(value) * 10) / 10,
  }))
  return (
    <div className="card mb-6">
      <h3 className="section-title mb-4">Your Aptitude Profile</h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
            <Radar name="Score" dataKey="score" stroke="#e53e3e" fill="#e53e3e" fillOpacity={0.25} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const CareerCard = ({ career, index }) => (
  <div className="card border-l-4 border-brand-red mb-4 animate-slide-up" style={{ animationDelay: `${index * 80}ms` }}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="font-bold text-brand-dark text-lg">{career.name}</h4>
        <p className="text-gray-600 text-sm mt-1">{career.description || 'Suggested based on your assessment answers.'}</p>
      </div>
      {career.fitScore != null && Number.isFinite(Number(career.fitScore)) && (
        <div className="shrink-0 text-right">
          <div className="text-2xl font-extrabold text-brand-red">{Math.round(Number(career.fitScore))}%</div>
          <div className="text-xs text-gray-400">fit</div>
        </div>
      )}
    </div>
    {career.stream && (
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="bg-orange-50 text-brand-red text-xs font-semibold px-3 py-1 rounded-full">
          Stream: {career.stream}
        </span>
        {career.subjects?.slice(0, 3).map((s) => (
          <span key={s} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">{s}</span>
        ))}
      </div>
    )}
  </div>
)

export default function Report() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showUpsell, setShowUpsell] = useState(false)
  const pollRef = useRef(null)

  const fetchReport = async () => {
    try {
      const { data } = await reportApi.getReport(id)
      const r = data.data
      setReport(r)

      if (r.status === 'GENERATING') {
        setGenerating(true)
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchReport, POLL_INTERVAL)
        }
      } else {
        setGenerating(false)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    } catch {
      toast.error('Could not load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
    return () => pollRef.current && clearInterval(pollRef.current)
  }, [id])

  // Track free report view + analytics
  useEffect(() => {
    if (report && report.accessLevel === 'FREE' && report.status === 'COMPLETED') {
      trackEvent('report_viewed', { reportId: id, type: 'free' })
      // Show upsell modal 3s after free report loads
      const t = setTimeout(() => setShowUpsell(true), 3000)
      return () => clearTimeout(t)
    }
    if (report && report.accessLevel === 'PAID') {
      trackEvent('report_viewed', { reportId: id, type: report.reportType || 'standard' })
    }
  }, [report])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await reportApi.downloadPdf(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })

      // Guard: if the response is a JSON error blob (not a real PDF), surface the message
      if (blob.size < 500 || response.headers?.['content-type']?.includes('application/json')) {
        const text = await blob.text()
        let msg = 'PDF download failed. Try again.'
        try { msg = JSON.parse(text)?.message || msg } catch (_) {}
        toast.error(msg)
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CAD-Gurukul-Report-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 100)
    } catch (err) {
      // Axios rejects non-2xx — try to extract server message from blob response
      let msg = 'PDF download failed. Try again.'
      try {
        const blobData = err?.response?.data
        if (blobData instanceof Blob) {
          const text = await blobData.text()
          const parsed = JSON.parse(text)
          msg = parsed?.error?.message || parsed?.message || msg
        }
      } catch (_) {}
      toast.error(msg)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full" />
      </div>
    )
  }

  if (generating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center card max-w-sm mx-4">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-xl font-bold text-brand-dark mb-2">Generating Your Report</h2>
          <p className="text-gray-500 text-sm mb-4">
            Our AI is analysing your answers and crafting your personalised career report. This usually takes 30–60 seconds.
          </p>
          <div className="animate-spin w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-gray-400 mt-4">Auto-refreshing every 12 seconds…</p>
        </div>
      </div>
    )
  }

  if (!report) return <div className="text-center py-20 text-gray-400">Report not found.</div>

  const isPaid       = report.accessLevel === 'PAID'
  const reportType   = report.reportType || (isPaid ? 'standard' : 'free')
  const isPremium    = reportType === 'premium'
  const isStandard   = isPaid && !isPremium
  const evaluation   = report.evaluation || {}
  const careers      = report.topCareers || report.careers || []
  const roadmaps     = report.roadmaps || report.yearWiseRoadmap || []
  const parentGuidance = report.parentGuidance
  const streamRec    = report.streamRecommendation || report.recommendedStream || evaluation.recommendedStream
  const subjectStrategy = report.subjectStrategy

  // ── Plan-type awareness from backend ────────────────────────────────────────
  // Backend now sends `userPlanType` and `consultationPurchased` on all report responses.
  const consultationPurchased = report.consultationPurchased || false
  const userPlanType          = report.userPlanType || (isPaid ? reportType : 'free')
  // Only show upgrade CTAs when upgradeCTA is present (backend suppresses it for paid-plan users)
  const showUpgradeCTA = !isPaid && Boolean(report.upgradeCTA)
  const premiumUpgradePrice = report.premiumUpsell?.price || formatRupees(getUpgradePrice(userPlanType, 'premium'))
  const consultationUpgradePrice = report.consultationUpsell?.price || formatRupees(getUpgradePrice(userPlanType, 'consultation'))

  // Header label
  const reportLabel = isPremium ? '🚀 Premium AI Report' : isPaid ? '💎 Full Report' : '🆓 Free Preview'

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="card shadow-xl mb-6 text-center">
          <div className="text-5xl mb-2">📊</div>
          <h1 className="text-2xl font-extrabold text-brand-dark">Your Career Report</h1>
          <p className="text-gray-500 text-sm mt-1">
            {reportLabel} · Generated {new Date(report.generatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </p>
          {streamRec && (
            <div className="mt-4 inline-block bg-red-50 text-brand-red font-bold px-5 py-2 rounded-full text-sm">
              Recommended Stream: {streamRec}
            </div>
          )}
          {isPaid && (
            <div className="mt-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                {downloading ? 'Generating PDF…' : '⬇ Download PDF Report'}
              </button>
            </div>
          )}
        </div>

        {/* Radar chart (paid only) */}
        {isPaid && <ScoreRadar evaluation={evaluation} />}

        {/* Subject Strategy — premium only */}
        {isPremium && subjectStrategy && (
          <div className="card mb-6 border-l-4 border-purple-500 bg-purple-50">
            <h2 className="section-title mb-3">📚 Subject Strategy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {subjectStrategy.mustTake?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-green-700 uppercase mb-1">Must Take</div>
                  {subjectStrategy.mustTake.map((s) => <div key={s} className="text-sm text-gray-700 bg-green-50 px-2 py-1 rounded mb-1">✓ {s}</div>)}
                </div>
              )}
              {subjectStrategy.recommended?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-blue-700 uppercase mb-1">Recommended</div>
                  {subjectStrategy.recommended.map((s) => <div key={s} className="text-sm text-gray-700 bg-blue-50 px-2 py-1 rounded mb-1">→ {s}</div>)}
                </div>
              )}
              {subjectStrategy.avoid?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-red-700 uppercase mb-1">Reconsider</div>
                  {subjectStrategy.avoid.map((s) => <div key={s} className="text-sm text-gray-500 bg-red-50 px-2 py-1 rounded mb-1">⚠ {s}</div>)}
                </div>
              )}
            </div>
            {subjectStrategy.reasoning && <p className="text-xs text-gray-600 mt-3 leading-relaxed">{subjectStrategy.reasoning}</p>}
          </div>
        )}

        {/* 🔐 FREE REPORT: dual-CTA lock banner — only for users who have NOT yet purchased any paid plan */}
        {showUpgradeCTA && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-dark to-brand-navy text-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">🔐</span>
              <div className="w-full">
                <p className="font-bold text-base leading-snug">
                  Your strongest career path is locked 🔒
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  You've seen 3 careers. Based on your answers, you are <strong className="text-yellow-300">NOT suited for random stream selection</strong>. 47 students from your city unlocked clarity this week.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => { trackEvent('premium_clicked', { source: 'lock_banner', plan: 'standard' }); navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`) }}
                    className="bg-white text-brand-dark font-bold px-4 py-2 rounded-xl text-sm hover:bg-gray-100 transition"
                  >
                    Full Report — ₹499 →
                  </button>
                  <button
                    onClick={() => { trackEvent('premium_clicked', { source: 'lock_banner', plan: 'premium' }); navigate(`/payment?plan=premium&assessmentId=${report.assessmentId}`) }}
                    className="bg-brand-red text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-red-700 transition border border-red-400"
                  >
                    🚀 Premium AI Report — ₹1,999 ⭐
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Careers */}
        <div className="mb-6">
          <h2 className="section-title mb-4">
            {isPaid ? `Top ${careers.length} Career Paths` : 'Top 3 Career Suggestions (Preview)'}
          </h2>
          {careers.slice(0, isPaid ? undefined : 3).map((career, i) => (
            <CareerCard key={career.name || i} career={career} index={i} />
          ))}

          {/* Blurred locked careers preview — only for free users without a paid plan */}
          {!isPaid && showUpgradeCTA && (
            <div className="relative mt-2">
              <div className="blur-sm pointer-events-none select-none">
                {[
                  { name: '🔒 Career Match #4', fitScore: 87, description: 'Unlock to see this high-fit career recommendation', stream: 'Hidden' },
                  { name: '🔒 Career Match #5', fitScore: 82, description: 'Unlock to see this high-fit career recommendation', stream: 'Hidden' },
                ].map((c, i) => <CareerCard key={i} career={c} index={i} />)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`)}
                  className="bg-brand-red text-white font-bold px-6 py-3 rounded-xl shadow-2xl text-sm hover:bg-red-700 transition"
                >
                  🔓 Unlock 4 More Career Matches →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Roadmaps (paid only) */}
        {isPaid && roadmaps.length > 0 && (
          <div className="mb-6">
            <h2 className="section-title mb-4">Career Roadmaps</h2>
            {roadmaps.map((rm, i) => (
              <div key={i} className="card mb-4">
                <h3 className="font-bold text-brand-dark mb-3">{rm.career}</h3>
                <ol className="space-y-2">
                  {rm.steps?.map((step, j) => (
                    <li key={j} className="flex gap-3 text-sm text-gray-700">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-brand-red text-white text-xs flex items-center justify-center font-bold">
                        {j + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Parent guidance (paid only) */}
        {isPaid && parentGuidance && (
          <div className="card mb-6 border-l-4 border-brand-navy bg-blue-50">
            <h2 className="section-title mb-2">For Parents 👨‍👩‍👧</h2>
            <p className="text-gray-700 text-sm leading-relaxed">{parentGuidance}</p>
          </div>
        )}

        {/* Key action — premium only */}
        {isPremium && report.keyActionNextMonth && (
          <div className="card mb-6 border-2 border-brand-red bg-red-50 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-bold text-brand-dark mb-1">Your #1 Priority This Month</h3>
            <p className="text-gray-700 text-sm">{report.keyActionNextMonth}</p>
          </div>
        )}

        {/* Standard-paid → Premium upsell */}
        {isStandard && report.premiumUpsell?.show && (
          <div className="card mb-6 border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-white">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">Level Up Your Report</div>
                <h3 className="font-extrabold text-brand-dark text-lg">{report.premiumUpsell.headline}</h3>
                <ul className="mt-2 space-y-1">
                  {report.premiumUpsell.benefits.map((b) => (
                    <li key={b} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5 shrink-0">✓</span>{b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { trackEvent('premium_clicked', { source: 'standard_report_upsell' }); navigate(`/payment?plan=premium&assessmentId=${report.assessmentId}`) }}
                  className="mt-4 bg-purple-600 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-purple-700 transition"
                >
                  Upgrade to Premium AI Report — {premiumUpgradePrice} →
                </button>
                <p className="text-xs text-gray-400 mt-2">Your ₹499 plan is already included. Pay only the difference.</p>
              </div>
            </div>
          </div>
        )}

        {/* Consultation CTA — shown for premium report holders who have NOT yet purchased consultation */}
        {isPremium && !consultationPurchased && (
          <div className="card mb-6 border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-white">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📞</span>
              <div>
                <div className="inline-block bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">🔥 Limited — Only 3 slots/day</div>
                <h3 className="font-extrabold text-brand-dark text-lg">1:1 Career Blueprint Session with Adish Gupta</h3>
                <p className="text-sm text-gray-600 mt-1">45-minute personalised session · Parents can join · Session recording included · 30-day email support</p>
                <button
                  onClick={() => { trackEvent('premium_clicked', { source: 'premium_report_consultation' }); navigate(`/payment?plan=consultation${report.assessmentId ? `&assessmentId=${report.assessmentId}` : ''}`) }}
                  className="mt-4 bg-orange-500 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange-600 transition"
                >
                  Upgrade to 1:1 Session — {consultationUpgradePrice} →
                </button>
                <p className="text-xs text-gray-400 mt-2">Your Premium AI Report is already included. Pay only the difference for the live counselling session.</p>
              </div>
            </div>
          </div>
        )}

        {/* Inline upsell — only for free users who have not yet purchased any plan */}
        {!isPaid && showUpgradeCTA && (
          <div className="space-y-4">
            <PremiumUpsell
              assessmentId={report.assessmentId}
              inline
              fromPlan="free"
            />
          </div>
        )}
      </div>

      {/* Floating sticky upgrade bar — only for free users without a paid plan */}
      {showUpgradeCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-red text-white px-4 py-3 flex items-center justify-between shadow-2xl md:hidden">
          <div>
            <div className="font-bold text-sm">Unlock My Career Path 🔓</div>
            <div className="text-xs text-red-200">Full Report ₹499 · Premium AI ₹1,999</div>
          </div>
          <button
            onClick={() => { trackEvent('premium_cta_clicked', { source: 'sticky_bar' }); navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`) }}
            className="bg-white text-brand-red font-bold text-sm px-4 py-2 rounded-lg shrink-0"
          >
            Upgrade →
          </button>
        </div>
      )}

      {/* Auto-show upsell modal — only for free users without a paid plan */}
      {showUpsell && showUpgradeCTA && (
        <PremiumUpsell
          assessmentId={report.assessmentId}
          onClose={() => setShowUpsell(false)}
          fromPlan="free"
        />
      )}
    </div>
  )
}
