import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { selectUser, clearCredentials } from '../store/slices/authSlice'
import api, { leadApi, consultationApi, authApi, paymentApi } from '../services/api'
import toast from 'react-hot-toast'
import ThemeToggle from '../components/ThemeToggle'
import { formatRupees, getUpgradePrice } from '../utils/planPricing'

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
      current
        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700'
        : done
          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700 opacity-40'
    }`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
        current
          ? 'border-orange-500 text-orange-700 dark:text-orange-400 bg-white dark:bg-gray-900'
          : done
            ? 'border-green-500 text-green-700 dark:text-green-400 bg-white dark:bg-gray-900'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900'
      }`}>
        {done ? '✓' : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${done ? 'text-brand-dark dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{label}</div>
        <div className={`text-xs mt-0.5 ${done ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>{description}</div>
        {children}
      </div>
    </div>
  )
}

// ── ₹499 Standard Plan Timeline ──────────────────────────────────────────────
function StandardTimeline({ leadStatus, paidReport, generatingReport, onRefresh, refreshing }) {
  const reportReady = Boolean(paidReport)
  const generating  = Boolean(generatingReport) || ['paid', 'premium_report_generating'].includes(leadStatus)
  const reportDone  = reportReady || leadStatus === 'premium_report_ready'
  const emailDelivered = Boolean(paidReport?.reportEmailSentAt)
  const emailError = paidReport?.emailDeliveryError

  const statusLabel = emailDelivered ? 'Delivered' : reportReady ? 'Ready' : generating ? 'Generating' : 'Processing'
  const statusColor = reportReady
    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    : generating
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
      : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'

  const steps = [
    {
      key:     'purchased',
      label:   'Plan Purchased — ₹499 Full Report',
      icon:    '💳',
      desc:    'Payment confirmed. Lifetime access to your detailed career report.',
      done:    true,
    },
    {
      key:     'data_locked',
      label:   'Assessment Data Locked',
      icon:    '🔒',
      desc:    'Your 30-question assessment answers are secured for AI analysis.',
      done:    true,  // data is locked as soon as payment confirms
    },
    {
      key:     'generating',
      label:   generating ? 'Report Generation Started…' : 'Report Generation',
      icon:    '🤖',
      desc:    generating
        ? 'Our AI is building your personalised career blueprint — 7+ paths, roadmap, PDF.'
        : 'AI analysis queued. Will begin shortly.',
      done:    reportDone || generating,
      current: generating && !reportDone,
    },
    {
      key:     'report_ready',
      label:   'Full Report Ready',
      icon:    '📄',
      desc:    reportReady
        ? `Ready on ${fmt(paidReport.generatedAt || paidReport.createdAt)}`
        : 'Your detailed report will appear here once generated.',
      done:    reportReady,
    },
    {
      key:     'report_emailed',
      label:   'Report Emailed to You',
      icon:    '📧',
      desc:    emailDelivered
        ? `Delivered on ${fmt(paidReport.reportEmailSentAt)} to your registered email.`
        : reportReady && emailError
          ? `Report is ready, but email delivery failed: ${emailError}`
        : 'Email will be sent as soon as the report is ready.',
      done:    emailDelivered,
      current: reportReady && !emailDelivered,
    },
    {
      key:     'downloadable',
      label:   'PDF Download Available',
      icon:    '⬇️',
      desc:    'Download your complete career blueprint as a PDF anytime.',
      done:    reportReady,
    },
  ]

  return (
    <div className="card mb-6 border-2 border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-gray-900">
      {/* Status card */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-xl shrink-0">📋</div>
          <div>
            <h3 className="font-bold text-brand-dark dark:text-gray-100 text-base">₹499 Full Report — Your Journey</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Career Report Plan</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
              refreshing
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Refresh timeline status"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 px-2 py-0.5 rounded-full">
            ₹499 Report
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <TimelineStep key={s.key} done={s.done} current={s.current} icon={s.icon} label={s.label} description={s.desc}>
            {s.key === 'generating' && generating && !reportDone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Usually takes 1–3 minutes. Refresh the page to check.
              </div>
            )}
            {s.key === 'report_ready' && paidReport && (
              <Link to={`/reports/${paidReport.id}`} className="inline-block mt-1 text-xs text-brand-red font-semibold hover:underline">
                Open Full Report →
              </Link>
            )}
            {s.key === 'downloadable' && paidReport && (
              <Link to={`/reports/${paidReport.id}`} className="inline-block mt-1 text-xs text-gray-600 dark:text-gray-400 hover:underline">
                Open Report &amp; Download PDF →
              </Link>
            )}
          </TimelineStep>
        ))}
      </div>
    </div>
  )
}

// ── ₹1,999 Premium Plan Timeline ─────────────────────────────────────────────
function PremiumTimeline({ leadStatus, paidReport, generatingReport, onRefresh, refreshing }) {
  const generating  = Boolean(generatingReport) || leadStatus === 'premium_report_generating'
  const reportReady = Boolean(paidReport)
  const reportDone  = reportReady || leadStatus === 'premium_report_ready'
  const emailDelivered = Boolean(paidReport?.reportEmailSentAt)
  const emailError = paidReport?.emailDeliveryError

  const statusLabel = emailDelivered ? 'Delivered' : reportReady ? 'Ready' : generating ? 'Analysing' : 'Processing'
  const statusColor = reportReady
    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700'
    : generating
      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700'
      : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'

  const steps = [
    {
      key:     'purchased',
      label:   'Premium Plan Purchased — ₹1,999 Deep Analysis',
      icon:    '🚀',
      desc:    'Payment confirmed. Premium AI deep-dive into your career fit, roadmap & subject strategy.',
      done:    true,
    },
    {
      key:     'data_locked',
      label:   'Assessment Data Locked',
      icon:    '🔒',
      desc:    'Your 30-question assessment answers are secured for premium AI analysis.',
      done:    true,
    },
    {
      key:     'generating',
      label:   generating ? 'Deep Analysis Started…' : 'Deep AI Analysis',
      icon:    '🤖',
      desc:    generating
        ? 'Building your year-by-year roadmap, subject strategy, exam timeline & scholarship list.'
        : 'Premium AI analysis queued.',
      done:    reportDone || generating,
      current: generating && !reportDone,
    },
    {
      key:     'report_ready',
      label:   'Premium Report Ready',
      icon:    '📊',
      desc:    reportReady
        ? `Ready on ${fmt(paidReport.generatedAt || paidReport.createdAt)} · 7+ careers · roadmap · subject strategy`
        : '7+ career paths · Year-by-year roadmap · Subject strategy · Scholarship list',
      done:    reportReady,
    },
    {
      key:     'report_emailed',
      label:   'Premium Report Emailed to You',
      icon:    '📧',
      desc:    emailDelivered
        ? `Delivered on ${fmt(paidReport.reportEmailSentAt)} to your registered email.`
        : reportReady && emailError
          ? `Premium report is ready, but email delivery failed: ${emailError}`
        : 'Email will be sent as soon as your premium report is ready.',
      done:    emailDelivered,
      current: reportReady && !emailDelivered,
    },
    {
      key:     'downloadable',
      label:   'Full Blueprint PDF Available',
      icon:    '⬇️',
      desc:    'Download your complete premium career blueprint — share with parents & teachers.',
      done:    reportReady,
    },
  ]

  return (
    <div className="card mb-6 border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900">
      {/* Status card */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-xl shrink-0">🚀</div>
          <div>
            <h3 className="font-bold text-brand-dark dark:text-gray-100 text-base">₹1,999 Premium AI Report — Your Journey</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Premium Deep-Analysis Plan</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
              refreshing
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Refresh timeline status"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <span className="text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 px-2 py-0.5 rounded-full">
            ₹1,999 Premium
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <TimelineStep key={s.key} done={s.done} current={s.current} icon={s.icon} label={s.label} description={s.desc}>
            {s.key === 'generating' && generating && !reportDone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
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
            {s.key === 'downloadable' && paidReport && (
              <Link to={`/reports/${paidReport.id}`} className="inline-block mt-1 text-xs text-gray-600 dark:text-gray-400 hover:underline">
                Open Report &amp; Download PDF →
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
  { key: 'purchased',                label: 'Booking Confirmed',           icon: '💳', desc: 'Payment captured — ₹9,999 consultation booked' },
  { key: 'slot_mail_sent',           label: 'Scheduling Email Sent',       icon: '📧', desc: 'Email with your private booking link has been sent' },
  { key: 'slot_selected',            label: 'Exact Slot Selected',         icon: '📅', desc: 'You locked a specific date and time for the session' },
  { key: 'meeting_scheduled',        label: 'Meeting Link Ready',          icon: '📆', desc: 'Meeting link generated and shared for the live session' },
  { key: 'meeting_completed',        label: 'Session Completed',           icon: '🎤', desc: '1:1 Career Blueprint Session completed' },
  { key: 'counselling_report_ready', label: 'Personalised Report Ready',   icon: '🎓', desc: 'Your 1:1 counselling report has been prepared and emailed to you' },
]

// Derive current step index from booking.status
const BOOKING_STATUS_TO_STEP = {
  booking_confirmed:        0,
  slot_mail_sent:           1,   // step 1 (email sent)
  slot_selected:            2,
  meeting_scheduled:        3,
  meeting_completed:        4,
  counselling_report_ready: 5,
}

function ConsultationTimeline({ booking, onResend, onRefresh, refreshing }) {
  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState(null) // { ok, message, nextResendAt }
  const [recovering, setRecovering] = useState(false)
  const [recoverResult, setRecoverResult] = useState(null) // { ok, message }

  const currentStepIdx = booking ? (BOOKING_STATUS_TO_STEP[booking.status] ?? 0) : -1
  const hasExactSlot = Boolean(booking?.slotSelectedAt || booking?.scheduledStartAt)
  const hasMeetingLink = Boolean(booking?.meetingLink || booking?.scheduledStartAt)
  const schedulingEmailSent = Boolean(booking?.schedulingEmailSentAt)
  const schedulingEmailError = booking?.schedulingEmailError

  // Cooldown state
  const lastSentAt    = booking?.lastResendAt || null
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
        ok:          Boolean(data.delivered),
        message:     res.data.message || 'Email resent successfully.',
        nextResendAt: data.nextResendAt,
      })
      if (data.delivered) {
        toast.success('Scheduling email resent! Check your inbox.')
      } else {
        toast.error(res.data.message || 'Scheduling email delivery failed.')
      }
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
      const res = await consultationApi.recover()
      const data = res.data.data || {}
      setRecoverResult({ ok: Boolean(data.delivered), message: res.data.message || 'Booking recovered.' })
      if (data.delivered) {
        toast.success('Success! Check your email for the scheduling link.')
      } else {
        toast.error(res.data.message || 'Booking recovered, but email delivery failed.')
      }
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
      <div className="card mb-6 border-2 border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-xl shrink-0">📞</div>
          <div>
            <h3 className="font-bold text-brand-dark dark:text-gray-100">₹9,999 Career Blueprint Session</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">1:1 Consultation · Booking setup in progress</p>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-xl">
          <div className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm mb-1">⏳ Setting Up Your Booking</div>
          <p className="text-yellow-700 dark:text-yellow-400 text-xs mb-3">
            Your payment was received but your booking record is still being created. This usually resolves in a few seconds — try refreshing the page.
          </p>
          <p className="text-yellow-700 dark:text-yellow-400 text-xs mb-4">
            If this persists, click <strong>"Send Scheduling Email"</strong> below and we'll set up your booking immediately.
          </p>

          {recoverResult ? (
            <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${recoverResult.ok ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'}`}>
              {recoverResult.ok ? '✅ ' : '❌ '}{recoverResult.message}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                refreshing
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                  : 'border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-white dark:bg-gray-900 hover:bg-yellow-50 dark:hover:bg-yellow-950/30'
              }`}
            >
              {refreshing ? '⏳ Refreshing…' : '🔄 Refresh Status'}
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
              {recovering ? '⏳ Setting up…' : recoverResult?.ok ? '✅ Done' : '📧 Send Scheduling Email'}
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
    <div className="card mb-6 border-2 border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-gray-900">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-xl shrink-0">📞</div>
          <div>
            <h3 className="font-bold text-brand-dark dark:text-gray-100 text-base">₹9,999 Career Blueprint Session — Progress</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">1:1 Consultation · {booking.counsellorName}</p>
          </div>
        </div>
        {/* Status chip */}
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
              refreshing
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Refresh timeline status"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <span className="text-xs font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 px-2 py-0.5 rounded-full">
            ₹9,999 Session
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
            booking.status === 'counselling_report_ready' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700' :
            booking.status === 'meeting_completed'        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' :
            booking.status === 'meeting_scheduled'        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700' :
            booking.status === 'slot_selected'            ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700' :
                                                            'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700'
          }`}>
            {booking.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {CONSULTATION_STEPS.map((step, idx) => {
          const done = step.key === 'slot_selected'
            ? hasExactSlot
            : step.key === 'slot_mail_sent'
              ? schedulingEmailSent
            : step.key === 'meeting_scheduled'
              ? hasMeetingLink
              : idx <= currentStepIdx
          const current = idx === currentStepIdx
          return (
            <TimelineStep key={step.key} done={done} current={current} icon={step.icon} label={step.label} description={step.desc}>
              {/* Slot email step: show sent-at + resend button */}
              {step.key === 'slot_mail_sent' && done && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  First sent: {fmt(booking.schedulingEmailSentAt)}
                  {booking.resendCount > 0 && ` · Resent ${booking.resendCount}×`}
                  {booking.lastResendAt && ` (last: ${fmt(booking.lastResendAt)})`}
                </div>
              )}

              {step.key === 'slot_mail_sent' && !done && schedulingEmailError && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Email delivery failed: {schedulingEmailError}
                </div>
              )}

              {/* Slot selected detail */}
              {step.key === 'slot_selected' && booking.selectedSlot && (
                <div className="mt-1 text-xs text-teal-700 dark:text-teal-400 font-semibold">
                  📍 {booking.scheduledStartAt ? fmt(booking.scheduledStartAt) : (SLOT_LABELS[booking.selectedSlot] || booking.selectedSlot)}
                  {booking.slotSelectedAt && ` · booked ${fmt(booking.slotSelectedAt)}`}
                </div>
              )}

              {/* Meeting detail */}
              {step.key === 'meeting_scheduled' && booking.scheduledStartAt && (
                <div className="mt-1 space-y-0.5">
                  <div className="text-xs text-purple-700 dark:text-purple-400 font-semibold">
                    📆 {fmt(booking.scheduledStartAt)}
                  </div>
                  {booking.meetingLink && (
                    <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-red underline block">
                      Join Meeting →
                    </a>
                  )}
                </div>
              )}

              {/* Counselling report ready — view dashboard CTA */}
              {step.key === 'counselling_report_ready' && done && (
                <div className="mt-1 text-xs text-green-700 dark:text-green-400 font-semibold">
                  🎓 Your personalised report has been emailed to you. Check your inbox.
                </div>
              )}
            </TimelineStep>
          )
        })}
      </div>

      {/* ── Counselling Report Ready — success banner ── */}
      {booking.status === 'counselling_report_ready' && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-xl">
          <div className="font-semibold text-green-800 dark:text-green-300 text-sm mb-1">🎉 Your Counselling Report is Ready!</div>
          <p className="text-green-700 dark:text-green-400 text-xs mb-3">
            Your personalised 1:1 career counselling report has been prepared by <strong>{booking.counsellorName || 'Adish Gupta'}</strong> and emailed to your registered address. Check your inbox (and spam folder if not visible).
          </p>
          <p className="text-green-700 dark:text-green-400 text-xs">
            Questions? Reach us at{' '}
            <a href={`mailto:${booking.counsellorContact || 'adish@cadgurukul.com'}`} className="underline font-semibold">
              {booking.counsellorContact || 'adish@cadgurukul.com'}
            </a>
          </p>
        </div>
      )}

      {/* ── Action Required: Slot not yet selected ── */}
      {!hasExactSlot && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-xl">
          <div className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm mb-1">
            ⏰ Action Required — {schedulingEmailSent ? 'Select Your Session Slot' : 'Get Your Scheduling Email'}
          </div>
          <p className="text-yellow-700 dark:text-yellow-400 text-xs mb-3">
            {schedulingEmailSent
              ? `A scheduling link was sent to your registered email (${booking.resendCount > 0 ? `resent ${booking.resendCount} time${booking.resendCount !== 1 ? 's' : ''}` : 'initial send'}). Click the link in the email to choose your exact session date and time.`
              : `Your booking is confirmed, but the scheduling email has not been delivered yet${schedulingEmailError ? `: ${schedulingEmailError}` : '.'} Use the resend button below to try again right now.`}
          </p>

          {/* Resend section */}
          <div className="border-t border-yellow-200 dark:border-yellow-700 pt-3">
            <div className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold mb-2">Didn't receive the email?</div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <button
                onClick={handleResend}
                disabled={resending || !cooldownOver}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                  resending || !cooldownOver
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                    : 'bg-yellow-600 text-white border-yellow-700 hover:bg-yellow-700'
                }`}
              >
                {resending ? '⏳ Sending…' : cooldownOver ? '📧 Resend Scheduling Email' : `⏳ Resend in ${minutesLeft} min`}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Also check spam/junk folder · 
                <a href="mailto:support@cadgurukul.com" className="text-brand-red ml-1 underline">Contact support</a>
              </span>
            </div>
            {resendResult && (
              <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${resendResult.ok ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'}`}>
                {resendResult.ok ? '✅ ' : '❌ '}{resendResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meeting scheduled — action link */}
      {booking.status === 'meeting_scheduled' && booking.meetingLink && (
        <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-700 rounded-xl">
          <div className="text-xs text-purple-800 dark:text-purple-300 font-semibold mb-2">Your meeting is confirmed!</div>
          <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-purple-700 transition">
            Join Meeting →
          </a>
        </div>
      )}

      {/* Counsellor card */}
      <div className="mt-4 pt-4 border-t border-orange-100 dark:border-orange-900/40 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-xl shrink-0">👨‍💼</div>
        <div>
          <div className="font-bold text-sm text-brand-dark dark:text-gray-100">{booking.counsellorName || 'Adish Gupta'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{booking.counsellorExpertise || 'Career Guidance Specialist'}</div>
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
      <h3 className="font-bold text-brand-dark dark:text-gray-100 mb-4 text-sm">🗺️ Your Career Journey Progress</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {FUNNEL_STEPS.map((step, idx) => {
          const done    = idx <= currentIdx
          const current = idx === currentIdx
          return (
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div className={`flex flex-col items-center gap-1 ${done ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                  current ? 'border-brand-red bg-red-50 dark:bg-red-950/30' :
                  done    ? 'border-green-500 bg-green-50 dark:bg-green-950/30' :
                             'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                }`}>
                  {step.icon}
                </div>
                <span className="text-[10px] text-center text-gray-500 dark:text-gray-400 leading-tight max-w-[56px]">{step.label}</span>
              </div>
              {idx < FUNNEL_STEPS.length - 1 && (
                <div className={`w-4 h-0.5 mb-4 rounded ${idx < currentIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`} />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current: {status?.replace(/_/g, ' ') || 'new lead'}</p>
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
  const [hasConsultationPayment, setHasConsultationPayment] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [timelineRefreshing, setTimelineRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

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

  const loadDashboardData = useCallback(async ({ showSpinner = false, showToast = false } = {}) => {
    if (showSpinner) setTimelineRefreshing(true)
    try {
      const [profileRes, reportsRes, leadRes, consultationRes, paymentsRes] = await Promise.all([
        api.get('/students/me').catch(() => ({ data: { data: null } })),
        api.get('/reports/my').catch(() => ({ data: { data: [] } })),
        leadApi.getMe().catch(() => ({ data: { data: null } })),
        consultationApi.getMyBooking().catch(() => ({ data: { data: null } })),
        paymentApi.getHistory().catch(() => ({ data: { data: [] } })),
      ])
      const paymentHistory = paymentsRes.data.data || []
      const consultationPaid = paymentHistory.some((p) => p.status === 'CAPTURED' && p.planType === 'consultation')

      setProfile(profileRes.data.data)
      setReports(reportsRes.data.data || [])
      setLead(leadRes.data.data)
      setConsultationBooking(consultationRes.data.data)
      setHasConsultationPayment(consultationPaid)
      setLastSyncedAt(new Date())

      if (showToast) toast.success('Timeline refreshed.')
    } catch {
      if (showToast) toast.error('Failed to refresh timeline data.')
    } finally {
      if (showSpinner) setTimelineRefreshing(false)
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
      await loadDashboardData()
      setIsLoading(false)
    }
    loadData()
  }, [loadDashboardData])

  const completedReports  = reports.filter((r) => r.status === 'COMPLETED')
  const generatingReports = reports.filter((r) => r.status === 'GENERATING')
  const freeReport        = completedReports.find((r) => r.accessLevel === 'FREE')
  const paidReport        = completedReports.find((r) => r.accessLevel === 'PAID')

  // ── Payment detection ─────────────────────────────────────────────────────
  // IMPORTANT: Lead.planType has a DB-level DEFAULT 'standard', meaning every lead
  // record — including free users who never paid — has planType = 'standard'.
  // We must use lead.status as the primary payment gate; only use planType to
  // distinguish *which* plan was purchased (for users who have actually paid).
  //
  // Fallback: if no lead record is linked to this user (e.g. lead-linking race
  // condition or data gap), use paidReport.reportType / consultationBooking so
  // the correct timeline still renders for users who genuinely paid.
  const PAID_STATUSES = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed']
  const leadStatus  = lead?.status || 'new_lead'
  const userHasPaid = PAID_STATUSES.includes(leadStatus) || Boolean(paidReport) || Boolean(consultationBooking)
  // Resolve plan type: lead record is authoritative; fall back to paidReport.reportType
  const planType    = userHasPaid
    ? (lead?.planType || paidReport?.reportType || 'standard')
    : 'free'

  // A consultation booking is definitive proof of the consultation plan even if
  // the lead planType hasn't been updated yet.
  const hasConsultation   = planType === 'consultation' || Boolean(consultationBooking) || hasConsultationPayment
  const hasPremium        = planType === 'premium' || hasConsultation
  const hasStandard       = planType === 'standard'
  const hasAnyPaidPlan    = userHasPaid   // simplest, most reliable
  const premiumUpgradePrice = formatRupees(getUpgradePrice('standard', 'premium'))
  const consultationUpgradePrice = formatRupees(getUpgradePrice(planType === 'standard' ? 'standard' : 'premium', 'consultation'))

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header strip */}
      <div className="bg-gradient-to-r from-brand-dark to-brand-navy text-white py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile?.fullName || user?.email?.split('@')[0]}! 👋</h1>
            <p className="text-gray-300 text-sm mt-1">Your career journey dashboard</p>
          </div>
          <ThemeToggle className="mt-1" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last synced: {lastSyncedAt ? fmt(lastSyncedAt) : '—'}
          </p>
          <button
            onClick={() => loadDashboardData({ showSpinner: true, showToast: true })}
            disabled={timelineRefreshing}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
              timelineRefreshing
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {timelineRefreshing ? 'Refreshing…' : '↻ Refresh Timeline'}
          </button>
        </div>

        {/* ── Plan-specific timeline ─────────────────────────────────────────── */}
        {hasConsultation && (
          <ConsultationTimeline
            booking={consultationBooking}
            onResend={refreshBooking}
            onRefresh={() => loadDashboardData({ showSpinner: true, showToast: true })}
            refreshing={timelineRefreshing}
          />
        )}
        {hasPremium && !hasConsultation && (
          <PremiumTimeline
            leadStatus={leadStatus}
            paidReport={paidReport}
            generatingReport={generatingReports[0]}
            onRefresh={() => loadDashboardData({ showSpinner: true, showToast: true })}
            refreshing={timelineRefreshing}
          />
        )}
        {hasStandard && !hasPremium && !hasConsultation && (
          <StandardTimeline
            leadStatus={leadStatus}
            paidReport={paidReport}
            generatingReport={generatingReports[0]}
            onRefresh={() => loadDashboardData({ showSpinner: true, showToast: true })}
            refreshing={timelineRefreshing}
          />
        )}
        {!userHasPaid && lead && <FunnelProgress status={lead.status} />}

        {/* Profile not complete notice */}
        {(!profile || !profile.isOnboardingComplete) && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-amber-800 dark:text-amber-300">⚠️ Complete Your Profile First</div>
              <p className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">Fill in your details to get an accurate, personalized career report.</p>
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
              <div className="font-bold text-brand-dark">Upgrade to Premium AI Report — {premiumUpgradePrice}</div>
              <p className="text-sm text-gray-600 mt-0.5">Your ₹499 report is already included. Pay only the difference for premium depth.</p>
            </div>
            <button
              onClick={() => navigate(`/payment?plan=premium&assessmentId=${paidReport.assessmentId || ''}`)}
              className="bg-purple-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-700 transition shrink-0"
            >
              Upgrade for {premiumUpgradePrice} →
            </button>
          </div>
        )}

        {/* Premium ₹1,999 → Upsell ₹9,999 session (only premium, NOT consultation who already bought it) */}
        {hasPremium && !hasConsultation && (
          <div className="mb-6 rounded-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-block bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">🔥 Limited — 3 slots/day</div>
              <div className="font-bold text-brand-dark">Upgrade to 1:1 Session with Adish Gupta — {consultationUpgradePrice}</div>
              <p className="text-sm text-gray-600 mt-0.5">Your Premium AI Report is already included. Pay only the difference for the live counselling session.</p>
            </div>
            <button
              onClick={() => navigate(`/payment?plan=consultation${paidReport?.assessmentId ? `&assessmentId=${paidReport.assessmentId}` : ''}`)}
              className="bg-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-orange-600 transition shrink-0"
            >
              Upgrade for {consultationUpgradePrice} →
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
                ['booking_confirmed', 'slot_mail_sent'].includes(consultationBooking?.status)
                  ? toast(consultationBooking?.schedulingEmailSentAt ? 'Check your email to schedule your session.' : 'Your booking is confirmed. Use the resend option in the timeline to receive the scheduling email.')
                  : consultationBooking?.meetingLink
                    ? window.open(consultationBooking.meetingLink, '_blank', 'noopener,noreferrer')
                    : toast('Your consultation details are visible above in the timeline.')
              }
              className="card hover:shadow-lg transition-shadow text-left border-l-4 border-orange-500 cursor-pointer"
            >
              <div className="text-3xl mb-2">📞</div>
              <div className="font-bold text-brand-dark">My 1:1 Session</div>
              <div className="text-sm text-gray-500 mt-1">{consultationBooking ? `Status: ${consultationBooking.status.replace(/_/g, ' ')}` : 'Session booked'}</div>
              <div className="mt-3 text-orange-600 text-sm font-semibold">{consultationBooking?.meetingLink ? 'Join Session →' : 'View Details →'}</div>
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
