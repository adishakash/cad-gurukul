import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { reportApi, trackEvent } from '../services/api'
import toast from 'react-hot-toast'
import PremiumUpsell from '../components/PremiumUpsell'
import { formatRupees, getUpgradePrice } from '../utils/planPricing'
import { useTranslation } from 'react-i18next'
import { getLanguageLocale } from '../i18n/languages'

const POLL_INTERVAL = 12000

const ScoreRadar = ({ evaluation }) => {
  const { t } = useTranslation()
  if (!evaluation?.categoryScores) return null
  const data = Object.entries(evaluation.categoryScores).map(([key, value]) => ({
    category: t(`report.scoreLabels.${key}`, { defaultValue: key.replace(/_/g, ' ') }),
    score: Math.round(Number(value) * 10) / 10,
  }))
  return (
    <div className="card mb-8">
      <h3 className="section-title mb-4">{t('report.sections.aptitudeProfile')}</h3>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
            <Radar name={t('report.chart.scoreLabel')} dataKey="score" stroke="#c18a3b" fill="#c18a3b" fillOpacity={0.2} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const CareerCard = ({ career, index }) => {
  const { t } = useTranslation()
  const description = career.description || t('report.careerCard.fallbackDescription')

  return (
    <div className="card border-l-4 border-brand-red mb-4 animate-slide-up" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-bold text-brand-dark text-lg">{career.name}</h4>
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        </div>
        {career.fitScore != null && Number.isFinite(Number(career.fitScore)) && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold text-brand-red">{Math.round(Number(career.fitScore))}%</div>
            <div className="text-xs text-gray-400">{t('report.careerCard.fit')}</div>
          </div>
        )}
      </div>
      {career.stream && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="bg-[#fff0d7] text-[#a4631b] text-xs font-semibold px-3 py-1 rounded-full">
            {t('report.careerCard.stream', { stream: career.stream })}
          </span>
          {career.subjects?.slice(0, 3).map((s) => (
            <span key={s} className="bg-[#f4ecdf] text-gray-700 text-xs px-3 py-1 rounded-full">{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Report() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showUpsell, setShowUpsell] = useState(false)
  const pollRef = useRef(null)
  const locale = getLanguageLocale(i18n.language)

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
      toast.error(t('report.errors.load'))
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

  const isPaid       = report?.accessLevel === 'PAID'
  const reportType   = report?.reportType || (isPaid ? 'standard' : 'free')
  const isPremium    = reportType === 'premium'
  const isStandard   = isPaid && !isPremium

  // ── Plan-type awareness from backend ────────────────────────────────────────
  // Backend now sends `userPlanType` and `consultationPurchased` on all report responses.
  const consultationPurchased = report?.consultationPurchased || false
  const userPlanType          = report?.userPlanType || (isPaid ? reportType : 'free')
  const upgradeInProgress = !isPaid && ['standard', 'premium'].includes(userPlanType)
  // Only show upgrade CTAs when upgradeCTA is present (backend suppresses it for paid-plan users)
  const showUpgradeCTA = !isPaid && Boolean(report?.upgradeCTA)
  const premiumUpgradePrice = report?.premiumUpsell?.price || formatRupees(getUpgradePrice(userPlanType, 'premium'))
  const consultationUpgradePrice = report?.consultationUpsell?.price || formatRupees(getUpgradePrice(userPlanType, 'consultation'))
  const premiumUpsellCopy = t('report.premiumUpsell', { returnObjects: true })
  const premiumHeadline = premiumUpsellCopy?.headline || report?.premiumUpsell?.headline || ''
  const premiumBenefits = Array.isArray(premiumUpsellCopy?.benefits)
    ? premiumUpsellCopy.benefits
    : (report?.premiumUpsell?.benefits || [])
  const consultationNote = isPremium
    ? t('report.consultation.note')
    : t('report.premiumUpsell.note')

  useEffect(() => {
    if (!upgradeInProgress) return
    const timeout = setTimeout(() => {
      navigate('/assessment?plan=PAID&resume=1')
    }, 1200)
    return () => clearTimeout(timeout)
  }, [upgradeInProgress, navigate])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await reportApi.downloadPdf(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })

      // Guard: if the response is a JSON error blob (not a real PDF), surface the message
      if (blob.size < 500 || response.headers?.['content-type']?.includes('application/json')) {
        const text = await blob.text()
        let msg = t('report.errors.download')
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
      let msg = t('report.errors.download')
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
          <h2 className="text-xl font-bold text-brand-dark mb-2">{t('report.generating.title')}</h2>
          <p className="text-gray-500 text-sm mb-4">{t('report.generating.body')}</p>
          <div className="animate-spin w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-gray-400 mt-4">{t('report.generating.autoRefresh', { seconds: Math.round(POLL_INTERVAL / 1000) })}</p>
        </div>
      </div>
    )
  }

  if (!report) return <div className="text-center py-20 text-gray-400">{t('report.errors.notFound')}</div>
  const evaluation   = report.evaluation || {}
  const careers      = report.topCareers || report.careers || []
  const roadmaps     = report.roadmaps || report.yearWiseRoadmap || []
  const parentGuidance = report.parentGuidance
  const streamRec    = report.streamRecommendation || report.recommendedStream || evaluation.recommendedStream
  const subjectStrategy = report.subjectStrategy

  // Header label
  const reportLabel = isPremium
    ? t('report.labels.premium')
    : isPaid
      ? t('report.labels.full')
      : t('report.labels.free')

  const reportYear = report?.generatedAt
    ? new Date(report.generatedAt).getFullYear()
    : new Date().getFullYear()
  const careerCount = isPaid ? careers.length : Math.min(careers.length, 3)
  const topCareer = careers[0]
  const hasConfidenceScore = Number.isFinite(Number(report.confidenceScore))
  const tocItems = [
    {
      id: 'careers',
      label: isPaid
        ? t('report.sections.careersPaid', { count: careerCount })
        : t('report.sections.careersFree'),
    },
    isPaid && { id: 'aptitude', label: t('report.sections.aptitudeProfile') },
    isPremium && subjectStrategy && { id: 'subject-strategy', label: t('report.sections.subjectStrategy') },
    isPaid && roadmaps.length > 0 && { id: 'roadmaps', label: t('report.sections.roadmaps') },
    isPaid && parentGuidance && { id: 'parents', label: t('report.sections.parents') },
    isPremium && report.keyActionNextMonth && { id: 'priority', label: t('report.sections.priority') },
  ].filter(Boolean)

  return (
    <div className="min-h-screen report-theme relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="report-grid" />
        <div className="report-orb report-orb--one" />
        <div className="report-orb report-orb--two" />
      </div>
      <div className="relative max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="report-card mb-10 p-8 md:p-10 animate-fade-in">
          <div className="flex flex-col lg:flex-row gap-10">
            <div className="flex-1">
              <div className="report-kicker">CAD Gurukul</div>
              <h1 className="report-title text-4xl md:text-5xl">{t('report.header.title')}</h1>
              <p className="report-meta mt-2">
                {reportLabel} · {t('report.header.generated', { date: new Date(report.generatedAt).toLocaleDateString(locale, { dateStyle: 'medium' }) })}
              </p>
              {streamRec && (
                <div className="mt-4 inline-flex items-center report-chip text-sm font-semibold px-4 py-2 rounded-full">
                  {t('report.header.recommendedStream', { stream: streamRec })}
                </div>
              )}
              {(hasConfidenceScore || topCareer) && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hasConfidenceScore && (
                    <div className="report-stat p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--report-ink-muted)]">
                        {t('report.careerCard.fit')}
                      </div>
                      <div className="report-stat-value">{Math.round(Number(report.confidenceScore))}%</div>
                    </div>
                  )}
                  {topCareer && (
                    <div className="report-stat p-4">
                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-[var(--report-ink-muted)]">
                        {isPaid
                          ? t('report.sections.careersPaid', { count: careerCount })
                          : t('report.sections.careersFree')}
                      </div>
                      <div className="text-lg font-semibold text-[var(--report-navy)]">{topCareer.name}</div>
                      {topCareer.stream && (
                        <div className="text-xs text-[var(--report-ink-muted)] mt-1">
                          {t('report.careerCard.stream', { stream: topCareer.stream })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {isPaid && (
                <div className="mt-6">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="report-btn"
                  >
                    {downloading ? t('report.header.downloading') : t('report.header.download')}
                  </button>
                </div>
              )}
            </div>
            <div className="w-full lg:w-[250px] space-y-4">
              <div className="report-stat p-5 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--report-ink-muted)]">
                  {t('report.header.title')}
                </div>
                <div className="report-stat-value text-4xl">{reportYear}</div>
                <div className="text-xs text-[var(--report-ink-muted)] mt-1">{reportLabel}</div>
              </div>
              {tocItems.length > 1 && (
                <div className="report-outline rounded-2xl p-4 bg-white/70">
                  <div className="report-kicker">Contents</div>
                  <div className="mt-3 space-y-2">
                    {tocItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="block text-sm text-[var(--report-ink-muted)] hover:text-[var(--report-navy)] transition"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {upgradeInProgress && (
          <div className="card mb-8 border border-[#e1c7a2] bg-[#fff6e8]">
            <h3 className="text-lg font-bold text-brand-dark">Payment received — finish your assessment</h3>
            <p className="text-sm text-gray-600 mt-1">
              Complete the remaining questions to unlock your full report and PDF download.
            </p>
            <button
              onClick={() => navigate('/assessment?plan=PAID&resume=1')}
              className="btn-primary mt-4"
            >
              Continue Assessment
            </button>
          </div>
        )}

        {/* Radar chart (paid only) */}
        {isPaid && (
          <section id="aptitude" className="mb-10">
            <div className="report-divider mb-4" />
            <ScoreRadar evaluation={evaluation} />
          </section>
        )}

        {/* Subject Strategy — premium only */}
        {isPremium && subjectStrategy && (
          <section id="subject-strategy" className="mb-10">
            <div className="report-divider mb-4" />
            <div className="card mb-6 border-l-4 border-[#c18a3b] bg-[#fff6e8]">
              <h2 className="section-title mb-3">{t('report.sections.subjectStrategy')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {subjectStrategy.mustTake?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-green-700 uppercase mb-1">{t('report.subjectStrategy.mustTake')}</div>
                    {subjectStrategy.mustTake.map((s) => <div key={s} className="text-sm text-gray-700 bg-green-50 px-2 py-1 rounded mb-1">✓ {s}</div>)}
                  </div>
                )}
                {subjectStrategy.recommended?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-blue-700 uppercase mb-1">{t('report.subjectStrategy.recommended')}</div>
                    {subjectStrategy.recommended.map((s) => <div key={s} className="text-sm text-gray-700 bg-blue-50 px-2 py-1 rounded mb-1">→ {s}</div>)}
                  </div>
                )}
                {subjectStrategy.avoid?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-red-700 uppercase mb-1">{t('report.subjectStrategy.avoid')}</div>
                    {subjectStrategy.avoid.map((s) => <div key={s} className="text-sm text-gray-500 bg-red-50 px-2 py-1 rounded mb-1">⚠ {s}</div>)}
                  </div>
                )}
              </div>
              {subjectStrategy.reasoning && <p className="text-xs text-gray-600 mt-3 leading-relaxed">{subjectStrategy.reasoning}</p>}
            </div>
          </section>
        )}

        {/* 🔐 FREE REPORT: dual-CTA lock banner — only for users who have NOT yet purchased any paid plan */}
        {showUpgradeCTA && (
          <div className="mb-8 rounded-3xl bg-gradient-to-r from-[#1f2d3a] to-[#2d4154] text-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="text-3xl shrink-0">🔐</span>
              <div className="w-full">
                <p className="font-bold text-base leading-snug">
                  {t('report.lockBanner.title')}
                </p>
                <p className="text-[#f2dcc4] text-sm mt-1">
                  {t('report.lockBanner.bodyPrefix')}{' '}
                  <strong className="text-[#f3d19b]">{t('report.lockBanner.bodyEmphasis')}</strong>
                  {t('report.lockBanner.bodySuffix')}
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => { trackEvent('premium_clicked', { source: 'lock_banner', plan: 'standard' }); navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`) }}
                    className="report-btn-outline text-sm"
                  >
                    {t('report.lockBanner.ctaStandard', { price: '₹499' })}
                  </button>
                  <button
                    onClick={() => { trackEvent('premium_clicked', { source: 'lock_banner', plan: 'premium' }); navigate(`/payment?plan=premium&assessmentId=${report.assessmentId}`) }}
                    className="bg-[#c18a3b] text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-[#b1782e] transition"
                  >
                    {t('report.lockBanner.ctaPremium', { price: '₹1,999' })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Careers */}
        <section id="careers" className="mb-10">
          <div className="report-divider mb-4" />
          <h2 className="section-title mb-4">
            {isPaid
              ? t('report.sections.careersPaid', { count: careers.length })
              : t('report.sections.careersFree')}
          </h2>
          {careers.slice(0, isPaid ? undefined : 3).map((career, i) => (
            <CareerCard key={career.name || i} career={career} index={i} />
          ))}

          {/* Blurred locked careers preview — only for free users without a paid plan */}
          {!isPaid && showUpgradeCTA && (
            <div className="relative mt-2">
              <div className="blur-sm pointer-events-none select-none">
                {[
                  {
                    name: t('report.lockBanner.lockedCareerTitle', { number: 4 }),
                    fitScore: 87,
                    description: t('report.lockBanner.lockedCareerDescription'),
                    stream: t('report.lockBanner.hiddenStream'),
                  },
                  {
                    name: t('report.lockBanner.lockedCareerTitle', { number: 5 }),
                    fitScore: 82,
                    description: t('report.lockBanner.lockedCareerDescription'),
                    stream: t('report.lockBanner.hiddenStream'),
                  },
                ].map((c, i) => <CareerCard key={i} career={c} index={i} />)}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`)}
                  className="report-btn text-sm"
                >
                  {t('report.lockBanner.unlockMore')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Roadmaps (paid only) */}
        {isPaid && roadmaps.length > 0 && (
          <section id="roadmaps" className="mb-10">
            <div className="report-divider mb-4" />
            <h2 className="section-title mb-4">{t('report.sections.roadmaps')}</h2>
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
          </section>
        )}

        {/* Parent guidance (paid only) */}
        {isPaid && parentGuidance && (
          <section id="parents" className="mb-10">
            <div className="report-divider mb-4" />
            <div className="card border-l-4 border-[#1f2d3a] bg-[#f2f4f6]">
              <h2 className="section-title mb-2">{t('report.sections.parents')}</h2>
              <p className="text-gray-700 text-sm leading-relaxed">{parentGuidance}</p>
            </div>
          </section>
        )}

        {/* Key action — premium only */}
        {isPremium && report.keyActionNextMonth && (
          <section id="priority" className="mb-10">
            <div className="report-divider mb-4" />
            <div className="card border-2 border-[#c18a3b] bg-[#fff6e8] text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-bold text-brand-dark mb-1">{t('report.sections.priority')}</h3>
              <p className="text-gray-700 text-sm">{report.keyActionNextMonth}</p>
            </div>
          </section>
        )}

        {/* Standard-paid → Premium upsell */}
        {isStandard && report.premiumUpsell?.show && (
          <div className="card mb-8 border-2 border-[#c18a3b] bg-gradient-to-br from-[#fff6e8] to-white">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#a46d26] mb-1">{t('report.premiumUpsell.label')}</div>
                <h3 className="font-extrabold text-brand-dark text-lg">{premiumHeadline}</h3>
                <ul className="mt-2 space-y-1">
                  {premiumBenefits.map((b) => (
                    <li key={b} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-[#c18a3b] mt-0.5 shrink-0">✓</span>{b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { trackEvent('premium_clicked', { source: 'standard_report_upsell' }); navigate(`/payment?plan=premium&assessmentId=${report.assessmentId}`) }}
                  className="report-btn mt-4"
                >
                  {t('report.premiumUpsell.cta', { price: premiumUpgradePrice })}
                </button>
                <p className="text-xs text-gray-400 mt-2">{t('report.premiumUpsell.note')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Consultation CTA — shown for paid report holders who have NOT yet purchased consultation */}
        {(isPremium || isStandard) && !consultationPurchased && report.consultationUpsell?.show && (
          <div className="card mb-8 border-2 border-[#c45b3c] bg-gradient-to-br from-[#fff0e8] to-white">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📞</span>
              <div>
                <div className="inline-block bg-[#c45b3c] text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">{t('report.consultation.badge')}</div>
                <h3 className="font-extrabold text-brand-dark text-lg">{t('report.consultation.title')}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('report.consultation.body')}</p>
                <button
                  onClick={() => {
                    const source = isPremium ? 'premium_report_consultation' : 'standard_report_consultation'
                    trackEvent('premium_clicked', { source })
                    navigate(`/payment?plan=consultation${report.assessmentId ? `&assessmentId=${report.assessmentId}` : ''}`)
                  }}
                  className="mt-4 bg-[#c45b3c] text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-[#b54f34] transition"
                >
                  {t('report.consultation.cta', { price: consultationUpgradePrice })}
                </button>
                <p className="text-xs text-gray-400 mt-2">{consultationNote}</p>
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
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1f2d3a] text-white px-4 py-3 flex items-center justify-between shadow-2xl md:hidden">
          <div>
            <div className="font-bold text-sm">{t('report.sticky.title')}</div>
            <div className="text-xs text-[#f2dcc4]">{t('report.sticky.subtitle')}</div>
          </div>
          <button
            onClick={() => { trackEvent('premium_cta_clicked', { source: 'sticky_bar' }); navigate(`/payment?plan=standard&assessmentId=${report.assessmentId}`) }}
            className="bg-white text-[#1f2d3a] font-bold text-sm px-4 py-2 rounded-lg shrink-0"
          >
            {t('report.sticky.cta')}
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
