import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { reportApi, trackEvent } from '../services/api'
import toast from 'react-hot-toast'
import PremiumUpsell from '../components/PremiumUpsell'

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
        <p className="text-gray-600 text-sm mt-1">{career.description}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-2xl font-extrabold text-brand-red">{career.fitScore}%</div>
        <div className="text-xs text-gray-400">fit</div>
      </div>
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

  // Track free report view
  useEffect(() => {
    if (report && report.accessLevel === 'FREE' && report.status === 'COMPLETED') {
      trackEvent('free_report_viewed', { reportId: id })
      // Show upsell 3s after free report loads
      const t = setTimeout(() => setShowUpsell(true), 3000)
      return () => clearTimeout(t)
    }
    if (report && report.accessLevel === 'PAID') {
      trackEvent('premium_report_viewed', { reportId: id })
    }
  }, [report])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await reportApi.downloadPdf(id)
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `CAD-Gurukul-Report-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF download failed. Try again.')
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

  const isPaid = report.accessLevel === 'PAID'
  const evaluation = report.evaluation || {}
  const careers = report.topCareers || report.careers || []
  const roadmaps = report.roadmaps || []
  const parentGuidance = report.parentGuidance
  const streamRec = report.streamRecommendation || report.recommendedStream || evaluation.recommendedStream

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="card shadow-xl mb-6 text-center">
          <div className="text-5xl mb-2">📊</div>
          <h1 className="text-2xl font-extrabold text-brand-dark">Your Career Report</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isPaid ? '💎 Premium Report' : '🆓 Free Report'} · Generated {new Date(report.generatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
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

        {/* 🔐 FREE REPORT: Urgency lock banner */}
        {!isPaid && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-dark to-brand-navy text-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">🔐</span>
              <div>
                <p className="font-bold text-base leading-snug">
                  Your exact career path is hidden below
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  You've seen 3 careers. Based on your answers, you are <strong className="text-yellow-300">NOT suited for random stream selection</strong>. 47 students from your city unlocked clarity this week.
                </p>
                <button
                  onClick={() => navigate(`/payment?assessmentId=${report.assessmentId}`)}
                  className="mt-3 bg-brand-red text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-red-700 transition"
                >
                  Unlock Your Exact Career Path — ₹499 →
                </button>
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

          {/* Blurred locked careers preview for free users */}
          {!isPaid && (
            <div className="relative mt-2">
              <div className="blur-sm pointer-events-none select-none">
                {[
                  { name: '🔒 Career Match #4', fitScore: 87, description: 'Unlock to see this high-fit career recommendation', stream: 'Hidden' },
                  { name: '🔒 Career Match #5', fitScore: 82, description: 'Unlock to see this high-fit career recommendation', stream: 'Hidden' },
                ].map((c, i) => <CareerCard key={i} career={c} index={i} />)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => navigate(`/payment?assessmentId=${report.assessmentId}`)}
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

        {/* Premium CTA for free users — shown immediately inline */}
        {!isPaid && (
          <div className="space-y-4">
            <PremiumUpsell
              assessmentId={report.assessmentId}
              inline
            />
          </div>
        )}
      </div>

      {/* Floating sticky upgrade bar on mobile for free report */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-red text-white px-4 py-3 flex items-center justify-between shadow-2xl md:hidden">
          <div>
            <div className="font-bold text-sm">Unlock Full Report</div>
            <div className="text-xs text-red-200">7 careers · roadmap · PDF · ₹499</div>
          </div>
          <button
            onClick={() => { trackEvent('premium_cta_clicked', { source: 'sticky_bar' }); navigate(`/payment?assessmentId=${report.assessmentId}`) }}
            className="bg-white text-brand-red font-bold text-sm px-4 py-2 rounded-lg shrink-0"
          >
            Upgrade →
          </button>
        </div>
      )}

      {/* Auto-show upsell modal */}
      {showUpsell && !isPaid && (
        <PremiumUpsell
          assessmentId={report.assessmentId}
          onClose={() => setShowUpsell(false)}
        />
      )}
    </div>
  )
}
