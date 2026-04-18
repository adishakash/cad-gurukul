/**
 * ConsultationSlotPage — public page (no auth required)
 *
 * Route: /consultation/select-slot?token=<slotToken>
 *
 * When a ₹9,999 consultation buyer clicks the slot-selection link in their
 * email, they land here. The page lets them choose Morning / Afternoon /
 * Evening, then POSTs to /api/consultation/select-slot.
 *
 * A confirmation state is shown on success, and clear error messages are
 * rendered for edge-cases (invalid token, slot already selected).
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { consultationApi } from '../../services/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOTS = [
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

const SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConsultationSlotPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [selected, setSelected]   = useState(null)  // slot value user has clicked
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess]     = useState(null)   // { slot, booking } on success
  const [error, setError]         = useState(null)   // string error message

  const handleSelect = async (slot) => {
    if (!token) {
      setError('Invalid or missing slot-selection token. Please use the link from your email.')
      return
    }

    setSelected(slot)
    setIsLoading(true)
    setError(null)

    try {
      const res = await consultationApi.selectSlot({ token, slot })
      setSuccess({ slot, booking: res.data.data || {} })
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        const selectedSlot = err.response.data?.error?.details?.selectedSlot
        setError(
          `You have already selected "${SLOT_LABELS[selectedSlot] || 'a time slot'}" for your session. Check your confirmation email or contact support@cadgurukul.com to change your slot.`,
        )
      } else if (status === 404) {
        setError(
          'This slot-selection link is invalid or has expired. Please contact support at support@cadgurukul.com.',
        )
      } else {
        setError(
          err?.response?.data?.message ||
          'Something went wrong. Please try again or contact support@cadgurukul.com.',
        )
      }
      setSelected(null)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Slot Confirmed!</h1>
          <p className="text-gray-600 mb-6">
            You've chosen the{' '}
            <strong className="text-orange-600">{SLOT_LABELS[success.slot]}</strong> slot.
            Our team will send you the exact meeting date and link within <strong>24 hours</strong>.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-left max-w-sm mx-auto mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">👨‍💼</div>
              <div>
                <div className="font-bold text-gray-900 text-sm">
                  {success.booking?.counsellorName || 'Adish Gupta'}
                </div>
                <div className="text-xs text-gray-500">
                  {success.booking?.counsellorExpertise || 'Career Counselling Expert'}
                </div>
              </div>
            </div>
            {success.booking?.counsellorContact && (
              <div className="text-xs text-orange-700 font-semibold">
                📞 {success.booking.counsellorContact}
              </div>
            )}
          </div>

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

  // ── Slot selection state ──────────────────────────────────────────────────
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
          ⚠️ No selection token found. Please use the full link from your email.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {SLOTS.map((slot) => {
          const isActive = selected === slot.value
          return (
            <button
              key={slot.value}
              onClick={() => !isLoading && handleSelect(slot.value)}
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

// ─── Shared page shell ────────────────────────────────────────────────────────

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
