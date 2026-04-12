import { useEffect, useState } from 'react'
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

// ── 3 static hook questions shown to guests before requiring any login ────────
const GUEST_QUESTIONS = [
  {
    id: 'g1',
    category: 'INTEREST',
    questionText: 'Even after a long day, which activity makes you feel energized?',
    questionType: 'MCQ',
    options: [
      { value: 'a', label: 'Solving problems or puzzles' },
      { value: 'b', label: 'Creating something — art, music, or writing' },
      { value: 'c', label: 'Talking to people, leading or making plans' },
      { value: 'd', label: 'Learning how things work through experiments' },
    ],
  },
  {
    id: 'g2',
    category: 'ASPIRATION',
    questionText: 'When you imagine your future, which dream feels most like yours?',
    questionType: 'MCQ',
    options: [
      { value: 'a', label: 'Being a top professional (Doctor, Engineer, CA)' },
      { value: 'b', label: 'Starting or running my own business' },
      { value: 'c', label: 'Serving the nation — government, law, or social work' },
      { value: 'd', label: 'Creating impact through design, content, or innovation' },
    ],
  },
  {
    id: 'g3',
    category: 'APTITUDE',
    questionText: 'Which school subject do you secretly enjoy the most?',
    questionType: 'MCQ',
    options: [
      { value: 'a', label: 'Maths or Science — numbers and logic excite me' },
      { value: 'b', label: 'Commerce or Economics — I think about money and business' },
      { value: 'c', label: 'History, Civics, or Geography — society fascinates me' },
      { value: 'd', label: 'Arts, Literature, or Languages — expression is my thing' },
    ],
  },
]

// ── Motivational copy by progress % ──────────────────────────────────────────
function getMotivationalText(percent) {
  if (percent === 0) return 'Let\'s discover your ideal career path 🎯'
  if (percent < 30) return 'Great start! Your profile is taking shape...'
  if (percent < 60) return `You're ${percent}% done. Few more questions to unlock your career path 🎯`
  if (percent < 80) return 'Almost there! The AI is learning a lot about you 🧠'
  return 'Final stretch! Your personalised report is nearly ready 🚀'
}

const QuestionCard = ({ question, onAnswer, isSubmitting }) => {
  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState(null)

  const handleSubmit = () => {
    if (question.questionType === 'OPEN_TEXT') {
      if (!answer.trim()) return toast.error('Please enter an answer')
      onAnswer({ answerText: answer })
    } else {
      if (!selectedOption) return toast.error('Please select an option')
      onAnswer({ answerText: selectedOption.label, answerValue: selectedOption })
    }
    setAnswer('')
    setSelectedOption(null)
  }

  return (
    <div className="animate-slide-up">
      <div className="text-xs font-bold text-brand-red tracking-widest uppercase mb-1">
        {question.category?.replace(/_/g, ' ')}
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
          placeholder="Type your answer here..."
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
            Saving...
          </>
        ) : 'Submit Answer →'}
      </button>
    </div>
  )
}

export default function Assessment() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const plan = searchParams.get('plan') || 'FREE'
  const intent = searchParams.get('intent') || ''

  const isAuthenticated = useSelector(selectIsAuthenticated)
  const assessment = useSelector(selectAssessment)
  const currentQuestion = useSelector(selectCurrentQuestion)
  const isLoading = useSelector(selectAssessmentLoading)
  const isCompleted = useSelector(selectIsCompleted)
  const reportId = useSelector(selectReportId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)

  // ── Guest mode state ──────────────────────────────────────────────────────
  const [guestStep, setGuestStep] = useState(0)           // 0..2 = guest questions
  const [guestAnswers, setGuestAnswers] = useState([])
  const [guestSelected, setGuestSelected] = useState(null)
  const [showLeadCapture, setShowLeadCapture] = useState(false)

  // If user is not authenticated, run the guest 3-question preview
  const isGuestMode = !isAuthenticated

  const handleGuestAnswer = () => {
    if (!guestSelected) return toast.error('Please select an option')
    const newAnswers = [...guestAnswers, { questionId: GUEST_QUESTIONS[guestStep].id, answer: guestSelected }]
    setGuestAnswers(newAnswers)
    setGuestSelected(null)
    if (guestStep < GUEST_QUESTIONS.length - 1) {
      setGuestStep((s) => s + 1)
    } else {
      // All 3 guest questions done → show lead capture
      sessionStorage.setItem('cg_guest_answers', JSON.stringify(newAnswers))
      setShowLeadCapture(true)
    }
  }

  const handleLeadCaptured = (leadId) => {
    // Navigate to register; after registration the full assessment starts
    navigate(`/register?leadId=${leadId}&plan=${plan.toLowerCase()}&next=assessment`)
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
    if (isCompleted && reportId) {
      setTimeout(() => navigate(`/reports/${reportId}`), 2000)
    }
  }, [isCompleted, reportId])

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
    const guestProgress = Math.round((guestStep / (GUEST_QUESTIONS.length + 7)) * 100) // out of ~10 total

    if (showLeadCapture) {
      return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
          <div className="max-w-lg mx-auto">
            <div className="card shadow-xl">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-xl font-bold text-brand-dark">You're doing great!</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Almost there — enter your details to unlock your personalised career report
                </p>
              </div>
              {/* Compact progress indicator */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div className="bg-brand-red h-2 rounded-full transition-all" style={{ width: '30%' }} />
              </div>
              <p className="text-xs text-center text-gray-500 mb-6">
                ✅ 3 questions done &nbsp;·&nbsp; 7 more to complete your full report
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

    const gq = GUEST_QUESTIONS[guestStep]
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-bold text-brand-dark">AI Career Assessment</h1>
              <p className="text-xs text-gray-500">🆓 Free · Question {guestStep + 1} of 10</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-red">{guestProgress}%</div>
              <div className="text-xs text-gray-500">Complete</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div className="bg-brand-red h-2 rounded-full transition-all duration-500" style={{ width: `${guestProgress}%` }} />
          </div>
          <p className="text-xs text-brand-red font-medium mb-6">{getMotivationalText(guestProgress)}</p>

          <div className="card shadow-xl">
            <div className="text-xs font-bold text-brand-red tracking-widest uppercase mb-1">
              {gq.category.replace(/_/g, ' ')}
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
              {guestStep < GUEST_QUESTIONS.length - 1 ? 'Next Question →' : 'See My Results 🎯'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            🔒 Your answers are private and used only for your career report.
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
          <h2 className="text-2xl font-bold text-brand-dark mb-2">Assessment Complete!</h2>
          <p className="text-gray-500 mb-2">Your AI career report is being generated...</p>
          <div className="flex justify-center mt-4">
            <svg className="animate-spin w-8 h-8 text-brand-red" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 mt-3">Redirecting to your report...</p>
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
            <h1 className="text-lg font-bold text-brand-dark">AI Career Assessment</h1>
            <p className="text-xs text-gray-500">
              {plan === 'PAID' ? '💎 Premium' : '🆓 Free'} Plan ·{' '}
              {answeredCount}/{assessment?.totalQuestions || 0} answered
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-red">{progressPercent}%</div>
            <div className="text-xs text-gray-500">Complete</div>
          </div>
        </div>

        {intent === 'paid' && (
          <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            <span className="font-semibold">Premium path selected:</span> complete this assessment first, then unlock your full premium report at checkout.
          </div>
        )}

        {/* Progress */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-brand-red h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-brand-red font-medium mb-6">{getMotivationalText(progressPercent)}</p>

        {/* Question Card */}
        <div className="card shadow-xl">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500 text-sm">🤖 AI is generating your next question...</p>
            </div>
          ) : currentQuestion ? (
            <QuestionCard
              question={currentQuestion}
              onAnswer={handleAnswer}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Loading question...</p>
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
              Enough answers – Generate my report now
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          🔒 Your answers are private and used only for your career report.
        </p>
      </div>
    </div>
  )
}
