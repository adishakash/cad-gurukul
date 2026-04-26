import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  startAssessment, fetchNextQuestion, submitAnswer,
  completeAssessment, resetAssessment,
  selectAssessment, selectCurrentQuestion, selectAssessmentLoading, selectIsCompleted, selectReportId
} from '../store/slices/assessmentSlice'
import { selectIsAuthenticated } from '../store/slices/authSlice'
import toast from 'react-hot-toast'
import { leadApi } from '../services/api'
import LeadCaptureForm from '../components/LeadCaptureForm'
import { useTranslation } from 'react-i18next'

const buildGuestQuestions = (t) => ([
  {
    id: 'g1',
    category: 'INTERESTS',
    questionText: t('assessment.guestQuestions.q1.text'),
    questionType: 'MCQ',
    options: [
      { value: 'a', label: t('assessment.guestQuestions.q1.options.a') },
      { value: 'b', label: t('assessment.guestQuestions.q1.options.b') },
      { value: 'c', label: t('assessment.guestQuestions.q1.options.c') },
      { value: 'd', label: t('assessment.guestQuestions.q1.options.d') },
    ],
  },
  {
    id: 'g2',
    category: 'ASPIRATION',
    questionText: t('assessment.guestQuestions.q2.text'),
    questionType: 'MCQ',
    options: [
      { value: 'a', label: t('assessment.guestQuestions.q2.options.a') },
      { value: 'b', label: t('assessment.guestQuestions.q2.options.b') },
      { value: 'c', label: t('assessment.guestQuestions.q2.options.c') },
      { value: 'd', label: t('assessment.guestQuestions.q2.options.d') },
    ],
  },
  {
    id: 'g3',
    category: 'APTITUDE',
    questionText: t('assessment.guestQuestions.q3.text'),
    questionType: 'MCQ',
    options: [
      { value: 'a', label: t('assessment.guestQuestions.q3.options.a') },
      { value: 'b', label: t('assessment.guestQuestions.q3.options.b') },
      { value: 'c', label: t('assessment.guestQuestions.q3.options.c') },
      { value: 'd', label: t('assessment.guestQuestions.q3.options.d') },
    ],
  },
])

const getMotivationalText = (t, percent) => {
  if (percent === 0) return t('assessment.motivational.start')
  if (percent < 30) return t('assessment.motivational.early')
  if (percent < 60) return t('assessment.motivational.mid', { percent })
  if (percent < 80) return t('assessment.motivational.late')
  return t('assessment.motivational.final')
}

const getCategoryLabel = (t, category) => {
  if (!category) return ''
  return t(`assessment.categories.${category}`, { defaultValue: category.replace(/_/g, ' ') })
}

const QuestionCard = ({ question, onAnswer, isSubmitting }) => {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState(null)

  const handleSubmit = () => {
    if (question.questionType === 'OPEN_TEXT') {
      if (!answer.trim()) return toast.error(t('assessment.errors.enterAnswer'))
      onAnswer({ answerText: answer })
    } else {
      if (!selectedOption) return toast.error(t('assessment.errors.selectOption'))
      onAnswer({ answerText: selectedOption.label, answerValue: selectedOption })
    }
    setAnswer('')
    setSelectedOption(null)
  }

  return (
    <div className="animate-slide-up">
      <div className="text-xs font-bold text-brand-red tracking-widest uppercase mb-1">
        {getCategoryLabel(t, question.category)}
      </div>
      <h2 className="text-xl font-bold text-brand-dark mb-6 leading-relaxed">{question.questionText}</h2>

      {['MCQ', 'RATING_SCALE', 'YES_NO', 'RANKING'].includes(question.questionType) && question.options && (
        <div className="space-y-3 mb-6">
          {question.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedOption(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                selectedOption?.value === opt.value
                  ? 'border-brand-red bg-orange-50 text-brand-dark font-medium'
                  : 'border-gray-200 bg-white hover:border-brand-red/50 text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {question.questionType === 'OPEN_TEXT' && (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="input-field mb-6"
          rows={4}
          placeholder={t('assessment.placeholders.openText')}
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t('assessment.actions.saving')}
          </>
        ) : t('assessment.actions.submit')}
      </button>
    </div>
  )
}

export default function Assessment() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const plan = (searchParams.get('plan') || 'FREE').toUpperCase()
  const intent = searchParams.get('intent') || ''

  const isAuthenticated = useSelector(selectIsAuthenticated)
  const assessment = useSelector(selectAssessment)
  const currentQuestion = useSelector(selectCurrentQuestion)
  const isLoading = useSelector(selectAssessmentLoading)
  const isCompleted = useSelector(selectIsCompleted)
  const reportId = useSelector(selectReportId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const normalizedAccessLevel = String(assessment?.accessLevel || plan || '').toUpperCase()
  const isPaidAssessment = normalizedAccessLevel === 'PAID'
  const redirectingLabel = isPaidAssessment
    ? t('assessment.status.redirectingDashboard')
    : t('assessment.status.redirecting')

  // ── Guest mode state ──────────────────────────────────────────────────────
  const [guestStep, setGuestStep] = useState(0)           // 0..2 = guest questions
  const [guestAnswers, setGuestAnswers] = useState([])
  const [guestSelected, setGuestSelected] = useState(null)
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const guestQuestions = useMemo(() => buildGuestQuestions(t), [t])

  // If user is not authenticated, run the guest 3-question preview
  const isGuestMode = !isAuthenticated

  const handleGuestAnswer = () => {
    if (!guestSelected) return toast.error(t('assessment.errors.selectOption'))
    const newAnswers = [...guestAnswers, { questionId: guestQuestions[guestStep].id, answer: guestSelected }]
    setGuestAnswers(newAnswers)
    setGuestSelected(null)
    if (guestStep < guestQuestions.length - 1) {
      setGuestStep((s) => s + 1)
    } else {
      // All 3 guest questions done → show lead capture
      sessionStorage.setItem('cg_guest_answers', JSON.stringify(newAnswers))
      setShowLeadCapture(true)
    }
  }

  const handleLeadCaptured = (leadId) => {
    const params = new URLSearchParams({
      plan: plan.toLowerCase(),
      next: 'assessment',
    })

    if (leadId) params.set('leadId', leadId)
    if (intent) params.set('intent', intent)

    // Navigate to register; after registration the full assessment starts
    navigate(`/register?${params.toString()}`)
  }

  // ── Authenticated assessment flow ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return // guest mode — skip real assessment init
    dispatch(resetAssessment())
    dispatch(startAssessment(plan)).then((action) => {
      if (startAssessment.fulfilled.match(action)) {
        const seededCount = Number(action.payload?.currentStep || 0)
        if (!Number.isNaN(seededCount) && seededCount > 0) {
          setAnsweredCount(seededCount)
        }
        leadApi.update({ status: 'assessment_started' }).catch(() => {})
        dispatch(fetchNextQuestion(action.payload.id))
      }
    })
  }, [dispatch, plan, isAuthenticated])

  useEffect(() => {
    if (!isCompleted || !reportId) return
    const destination = isPaidAssessment ? '/dashboard' : `/reports/${reportId}`
    const timeout = setTimeout(() => navigate(destination), 2000)
    return () => clearTimeout(timeout)
  }, [isCompleted, reportId, isPaidAssessment, navigate])

  const handleAnswer = async (answerData) => {
    if (!assessment?.id || !currentQuestion?.id) return
    setIsSubmitting(true)

    const answerResult = await dispatch(submitAnswer({
      assessmentId: assessment.id,
      answerData: { questionId: currentQuestion.id, ...answerData },
    }))

    if (submitAnswer.fulfilled.match(answerResult)) {
      const newAnsweredCount = answeredCount + 1
      setAnsweredCount(newAnsweredCount)
      if (newAnsweredCount >= 1) {
        leadApi.update({ status: 'assessment_in_progress' }).catch(() => {})
      }

      if (newAnsweredCount >= assessment.totalQuestions) {
        dispatch(completeAssessment(assessment.id))
      } else {
        dispatch(fetchNextQuestion(assessment.id))
      }
    }
    setIsSubmitting(false)
  }

  const progressPercent = assessment ? Math.round((answeredCount / assessment.totalQuestions) * 100) : 0

  // ── GUEST MODE RENDER ──────────────────────────────────────────────────────
  if (isGuestMode) {
    const guestProgress = Math.round((guestStep / (guestQuestions.length + 7)) * 100) // out of ~10 total

    if (showLeadCapture) {
      return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
          <div className="max-w-lg mx-auto">
            <div className="card shadow-xl">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-xl font-bold text-brand-dark">{t('assessment.guest.captureTitle')}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {t('assessment.guest.captureSubtitle')}
                </p>
              </div>
              {/* Compact progress indicator */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div className="bg-brand-red h-2 rounded-full transition-all" style={{ width: '30%' }} />
              </div>
              <p className="text-xs text-center text-gray-500 mb-6">
                {t('assessment.guest.captureProgress')}
              </p>
              <LeadCaptureForm
                selectedPlan={plan.toLowerCase()}
                midAssessment
                onSuccess={handleLeadCaptured}
              />
            </div>
          </div>
        </div>
      )
    }

    const gq = guestQuestions[guestStep]
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-bold text-brand-dark">{t('assessment.title')}</h1>
              <p className="text-xs text-gray-500">
                🆓 {t('assessment.plan.free')} · {t('assessment.progress.questionOf', { current: guestStep + 1, total: 10 })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-red">{guestProgress}%</div>
              <div className="text-xs text-gray-500">{t('assessment.progress.complete')}</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div className="bg-brand-red h-2 rounded-full transition-all duration-500" style={{ width: `${guestProgress}%` }} />
          </div>
          <p className="text-xs text-brand-red font-medium mb-6">{getMotivationalText(t, guestProgress)}</p>

          <div className="card shadow-xl">
            <div className="text-xs font-bold text-brand-red tracking-widest uppercase mb-1">
              {getCategoryLabel(t, gq.category)}
            </div>
            <h2 className="text-xl font-bold text-brand-dark mb-6 leading-relaxed">{gq.questionText}</h2>
            <div className="space-y-3 mb-6">
              {gq.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGuestSelected(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    guestSelected === opt.value
                      ? 'border-brand-red bg-orange-50 text-brand-dark font-medium'
                      : 'border-gray-200 bg-white hover:border-brand-red/50 text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleGuestAnswer}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {guestStep < guestQuestions.length - 1
                ? t('assessment.guest.nextQuestion')
                : t('assessment.guest.seeResults')}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            {t('assessment.privacyNote')}
          </p>
        </div>
      </div>
    )
  }
  // ── END GUEST MODE ──────────────────────────────────────────────────────────

  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center card max-w-md mx-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-brand-dark mb-2">{t('assessment.status.completeTitle')}</h2>
          <p className="text-gray-500 mb-2">{t('assessment.status.completeBody')}</p>
          <div className="flex justify-center mt-4">
            <svg className="animate-spin w-8 h-8 text-brand-red" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 mt-3">{redirectingLabel}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-brand-dark">{t('assessment.title')}</h1>
            <p className="text-xs text-gray-500">
              {plan === 'PAID' ? `💎 ${t('assessment.plan.premium')}` : `🆓 ${t('assessment.plan.free')}`} {t('assessment.plan.label')} ·{' '}
              {t('assessment.progress.answered', { count: answeredCount, total: assessment?.totalQuestions || 0 })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-red">{progressPercent}%</div>
            <div className="text-xs text-gray-500">{t('assessment.progress.complete')}</div>
          </div>
        </div>

        {intent === 'paid' && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            <span className="font-semibold">{t('assessment.premiumPath.title')}</span> {t('assessment.premiumPath.body')}
          </div>
        )}

        {/* Progress */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-brand-red h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-brand-red font-medium mb-6">{getMotivationalText(t, progressPercent)}</p>

        {/* Question Card */}
        <div className="card shadow-xl">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500 text-sm">{t('assessment.status.aiGenerating')}</p>
            </div>
          ) : currentQuestion ? (
            <QuestionCard
              question={currentQuestion}
              onAnswer={handleAnswer}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">{t('assessment.status.loadingQuestion')}</p>
            </div>
          )}
        </div>

        {/* Complete early option */}
        {answeredCount >= Math.ceil((assessment?.totalQuestions || 10) * 0.7) && !isCompleted && (
          <div className="mt-6 text-center">
            <button
              onClick={() => dispatch(completeAssessment(assessment.id))}
              className="text-sm text-gray-500 hover:text-brand-red underline transition-colors"
            >
              {t('assessment.actions.generateReportNow')}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('assessment.privacyNote')}
        </p>
      </div>
    </div>
  )
}
