import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectUser, clearCredentials } from '../store/slices/authSlice'
import api, { leadApi, consultationApi, authApi } from '../services/api'
import toast from 'react-hot-toast'

// ── Shared helpers ────────────────────────────────────────────────────────────
const SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
}

function fmt(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Generic step row ─────────────────────────────────────────────────────────
function TimelineStep({ done, current, icon, label, description, children }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
      current ? 'bg-orange-50 border-orange-300' : done ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 opacity-40'
    }`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
        current ? 'border-orange-500 text-orange-700 bg-white' : done ? 'border-green-500 text-green-700 bg-white' : 'border-gray-300 text-gray-400 bg-white'
      }`}>
        {done ? '✓' : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${done ? 'text-brand-dark' : 'text-gray-400'}`}>{label}</div>
        <div className={`text-xs mt-0.5 ${done ? 'text-gray-500' : 'text-gray-300'}`}>{description}</div>
        {children}
      </div>
    </div>
  )
}

// ── ₹499 Standard Plan Timeline ──────────────────────────────────────────────
function StandardTimeline({ leadStatus, paidReport, generatingReport }) {
  const reportReady = Boolean(paidReport)
  const generating  = Boolean(generatingReport) || ['paid', 'premium_report_generating'].includes(leadStatus)
  const reportDone  = reportReady || leadStatus === 'premium_report_ready'

  const steps = [
    {
      key:    'purchased',
      label:  'Full Report Plan — ₹499',
      icon:   '💳',
      desc:   'Payment confirmed. Lifetime access to your detailed career report.',
      done:   true,  // always done when this timeline shows
    },
    {
      key:    'generating',
      label:  generating ? 'AI Analysis Underway…' : 'Report Generation',
      icon:   '🤖',
      desc:   generating ? 'Our AI is building your personalised career blueprint.' : 'Report will be generated after payment.',
      done:   reportDone || generating,
      current: generating && !reportDone,
    },
    {
      key:    'report_ready',
      label:  'Full Report Ready',
      icon:   '📄',
      desc:   reportReady ? `Ready on ${fmt(paidReport.generatedAt || paidReport.createdAt)}` : 'Your detailed report will appear here.',
      done:   reportReady,
    },
    {
      key:    'pdf',
      label:  'PDF Download Available',
      icon:   '⬇️',
      desc:   'Download your complete career blueprint as a PDF anytime.',
      done:   reportReady,
    },
  ]

  return (
    <div className="card mb-6 border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">💎</span>
        <div>
          <h3 className="font-bold text-brand-dark">Your Full Report — Journey</h3>
          <p className="text-xs text-gray-500">₹499 plan · {paidReport ? 'Report ready' : generating ? 'Generating…' : 'Processing'}</p>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((s, idx) => (
          <TimelineStep key={s.key} done={s.done} current={s.current} icon={s.icon} label={s.label} description={s.desc}>
            {s.key === 'generating' && generating && !reportDone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-600">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Usually takes 1–3 minutes. Refresh the page to check.
              </div>
            )}
            {s.key === 'report_ready' && paidReport && (
              <Link to={`/reports/${paidReport.id}`} className="inline-block mt-1 text-xs text-brand-red font-semibold hover:underline">
                Open Report →
              </Link>
            )}
          </TimelineStep>
        ))}
      </div>
    </div>
  )
}

// ── ₹1,999 Premium Plan Timeline ─────────────────────────────────────────────
function PremiumTimeline({ leadStatus, paidReport, generatingReport }) {
  const generating = Boolean(generatingReport) || leadStatus === 'premium_report_generating'
  const reportReady = Boolean(paidReport)

  const steps = [
    {
      key:    'purchased',
      label:  'Premium AI Report Plan — ₹1,999',
      icon:   '🚀',
      desc:   'Payment confirmed. Deep AI analysis of your career fit, roadmap, and subject strategy.',
      done:   true,
    },
    {
      key:    'generating',
      label:  generating ? 'Deep AI Analysis Running…' : 'Premium AI Analysis',
      icon:   '🤖',
      desc:   generating
        ? 'Building your year-by-year roadmap, subject strategy, and scholarship list.'
        : 'Premium report generation queued.',
      done:   reportReady || generating,
      current: generating && !reportReady,
    },
    {
      key:    'report_ready',
      label:  'Premium Report Ready',
      icon:   '📊',
      desc:   reportReady ? `Ready on ${fmt(paidReport.generatedAt || paidReport.createdAt)}` : '7+ career paths · roadmap · subject strategy · scholarship list',
      done:   reportReady,
    },
    {
      key:    'pdf',
      label:  'Full Blueprint PDF Available',
      icon:   '⬇️',
      desc:   'Download your complete premium career blueprint — share with parents & teachers.',
      done:   reportReady,
    },
  ]

  return (
    <div className="card mb-6 border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🚀</span>
        <div>
          <h3 className="font-bold text-brand-dark">Your Premium AI Report — Journey</h3>
          <p className="text-xs text-gray-500">₹1,999 plan · {paidReport ? 'Report ready' : generating ? 'Generating…' : 'Processing'}</p>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <TimelineStep key={s.key} done={s.done} current={s.current} icon={s.icon} label={s.label} description={s.desc}>
            {s.key === 'generating' && generating && !reportReady && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-600">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Premium analysis takes 2–5 minutes. Refresh to check.
              </div>
            )}
            {s.key === 'report_ready' && paidReport && (
              <Link to={`/reports/${paidReport.id}`} className="inline-block mt-1 text-xs text-brand-red font-semibold hover:underline">
                Open Premium Report →
              </Link>
            )}
          </TimelineStep>
        ))}
      </div>
    </div>
  )
}

// ── ₹9,999 Consultation Timeline ─────────────────────────────────────────────
const CONSULTATION_STEPS = [
  { key: 'purchased',              label: 'Booking Confirmed',         icon: '💳', desc: 'Payment captured — ₹9,999 consultation booked' },
  { key: 'slot_mail_sent',         label: 'Slot-Selection Email Sent', icon: '📧', desc: 'Email with slot-selection link sent to your inbox' },
  { key: 'slot_selected',          label: 'Slot Selected',             icon: '📅', desc: 'You chose a preferred session window' },
  { key: 'meeting_scheduled',      label: 'Meeting Scheduled',         icon: '📆', desc: 'Team confirmed exact date & meeting link' },
  { key: 'meeting_completed',      label: 'Session Completed',         icon: '🎤', desc: '45-min 1:1 Career Blueprint Session done' },
  { key: 'counselling_report_ready', label: 'Counselling Report Ready', icon: '📄', desc: 'Your personalised counselling report is available' },
]

// Derive current step index from booking.status
const BOOKING_STATUS_TO_STEP = {
  slot_mail_sent:           1,   // step 1 (email sent)
  slot_selected:            2,
  meeting_scheduled:        3,
  meeting_completed:        4,
  counselling_report_ready: 5,
}

function ConsultationTimeline({ booking, onResend }) {
  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState(null) // { ok, message, nextResendAt }
  const [recovering, setRecovering] = useState(false)
  const [recoverResult, setRecoverResult] = useState(null) // { ok, message }

  const currentStepIdx = booking ? (BOOKING_STATUS_TO_STEP[booking.status] ?? 1) : -1

  // Cooldown state
  const lastSentAt    = booking ? (booking.lastResendAt || booking.createdAt) : null
  const nextResendAt  = resendResult?.nextResendAt
    || (lastSentAt ? new Date(new Date(lastSentAt).getTime() + 30 * 60 * 1000) : null)
  const cooldownOver  = !nextResendAt || Date.now() > new Date(nextResendAt).getTime()
  const minutesLeft   = nextResendAt && !cooldownOver
    ? Math.ceil((new Date(nextResendAt).getTime() - Date.now()) / 60000)
    : 0

  const handleResend = async () => {
    setResending(true)
    setResendResult(null)
    try {
      const res = await consultationApi.resend()
      const data = res.data.data || {}
      setResendResult({
        ok:          true,
        message:     res.data.message || 'Email resent successfully.',
        nextResendAt: data.nextResendAt,
      })
      toast.success('Slot-selection email resent! Check your inbox.')
      if (onResend) onResend()
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to resend. Please try again.'
      const nextAt = err?.response?.data?.error?.details?.nextResendAt
      setResendResult({ ok: false, message: msg, nextResendAt: nextAt })
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  const handleRecover = async () => {
    setRecovering(true)
    setRecoverResult(null)
    try {
      await consultationApi.recover()
      setRecoverResult({ ok: true, message: 'Booking created! Slot-selection email sent to your inbox.' })
      toast.success('Success! Check your email for the slot-selection link.')
      if (onResend) onResend() // re-fetches booking
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Recovery failed. Please contact support.'
      setRecoverResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setRecovering(false)
    }
  }

  // ── Null booking state: payment captured but booking not yet created ────────
  if (!booking) {
    return (
      <div className="card mb-6 border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📞</span>
          <div>
            <h3 className="font-bold text-brand-dark">Your 1:1 Career Session</h3>
            <p className="text-xs text-gray-500">₹9,999 consultation · Booking setup in progress</p>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
          <div className="font-semibold text-yellow-800 text-sm mb-1">⏳ Setting Up Your Booking</div>
          <p className="text-yellow-700 text-xs mb-3">
            Your payment was received but your booking record is still being created. This usually resolves in a few seconds — try refreshing the page.
          </p>
          <p className="text-yellow-700 text-xs mb-4">
            If this persists, click <strong>"Send Slot Email"</strong> below and we'll set up your booking immediately.
          </p>

          {recoverResult ? (
            <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${recoverResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {recoverResult.ok ? '✅ ' : '❌ '}{recoverResult.message}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-yellow-500 text-yellow-700 bg-white hover:bg-yellow-50 transition"
            >
              🔄 Refresh Page
            </button>
            <button
              onClick={handleRecover}
              disabled={recovering || recoverResult?.ok}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                recovering || recoverResult?.ok
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600'
              }`}
            >
              {recovering ? '⏳ Setting up…' : recoverResult?.ok ? '✅ Done' : '📧 Send Slot Email'}
            </button>
            <a
              href="mailto:support@cadgurukul.com?subject=Consultation%20Booking%20Issue"
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition text-center"
            >
              📩 Contact Support
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-6 border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📞</span>
          <div>
            <h3 className="font-bold text-brand-dark">Your 1:1 Career Session — Progress</h3>
            <p className="text-xs text-gray-500">₹9,999 plan · {booking.counsellorName}</p>
          </div>
        </div>
        {/* Status chip */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
          booking.status === 'counselling_report_ready' ? 'bg-green-100 text-green-700 border-green-300' :
          booking.status === 'meeting_completed'        ? 'bg-blue-100 text-blue-700 border-blue-300' :
          booking.status === 'meeting_scheduled'        ? 'bg-purple-100 text-purple-700 border-purple-300' :
          booking.status === 'slot_selected'            ? 'bg-teal-100 text-teal-700 border-teal-300' :
                                                          'bg-yellow-100 text-yellow-700 border-yellow-300'
        }`}>
          {booking.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="space-y-2">
        {CONSULTATION_STEPS.map((step, idx) => {
          const done    = idx <= currentStepIdx
          const current = idx === currentStepIdx
          return (
            <TimelineStep key={step.key} done={done} current={current} icon={step.icon} label={step.label} description={step.desc}>
              {/* Slot email step: show sent-at + resend button */}
              {step.key === 'slot_mail_sent' && done && (
                <div className="mt-1 text-xs text-gray-500">
                  First sent: {fmt(booking.createdAt)}
                  {booking.resendCount > 0 && ` · Resent ${booking.resendCount}×`}
                  {booking.lastResendAt && ` (last: ${fmt(booking.lastResendAt)})`}
                </div>
              )}

              {/* Slot selected detail */}
              {step.key === 'slot_selected' && booking.selectedSlot && (
                <div className="mt-1 text-xs text-teal-700 font-semibold">
                  📍 {SLOT_LABELS[booking.selectedSlot] || booking.selectedSlot}
                  {booking.slotSelectedAt && ` · ${fmt(booking.slotSelectedAt)}`}
                </div>
              )}

              {/* Meeting detail */}
              {step.key === 'meeting_scheduled' && booking.meetingDate && (
                <div className="mt-1 space-y-0.5">
                  <div className="text-xs text-purple-700 font-semibold">
                    📆 {fmt(booking.meetingDate)}
                  </div>
                  {booking.meetingLink && (
                    <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-red underline block">
                      Join Meeting →
                    </a>
                  )}
                </div>
              )}
            </TimelineStep>
          )
        })}
      </div>

      {/* ── Action Required: Slot not yet selected ── */}
      {booking.status === 'slot_mail_sent' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
          <div className="font-semibold text-yellow-800 text-sm mb-1">⏰ Action Required — Select Your Session Slot</div>
          <p className="text-yellow-700 text-xs mb-3">
            A slot-selection link was sent to your registered email ({booking.resendCount > 0 ? `resent ${booking.resendCount} time${booking.resendCount !== 1 ? 's' : ''}` : 'initial send'}). Click the link in the email to choose your preferred session time.
          </p>

          {/* Resend section */}
          <div className="border-t border-yellow-200 pt-3">
            <div className="text-xs text-yellow-700 font-semibold mb-2">Didn't receive the email?</div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <button
                onClick={handleResend}
                disabled={resending || !cooldownOver}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                  resending || !cooldownOver
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-yellow-600 text-white border-yellow-700 hover:bg-yellow-700'
                }`}
              >
                {resending ? '⏳ Sending…' : cooldownOver ? '📧 Resend Slot-Selection Email' : `⏳ Resend in ${minutesLeft} min`}
              </button>
              <span className="text-xs text-gray-500">
                Also check spam/junk folder · 
                <a href="mailto:support@cadgurukul.com" className="text-brand-red ml-1 underline">Contact support</a>
              </span>
            </div>
            {resendResult && (
              <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${resendResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {resendResult.ok ? '✅ ' : '❌ '}{resendResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slot selected — waiting for team to schedule */}
      {booking.status === 'slot_selected' && (
        <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800">
          <strong>✅ Slot confirmed!</strong> Our team will send you the exact meeting date and Zoom/Meet link within <strong>24 hours</strong>. Check your email inbox.
        </div>
      )}

      {/* Meeting scheduled — action link */}
      {booking.status === 'meeting_scheduled' && booking.meetingLink && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="text-xs text-purple-800 font-semibold mb-2">Your meeting is confirmed!</div>
          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-purple-700 transition">
            Join Meeting →
          </a>
        </div>
      )}

      {/* Counsellor card */}
      <div className="mt-4 pt-4 border-t border-orange-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl shrink-0">👨‍💼</div>
        <div>
          <div className="font-bold text-sm text-brand-dark">{booking.counsellorName || 'Adish Gupta'}</div>
          <div className="text-xs text-gray-500">{booking.counsellorExpertise || 'Career Guidance Specialist'}</div>
          <a href={`mailto:${booking.counsellorContact || 'adish@cadgurukul.com'}`} className="text-xs text-brand-red">
            {booking.counsellorContact || 'adish@cadgurukul.com'}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Generic funnel (free users / partially-paid flow) ────────────────────────
const FUNNEL_STEPS = [
  { key: 'new_lead',             label: 'Lead Created',         icon: '✅', includes: ['new_lead', 'onboarding_started', 'plan_selected'] },
  { key: 'assessment_started',   label: 'Assessment Started',   icon: '📝', includes: ['assessment_started', 'assessment_in_progress'] },
  { key: 'assessment_completed', label: 'Assessment Done',      icon: '🎯', includes: ['assessment_completed'] },
  { key: 'free_report_ready',    label: 'Free Report Ready',    icon: '📊', includes: ['free_report_ready'] },
  { key: 'paid',                 label: 'Payment Complete',     icon: '💳', includes: ['payment_pending', 'paid', 'premium_report_generating'] },
  { key: 'premium_report_ready', label: 'Report Ready',         icon: '📄', includes: ['premium_report_ready', 'counselling_interested', 'closed'] },
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
      <p className="mt-2 text-xs text-gray-500">Current: {status?.replace(/_/g, ' ') || 'new lead'}</p>
    </div>
  )
}

// ── Profile row helper ────────────────────────────────────────────────────────
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
  const dispatch = useDispatch()
  const [profile, setProfile]   = useState(null)
  const [reports, setReports]   = useState([])
  const [lead, setLead]         = useState(null)
  const [consultationBooking, setConsultationBooking] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Delete-account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const DELETE_PHRASE = 'DELETE MY ACCOUNT'

  const refreshBooking = useCallback(async () => {
    try {
      const res = await consultationApi.getMyBooking()
      setConsultationBooking(res.data.data)
    } catch {
      // non-fatal — booking shown stale is fine
    }
  }, [])

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== DELETE_PHRASE || !deletePassword) return
    setDeleting(true)
    try {
      await authApi.deleteAccount(deletePassword)
      toast.success('Account deleted. Goodbye!')
      dispatch(clearCredentials())
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete account. Please try again.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, reportsRes, leadRes, consultationRes] = await Promise.all([
          api.get('/students/me').catch(() => ({ data: { data: null } })),
          api.get('/reports/my').catch(() => ({ data: { data: [] } })),
          leadApi.getMe().catch(() => ({ data: { data: null } })),
          consultationApi.getMyBooking().catch(() => ({ data: { data: null } })),
        ])
        setProfile(profileRes.data.data)
        setReports(reportsRes.data.data || [])
        setLead(leadRes.data.data)
        setConsultationBooking(consultationRes.data.data)
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

  // ── Payment detection ─────────────────────────────────────────────────────
  // IMPORTANT: Lead.planType has a DB-level DEFAULT 'standard', meaning every lead
  // record — including free users who never paid — has planType = 'standard'.
  // We must use lead.status as the primary payment gate; only use planType to
  // distinguish *which* plan was purchased (for users who have actually paid).
  const PAID_STATUSES = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed']
  const leadStatus  = lead?.status || 'new_lead'
  const userHasPaid = PAID_STATUSES.includes(leadStatus)
  const planType    = userHasPaid ? (lead?.planType || 'standard') : 'free'

  const hasConsultation   = planType === 'consultation'
  const hasPremium        = planType === 'premium' || hasConsultation
  const hasStandard       = planType === 'standard'
  const hasAnyPaidPlan    = userHasPaid   // simplest, most reliable

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
        {/* ── Plan-specific timeline ─────────────────────────────────────────── */}
        {hasConsultation && (
          <ConsultationTimeline booking={consultationBooking} onResend={refreshBooking} />
        )}
        {hasPremium && !hasConsultation && (
          <PremiumTimeline
            leadStatus={leadStatus}
            paidReport={paidReport}
            generatingReport={generatingReports[0]}
          />
        )}
        {hasStandard && !hasPremium && !hasConsultation && (
          <StandardTimeline
            leadStatus={leadStatus}
            paidReport={paidReport}
            generatingReport={generatingReports[0]}
          />
        )}
        {!userHasPaid && lead && <FunnelProgress status={lead.status} />}

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

        {/* Standard ₹499 → Upsell ₹1,999 (only when user has standard and a paid report) */}
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

        {/* Premium ₹1,999 → Upsell ₹9,999 session (only premium, NOT consultation who already bought it) */}
        {hasPremium && !hasConsultation && (
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

          {/* Context-aware card 2: depends on what the user has purchased */}
          {hasConsultation ? (
            // ₹9,999 buyer — show their session status/link
            <button
              onClick={() =>
                consultationBooking?.status === 'slot_mail_sent'
                  ? toast('Check your email to select a session slot.')
                  : navigate('/consultation/select-slot')
              }
              className="card hover:shadow-lg transition-shadow text-left border-l-4 border-orange-500 cursor-pointer"
            >
              <div className="text-3xl mb-2">📞</div>
              <div className="font-bold text-brand-dark">My 1:1 Session</div>
              <div className="text-sm text-gray-500 mt-1">{consultationBooking ? `Status: ${consultationBooking.status.replace(/_/g, ' ')}` : 'Session booked'}</div>
              <div className="mt-3 text-orange-600 text-sm font-semibold">View Details →</div>
            </button>
          ) : paidReport ? (
            // Has a paid completed report — link to it
            <button
              onClick={() => navigate(`/reports/${paidReport.id}`)}
              className="card hover:shadow-lg transition-shadow text-left border-l-4 border-green-500 cursor-pointer"
            >
              <div className="text-3xl mb-2">📄</div>
              <div className="font-bold text-brand-dark">View Your Report</div>
              <div className="text-sm text-gray-500 mt-1">{paidReport.reportType === 'premium' ? 'Premium AI Report' : 'Full Career Report'}</div>
              <div className="mt-3 text-green-600 text-sm font-semibold">Open Report →</div>
            </button>
          ) : generatingReports.length > 0 ? (
            // Report is generating — show non-clickable placeholder
            <div className="card border-l-4 border-blue-300 opacity-70">
              <div className="text-3xl mb-2">⏳</div>
              <div className="font-bold text-brand-dark">Report Generating...</div>
              <div className="text-sm text-gray-500 mt-1">AI is preparing your report. Should be ready in 1–2 min.</div>
              <div className="mt-3 text-blue-500 text-sm font-semibold">Please wait…</div>
            </div>
          ) : (
            // Free user — show upgrade prompt
            <button
              onClick={() => navigate('/payment?plan=standard')}
              className="card hover:shadow-lg transition-shadow text-left border-l-4 border-green-500 cursor-pointer"
            >
              <div className="text-3xl mb-2">💎</div>
              <div className="font-bold text-brand-dark">Full Report</div>
              <div className="text-sm text-gray-500 mt-1">7 careers · roadmap · PDF · ₹499</div>
              <div className="mt-3 text-green-600 text-sm font-semibold">Get Report →</div>
            </button>
          )}

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

                  {/* Conversion: has free report but no paid plan at all */}
                  {freeReport && !paidReport && !hasAnyPaidPlan && (
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

        {/* ── Account Settings / Danger Zone ──────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Account Settings</h3>
          <div className="card border border-red-200 bg-red-50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-red-700">🗑️ Delete My Account</div>
                <p className="text-red-600 text-sm mt-0.5">
                  Permanently remove your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeletePassword('') }}
                className="shrink-0 bg-red-600 text-white font-bold px-5 py-2 rounded-xl text-sm hover:bg-red-700 transition"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Account Modal ───────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h2 className="font-bold text-red-700 text-lg">Delete Account</h2>
                <p className="text-gray-500 text-xs">This is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="space-y-1 mb-4 text-sm text-gray-600">
              <p>Deleting your account will:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-500 text-xs mt-1">
                <li>Remove your login access immediately</li>
                <li>Anonymise your personal data</li>
                <li>Cancel all active sessions</li>
                <li>Retain payment and legal records as required by law</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Type <span className="font-mono text-red-600">{DELETE_PHRASE}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={DELETE_PHRASE}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoComplete="off"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Enter your current password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your current password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoComplete="current-password"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== DELETE_PHRASE || !deletePassword || deleting}
                className={`flex-1 font-bold py-2 rounded-xl text-sm transition ${
                  deleteConfirmText === DELETE_PHRASE && deletePassword && !deleting
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
