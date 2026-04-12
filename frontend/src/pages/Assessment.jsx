import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  startAssessment, fetchNextQuestion, submitAnswer,
  completeAssessment, resetAssessment,
  selectAssessment, selectCurrentQuestion, selectAssessmentLoading, selectIsCompleted, selectReportId
} from '../store/slices/assessmentSlice'
import toast from 'react-hot-toast'
import { leadApi } from '../services/api'

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

  const assessment = useSelector(selectAssessment)
  const currentQuestion = useSelector(selectCurrentQuestion)
  const isLoading = useSelector(selectAssessmentLoading)
  const isCompleted = useSelector(selectIsCompleted)
  const reportId = useSelector(selectReportId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)

  useEffect(() => {
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
  }, [dispatch, plan])

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
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div
            className="bg-brand-red h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

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
