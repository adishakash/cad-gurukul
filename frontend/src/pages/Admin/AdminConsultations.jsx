import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminConsultationApi } from '../../services/api'
import ThemeToggle from '../../components/ThemeToggle'

const STATUS_OPTIONS = [
  'slot_mail_sent',
  'meeting_scheduled',
  'meeting_completed',
  'counselling_report_ready',
]

const fmtDateTime = (value) => {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const toDateInput = (value) => {
  const date = value ? new Date(value) : new Date()
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10)
}

const toDateTimeInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16)
}

const StatCard = ({ label, value, tone = 'default' }) => (
  <div className={`rounded-2xl border p-4 ${
    tone === 'accent'
      ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30'
      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
  }`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-gray-100">{value}</div>
  </div>
)

function BookingCard({ booking, onRefresh }) {
  const [status, setStatus] = useState(booking.status)
  const [meetingNotes, setMeetingNotes] = useState(booking.meetingNotes || '')
  const [scheduledStartAt, setScheduledStartAt] = useState(toDateTimeInput(booking.scheduledStartAt))
  const [saving, setSaving] = useState(false)

  const saveUpdate = async (payload, message) => {
    setSaving(true)
    try {
      await adminConsultationApi.updateBooking(booking.id, payload)
      toast.success(message)
      onRefresh()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action, message) => {
    setSaving(true)
    try {
      await adminConsultationApi.updateBooking(booking.id, { action })
      toast.success(message)
      onRefresh()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Action failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{booking.studentName}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{booking.studentEmail || 'No email'}</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Schedule:</span> {fmtDateTime(booking.scheduledStartAt)}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            24h reminder: {booking.reminder24hSentAt ? fmtDateTime(booking.reminder24hSentAt) : 'Pending'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            2h reminder: {booking.reminder2hSentAt ? fmtDateTime(booking.reminder2hSentAt) : 'Pending'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Follow-up: {booking.followUpSentAt ? fmtDateTime(booking.followUpSentAt) : 'Pending'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Report mail: {booking.counsellingReportSentAt ? fmtDateTime(booking.counsellingReportSentAt) : 'Pending'}
          </div>
          {booking.meetingLink && (
            <a
              href={booking.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Join meeting →
            </a>
          )}
        </div>
        <div className="min-w-[220px] space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Reschedule
            </label>
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Notes
        </label>
        <textarea
          rows={3}
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Internal notes for this meeting"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={saving}
          onClick={() => saveUpdate({ status, meetingNotes }, 'Booking updated.')}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
        >
          Save status + notes
        </button>
        <button
          disabled={saving || !scheduledStartAt}
          onClick={() => saveUpdate({ scheduledStartAt: new Date(scheduledStartAt).toISOString(), meetingNotes }, 'Meeting rescheduled and confirmation mail sent.')}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          Reschedule
        </button>
        <button
          disabled={saving}
          onClick={() => saveUpdate({ status: 'meeting_completed' }, 'Marked as meeting completed.')}
          className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
        >
          Mark completed
        </button>
        <button
          disabled={saving}
          onClick={() => saveUpdate({ status: 'counselling_report_ready' }, 'Marked as counselling report ready.')}
          className="rounded-xl border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950/30"
        >
          Mark report ready
        </button>
        <button
          disabled={saving || !booking.meetingLink}
          onClick={() => runAction('send_24h_reminder', '24-hour reminder sent.')}
          className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
        >
          Send 24h reminder
        </button>
        <button
          disabled={saving || !booking.meetingLink}
          onClick={() => runAction('send_2h_reminder', '2-hour reminder sent.')}
          className="rounded-xl border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-60 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/30"
        >
          Send 2h reminder
        </button>
        <button
          disabled={saving}
          onClick={() => runAction('send_follow_up', 'Follow-up email sent.')}
          className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
        >
          Send follow-up
        </button>
        <button
          disabled={saving}
          onClick={() => runAction('send_report_email', 'Counselling report email sent.')}
          className="rounded-xl border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950/30"
        >
          Send report email
        </button>
      </div>
    </div>
  )
}

export default function AdminConsultations() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(toDateInput())
  const [days, setDays] = useState(10)
  const [blockReason, setBlockReason] = useState('')
  const [blockingKey, setBlockingKey] = useState(null)

  const admin = JSON.parse(localStorage.getItem('cg_admin') || '{}')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await adminConsultationApi.list({ from: fromDate, days })
      setData(res.data.data)
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error('Session expired.')
        navigate('/admin/login')
        return
      }
      toast.error(err?.response?.data?.error?.message || 'Failed to load consultations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('cg_admin_token')) navigate('/admin/login')
    else loadData()
  }, [])

  const blockFullDay = async (date) => {
    setBlockingKey(`day-${date}`)
    try {
      await adminConsultationApi.block({ date, reason: blockReason || 'Blocked by admin' })
      toast.success('Day blocked.')
      setBlockReason('')
      loadData()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to block day.')
    } finally {
      setBlockingKey(null)
    }
  }

  const blockSlot = async (slot) => {
    setBlockingKey(slot.key)
    try {
      await adminConsultationApi.block({
        startAt: slot.startsAtIso,
        endAt: slot.endsAtIso,
        reason: blockReason || 'Blocked by admin',
      })
      toast.success('Slot blocked.')
      setBlockReason('')
      loadData()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to block slot.')
    } finally {
      setBlockingKey(null)
    }
  }

  const matchingBlockForSlot = (slot) => data?.blocks?.find((block) => {
    const blockStart = new Date(block.startsAt).getTime()
    const blockEnd = new Date(block.endsAt).getTime()
    const slotStart = new Date(slot.startsAtIso).getTime()
    const slotEnd = new Date(slot.endsAtIso).getTime()
    return block.isActive && blockStart < slotEnd && slotStart < blockEnd
  })

  const unblock = async (blockId) => {
    setBlockingKey(blockId)
    try {
      await adminConsultationApi.unblock(blockId)
      toast.success('Availability restored.')
      loadData()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to unblock.')
    } finally {
      setBlockingKey(null)
    }
  }

  const stats = useMemo(() => {
    const bookings = data?.bookings || []
    return {
      pending: bookings.filter((booking) => booking.status === 'slot_mail_sent').length,
      scheduled: bookings.filter((booking) => booking.status === 'meeting_scheduled').length,
      completed: bookings.filter((booking) => booking.status === 'meeting_completed').length,
      reportReady: bookings.filter((booking) => booking.status === 'counselling_report_ready').length,
      blocked: (data?.blocks || []).filter((block) => block.isActive).length,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-brand-dark px-6 py-3 text-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold">📅 Consultation Ops</span>
            <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs">{admin.role || 'ADMIN'}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-sm text-gray-300 hover:text-white">Dashboard</Link>
            <Link to="/admin/leads" className="text-sm text-gray-300 hover:text-white">Leads</Link>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Consultation calendar</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Live scheduling board for the `₹9,999` counselling plan.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Days</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {[7, 10, 14, 21].map((option) => (
                  <option key={option} value={option}>{option} days</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Awaiting slot pick" value={stats.pending} />
          <StatCard label="Scheduled meetings" value={stats.scheduled} tone="accent" />
          <StatCard label="Completed sessions" value={stats.completed} />
          <StatCard label="Report ready" value={stats.reportReady} />
          <StatCard label="Active blocks" value={stats.blocked} />
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Block reason
          </label>
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Optional note shown in admin records"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-3">
              <div className="flex min-w-max gap-4">
                {(data?.availability || []).map((day) => (
                  <div key={day.date} className="w-[280px] rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{day.date}</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{day.label}</div>
                      </div>
                      <button
                        onClick={() => blockFullDay(day.date)}
                        disabled={Boolean(blockingKey)}
                        className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {blockingKey === `day-${day.date}` ? 'Blocking…' : 'Block day'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {day.slots.map((slot) => {
                        const block = matchingBlockForSlot(slot)
                        return (
                          <div
                            key={slot.key}
                            className={`rounded-2xl border p-3 ${
                              slot.isAvailable
                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
                                : slot.isBooked
                                  ? 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20'
                                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                            }`}
                          >
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{slot.label.split('(')[1]?.replace(')', '') || slot.label}</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{slot.label.split('(')[0].trim()}</div>
                            <div className="mt-2 text-xs font-semibold">
                              {slot.isAvailable && <span className="text-emerald-700 dark:text-emerald-300">Available</span>}
                              {slot.isBooked && <span className="text-orange-700 dark:text-orange-300">Booked by {slot.bookedBy}</span>}
                              {!slot.isAvailable && !slot.isBooked && <span className="text-gray-600 dark:text-gray-300">{slot.unavailableReason || 'Unavailable'}</span>}
                            </div>
                            <div className="mt-3 flex gap-2">
                              {slot.isAvailable ? (
                                <button
                                  onClick={() => blockSlot(slot)}
                                  disabled={Boolean(blockingKey)}
                                  className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
                                >
                                  {blockingKey === slot.key ? 'Blocking…' : 'Block slot'}
                                </button>
                              ) : block ? (
                                <button
                                  onClick={() => unblock(block.id)}
                                  disabled={Boolean(blockingKey)}
                                  className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/20"
                                >
                                  {blockingKey === block.id ? 'Working…' : 'Unblock'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bookings</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">{(data?.bookings || []).length} records</div>
              </div>

              {(data?.bookings || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  No consultation bookings found for this window.
                </div>
              ) : (
                data.bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onRefresh={loadData} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
