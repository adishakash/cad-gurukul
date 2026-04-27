import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { consultationApi, schedulingPublicApi } from '../../services/api'
import Seo from '../../components/SEO/Seo'

const fmtDateTime = (value) => new Date(value).toLocaleString('en-IN', {
  dateStyle: 'full',
  timeStyle: 'short',
})

export default function ConsultationSlotPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [availability, setAvailability] = useState([])
  const [booking, setBooking] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [submitting, setSubmitting] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const seo = (
    <Seo
      title="Book Consultation Slot | CAD Gurukul"
      description="Select a counselling session slot from your CAD Gurukul booking link."
      noIndex
    />
  )

  useEffect(() => {
    const loadAvailability = async () => {
      if (!token) {
        setError('Invalid or missing scheduling token. Please use the link from your email.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const res = await consultationApi.getAvailability(token)
        setAvailability(res.data.data?.availability || [])
        setBooking(res.data.data?.booking || null)
      } catch (err) {
        setError(err?.response?.data?.error?.message || 'Failed to load scheduling availability.')
      } finally {
        setIsLoading(false)
      }
    }

    loadAvailability()
  }, [token])

  const availableCount = useMemo(
    () => availability.reduce((count, day) => count + day.slots.filter((slot) => slot.isAvailable).length, 0),
    [availability],
  )

  const handleSelect = async (slotStartAt) => {
    setSubmitting(slotStartAt)
    setError(null)
    try {
      const res = await consultationApi.selectSlot({ token, slotStartAt })
      setSuccess(res.data.data?.booking || null)
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) {
        setError(err?.response?.data?.error?.message || 'This slot is no longer available.')
      } else if (status === 404) {
        setError('This scheduling link is invalid or expired. Please contact support@cadgurukul.com.')
      } else {
        setError(err?.response?.data?.error?.message || 'Could not confirm your consultation slot.')
      }
    } finally {
      setSubmitting('')
    }
  }

  if (success) {
    const isDateSpecific = success.type === 'date-specific'
    const d = success.data
    return (
      <>
        {seo}
        <PageShell>
          <div className="text-center">
            <div className="mb-4 text-6xl">🎉</div>
            <h1 className="mb-2 text-3xl font-extrabold text-gray-900">Your Session Is Locked In</h1>
            <p className="mx-auto mb-6 max-w-xl text-sm text-gray-600">
              Your `₹9,999` counselling session is scheduled for <strong className="text-orange-600">{fmtDateTime(success.scheduledStartAt)}</strong>.
            </p>

            <div className="mx-auto mb-6 max-w-md rounded-3xl border border-orange-200 bg-orange-50 p-5 text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Meeting Link</div>
              <a
                href={success.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Join My Session
              </a>
              <div className="mt-3 break-all text-xs text-orange-700">{success.meetingLink}</div>
            </div>

            <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Counsellor</div>
              <div className="text-lg font-bold text-gray-900">{success.counsellorName}</div>
              <div className="mt-1 text-sm text-gray-500">{success.counsellorContact}</div>
            </div>
          </div>
        </PageShell>
      </>
    )
  }

  return (
    <>
      {seo}
      <PageShell>
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">📅</div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">Choose Your Exact Session Slot</h1>
          <p className="mx-auto max-w-xl text-sm text-gray-600">
            Pick the date and time that works best for your family. Your meeting link will be generated instantly after confirmation.
          </p>
          {booking?.counsellorName && (
            <div className="mt-4 inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700">
              Counsellor: {booking.counsellorName}
            </div>
          )}
        </div>

        {!token && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            No scheduling token found. Please use the full link from your email.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
          </div>
        )}
        {error && <AlertBox type="error">{error}</AlertBox>}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm text-orange-800">
              <span className="font-semibold">{availableCount} slots available right now</span>
              <span className="text-orange-500">•</span>
              <span>Timezone: Asia/Kolkata</span>
              <span className="text-orange-500">•</span>
              <span>Parents can join the same meeting link</span>
            </div>

            <div className="space-y-6">
              {availability.map((day) => (
                <section key={day.date} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{day.date}</div>
                      <div className="text-xl font-bold text-gray-900">{day.label}</div>
                    </div>
                    <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {day.slots.filter((slot) => slot.isAvailable).length} open
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {day.slots.map((slot) => {
                      const busy = submitting === slot.startsAtIso
                      return (
                        <button
                          key={slot.key}
                          onClick={() => slot.isAvailable && handleSelect(slot.startsAtIso)}
                          disabled={!slot.isAvailable || busy}
                          className={`rounded-2xl border p-4 text-left transition ${
                            slot.isAvailable
                              ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:shadow-sm'
                              : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-gray-900">
                                {new Date(slot.startsAtIso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {new Date(slot.endsAtIso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} IST
                              </div>
                            </div>
                            <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              slot.isAvailable
                                ? 'bg-emerald-100 text-emerald-700'
                                : slot.isBooked
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-200 text-gray-600'
                            }`}>
                              {busy ? 'Booking…' : slot.isAvailable ? 'Available' : slot.unavailableReason || 'Unavailable'}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </PageShell>
    </>
  )
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,237,213,0.9),_rgba(255,255,255,0.98)_45%,_rgba(255,247,237,0.95)_100%)] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-orange-100 bg-white px-5 py-3 shadow-sm">
            <span className="text-2xl">🎓</span>
            <span className="text-lg font-extrabold tracking-tight text-gray-900">CAD Gurukul</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">Career Blueprint Session Scheduler</div>
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-white/95 p-8 shadow-xl shadow-orange-100/60">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Need help? <a href="mailto:support@cadgurukul.com" className="text-orange-500 underline">support@cadgurukul.com</a>
        </p>
      </div>
    </div>
  )
}
