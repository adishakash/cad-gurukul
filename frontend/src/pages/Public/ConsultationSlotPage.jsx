/**
 * ConsultationSlotPage — Phase 7 + Phase 10
 * ─────────────────────────────────────────────────────────────────────────────
 * Route: /consultation/select-slot?token=<slotToken>
 *
 * Phase 10 flow (preferred — when admin has added date-specific slots):
 *   1. Page fetches AvailabilitySlots from GET /scheduling/available-slots
 *   2. Student picks a specific date + time
 *   3. POST /scheduling/book { token, slotId } → atomically claims slot + creates Meet link
 *   4. Confirmation screen shows date, time, and Google Meet link
 *
 * Legacy fallback (Phase 7 — when no date-specific slots are configured):
 *   Student picks morning / afternoon / evening time window.
 *   POST /consultation/select-slot { token, slot }
 *   Admin manually sets the meeting date and link afterwards.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { consultationApi, schedulingPublicApi } from '../../services/api'

// ─── Legacy constants (Phase 7 time-window fallback) ─────────────────────────

const LEGACY_SLOTS = [
  {
    value: 'morning_9_12',
    label: 'Morning',
    time: '9:00 AM – 12:00 PM',
    icon: '☀️',
    description: 'Best for school students who prefer starting the day fresh',
  },
  {
    value: 'afternoon_2_5',
    label: 'Afternoon',
    time: '2:00 PM – 5:00 PM',
    icon: '🕑',
    description: 'Perfect for families who want a post-lunch focused session',
  },
  {
    value: 'evening_6_9',
    label: 'Evening',
    time: '6:00 PM – 9:00 PM',
    icon: '🌙',
    description: 'Ideal for working parents and students finishing school late',
  },
]

const LEGACY_SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsultationSlotPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // Mode: 'loading' | 'date-specific' | 'legacy'
  const [mode, setMode]               = useState('loading')
  const [availableSlots, setAvailableSlots] = useState([])

  // Selection state
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [selectedLegacy, setSelectedLegacy] = useState(null)
  const [isLoading, setIsLoading]           = useState(false)

  // Result states
  const [success, setSuccess] = useState(null)
  const [error, setError]     = useState(null)

  // ── Fetch available slots on mount to determine which flow to show ────────
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await schedulingPublicApi.getAvailableSlots()
        const slots = res?.data?.data?.slots || []
        if (slots.length > 0) {
          setAvailableSlots(slots)
          setMode('date-specific')
        } else {
          setMode('legacy')
        }
      } catch {
        // Graceful degradation: if new endpoint unavailable, use legacy flow
        setMode('legacy')
      }
    }
    fetchSlots()
  }, [])

  // ── Phase 10: Book a specific slot ───────────────────────────────────────
  const handleBookDateSlot = async (slotId) => {
    if (!token) {
      setError('Invalid or missing booking token. Please use the full link from your email.')
      return
    }
    setSelectedSlotId(slotId)
    setIsLoading(true)
    setError(null)
    try {
      const res = await schedulingPublicApi.bookSlot({ token, slotId })
      setSuccess({ type: 'date-specific', data: res.data?.data || {} })
    } catch (err) {
      const status = err?.response?.status
      const code   = err?.response?.data?.error?.code
      if (status === 409 || code === 'SLOT_UNAVAILABLE') {
        setError('This time slot was just taken by someone else. Please choose another available slot below.')
        // Refresh available slots
        try {
          const res2 = await schedulingPublicApi.getAvailableSlots()
          setAvailableSlots(res2?.data?.data?.slots || [])
        } catch { /* best-effort */ }
      } else if (status === 404 || code === 'INVALID_TOKEN') {
        setError('This booking link is invalid or has expired. Please contact support@cadgurukul.com.')
      } else {
        setError(err?.response?.data?.error?.message || 'Something went wrong. Please try again.')
      }
      setSelectedSlotId(null)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Phase 7 legacy: Select a time window ─────────────────────────────────
  const handleSelectLegacy = async (slot) => {
    if (!token) {
      setError('Invalid or missing slot-selection token. Please use the link from your email.')
      return
    }
    setSelectedLegacy(slot)
    setIsLoading(true)
    setError(null)
    try {
      const res = await consultationApi.selectSlot({ token, slot })
      setSuccess({ type: 'legacy', data: res.data?.data || {}, slot })
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        const selectedSlot = err.response?.data?.error?.details?.selectedSlot
        setError(
          `You have already selected "${LEGACY_SLOT_LABELS[selectedSlot] || 'a time slot'}" for your session. Check your confirmation email or contact support@cadgurukul.com to change your slot.`,
        )
      } else if (status === 404) {
        setError('This slot-selection link is invalid or has expired. Please contact support@cadgurukul.com.')
      } else {
        setError(err?.response?.data?.message || 'Something went wrong. Please try again or contact support@cadgurukul.com.')
      }
      setSelectedLegacy(null)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    const isDateSpecific = success.type === 'date-specific'
    const d = success.data
    return (
      <PageShell>
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
            {isDateSpecific ? 'Session Scheduled!' : 'Slot Confirmed!'}
          </h1>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            {isDateSpecific
              ? 'Your career session is booked. Meeting details have been sent to your email.'
              : `You've chosen the ${LEGACY_SLOT_LABELS[success.slot] || success.slot} slot. Our team will send you the meeting link within 24 hours.`}
          </p>

          {/* Date-specific: full meeting card with Meet link */}
          {isDateSpecific && d.scheduledDateStr && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-left mb-5">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">📋 Meeting Details</div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 shrink-0">📅 Date</span>
                  <span className="font-semibold text-gray-900">{d.scheduledDateStr}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 shrink-0">⏰ Time</span>
                  <span className="font-semibold text-gray-900">{d.scheduledTimeStr}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 shrink-0">👨‍💼 Expert</span>
                  <span className="font-semibold text-gray-900">{d.counsellorName || 'Adish Gupta'}</span>
                </div>
              </div>
              {d.googleMeetLink && d.googleMeetLink !== 'https://meet.google.com/pending-admin-setup' ? (
                <div className="mt-4">
                  <a
                    href={d.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-5 py-3 font-bold text-sm hover:bg-indigo-700 transition-colors w-full justify-center"
                  >
                    📹 Join Google Meet →
                  </a>
                  <p className="text-xs text-gray-400 mt-2 break-all">{d.googleMeetLink}</p>
                </div>
              ) : (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                  ⏳ Your Google Meet link will be emailed to you shortly by our team.
                </div>
              )}
            </div>
          )}

          {/* Legacy: counsellor card */}
          {!isDateSpecific && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-left max-w-sm mx-auto mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">👨‍💼</div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{d.counsellorName || 'Adish Gupta'}</div>
                  <div className="text-xs text-gray-500">{d.counsellorExpertise || 'Career Counselling Expert'}</div>
                </div>
              </div>
              {d.counsellorContact && (
                <div className="text-xs text-orange-700 font-semibold">📞 {d.counsellorContact}</div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-500">
            Have questions? Email us at{' '}
            <a href="mailto:support@cadgurukul.com" className="text-orange-600 underline">
              support@cadgurukul.com
            </a>
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <PageShell>
        <div className="text-center py-10">
          <div className="text-4xl mb-4 animate-pulse">📅</div>
          <p className="text-gray-500 text-sm">Loading available sessions…</p>
        </div>
      </PageShell>
    )
  }

  // ── Phase 10: Date-specific slot picker ───────────────────────────────────
  if (mode === 'date-specific') {
    const grouped = availableSlots.reduce((acc, s) => {
      const key = s.dateStr || s.date
      if (!acc[key]) acc[key] = []
      acc[key].push(s)
      return acc
    }, {})

    return (
      <PageShell>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📅</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Choose Your Session</h1>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Select an available date and time for your <strong>1:1 Career Blueprint Session</strong>.
            You'll receive a Google Meet link immediately after booking.
          </p>
        </div>

        {!token && (
          <AlertBox type="error">⚠️ No booking token found. Please use the full link from your email.</AlertBox>
        )}
        {error && <AlertBox type="error">{error}</AlertBox>}

        {availableSlots.length === 0 ? (
          <AlertBox type="warning">
            No open slots are currently available. Please check back soon or contact{' '}
            <a href="mailto:support@cadgurukul.com" className="underline">support@cadgurukul.com</a>.
          </AlertBox>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateStr, daySlots]) => (
              <div key={dateStr}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{dateStr}</h3>
                <div className="space-y-3">
                  {daySlots.map((slot) => {
                    const isChosen = selectedSlotId === slot.id
                    return (
                      <button
                        key={slot.id}
                        onClick={() => !isLoading && handleBookDateSlot(slot.id)}
                        disabled={isLoading || !token}
                        className={`w-full text-left rounded-2xl border-2 p-4 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          isChosen
                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                        } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl shrink-0">
                            {slot.startTime < '12:00' ? '☀️' : slot.startTime < '17:00' ? '🕑' : '🌙'}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-sm">{slot.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{slot.timeStr}</div>
                          </div>
                          {isChosen && isLoading ? (
                            <svg className="animate-spin w-5 h-5 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 shrink-0">
                              Available
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Slots are claimed instantly. A Google Meet link will be emailed to you right away.
        </p>
      </PageShell>
    )
  }

  // ── Phase 7 legacy: Time-window picker ───────────────────────────────────
  return (
    <PageShell>
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">📅</div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
          Choose Your Session Time Slot
        </h1>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Your <strong>1:1 Career Blueprint Session</strong> has been booked. Select the time
          window that works best for you and your family.
        </p>
      </div>

      {!token && (
        <AlertBox type="error">⚠️ No selection token found. Please use the full link from your email.</AlertBox>
      )}
      {error && <AlertBox type="error">{error}</AlertBox>}

      <div className="space-y-4">
        {LEGACY_SLOTS.map((slot) => {
          const isActive = selectedLegacy === slot.value
          return (
            <button
              key={slot.value}
              onClick={() => !isLoading && handleSelectLegacy(slot.value)}
              disabled={isLoading || !token}
              className={`w-full text-left rounded-2xl border-2 p-5 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                isActive
                  ? 'border-orange-500 bg-orange-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'
              } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl shrink-0">{slot.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-900">{slot.label}</div>
                    <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                      {slot.time}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{slot.description}</div>
                </div>
                {isActive && isLoading && (
                  <svg className="animate-spin w-5 h-5 text-orange-500 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        You can only select a slot once. Our team will confirm the exact date via email within 24 hours.
      </p>
    </PageShell>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function AlertBox({ type = 'error', children }) {
  const styles = type === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
  return (
    <div className={`mb-4 p-4 border rounded-xl text-sm text-center ${styles}`}>
      {children}
    </div>
  )
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white rounded-2xl px-5 py-3 shadow-sm border border-orange-100">
            <span className="text-2xl">🎓</span>
            <span className="font-extrabold text-gray-900 text-lg tracking-tight">CAD Gurukul</span>
          </div>
          <div className="text-xs text-gray-400 mt-2">AI-powered Career Discovery Platform</div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-xl border border-orange-100 p-8">
          {children}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Need help?{' '}
          <a href="mailto:support@cadgurukul.com" className="text-orange-500 underline">
            support@cadgurukul.com
          </a>
        </p>
      </div>
    </div>
  )
}
