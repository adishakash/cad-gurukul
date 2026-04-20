import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminSchedulingApi } from '../../services/api'
import ThemeToggle from '../../components/ThemeToggle'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  slot_mail_sent:          { label: 'Email Sent',     color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  slot_selected:           { label: 'Slot Selected',  color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  meeting_scheduled:       { label: 'Scheduled',      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  meeting_completed:       { label: 'Completed',      color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  counselling_report_ready:{ label: 'Report Ready',   color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
}

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-indigo-600 text-white shadow'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    {children}
  </button>
)

// ── Slot card for the grid view ──────────────────────────────────────────────

const SlotCard = ({ slot, onBlock, onUnblock, onDelete }) => {
  const isBooked   = slot.isBooked
  const isBlocked  = slot.isBlocked
  const isFree     = !isBooked && !isBlocked

  const cardColor  = isBooked
    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30'
    : isBlocked
    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
    : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30'

  const student = slot.booking?.user?.studentProfile?.fullName
    || slot.booking?.user?.email
    || null

  return (
    <div className={`rounded-xl border-2 p-4 flex flex-col gap-2 text-sm ${cardColor}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-800 dark:text-gray-100 text-xs uppercase tracking-wide">
          {slot.dateStr}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isBooked  ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200' :
          isBlocked ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
          'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
        }`}>
          {isBooked ? 'Booked' : isBlocked ? 'Blocked' : 'Open'}
        </span>
      </div>

      <p className="text-gray-700 dark:text-gray-200 font-semibold">{slot.timeStr}</p>
      <p className="text-gray-500 dark:text-gray-400 text-xs">{slot.label}</p>

      {isBooked && student && (
        <div className="mt-1 p-2 rounded-lg bg-white/60 dark:bg-black/20 text-xs">
          <div className="font-semibold text-gray-700 dark:text-gray-200">👤 {student}</div>
          {slot.booking?.user?.email && (
            <div className="text-gray-500 dark:text-gray-400">{slot.booking.user.email}</div>
          )}
          {slot.booking?.googleMeetLink && (
            <a
              href={slot.booking.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline mt-1 block truncate"
            >
              📹 {slot.booking.googleMeetLink}
            </a>
          )}
          <StatusBadge status={slot.booking?.status} />
        </div>
      )}

      {isFree && (
        <button
          onClick={() => onBlock(slot.id)}
          className="mt-auto text-xs text-red-600 dark:text-red-400 hover:underline text-left"
        >
          Block slot
        </button>
      )}
      {isBlocked && (
        <button
          onClick={() => onUnblock(slot.id)}
          className="mt-auto text-xs text-green-600 dark:text-green-400 hover:underline text-left"
        >
          Re-open slot
        </button>
      )}
      {isFree && (
        <button
          onClick={() => onDelete(slot.id)}
          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:underline text-left"
        >
          Delete
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const TIME_PRESETS = [
  { startTime: '09:00', endTime: '12:00', label: 'Morning — 9:00 AM to 12:00 PM' },
  { startTime: '14:00', endTime: '17:00', label: 'Afternoon — 2:00 PM to 5:00 PM' },
  { startTime: '18:00', endTime: '21:00', label: 'Evening — 6:00 PM to 9:00 PM' },
]

export default function AdminScheduling() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('slots')

  // ── Slots state ──────────────────────────────────────────────────────────────
  const [slots, setSlots]             = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotFilter, setSlotFilter]   = useState('all')

  // ── New slot form ────────────────────────────────────────────────────────────
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [slotFormDates, setSlotFormDates] = useState([''])
  const [slotFormTimes, setSlotFormTimes] = useState([
    { startTime: '09:00', endTime: '12:00', label: 'Morning — 9:00 AM to 12:00 PM' },
  ])
  const [savingSlots, setSavingSlots] = useState(false)

  // ── Bookings state ───────────────────────────────────────────────────────────
  const [bookings, setBookings]         = useState([])
  const [bookingsTotal, setBookingsTotal] = useState(0)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [bookingPage, setBookingPage]   = useState(1)
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('')

  // ── Booking detail modal ─────────────────────────────────────────────────────
  const [detailBooking, setDetailBooking]   = useState(null)
  const [detailLoading, setDetailLoading]   = useState(false)
  const [editMeetLink, setEditMeetLink]     = useState('')
  const [editStatus, setEditStatus]         = useState('')
  const [savingDetail, setSavingDetail]     = useState(false)

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('cg_admin_token')
    if (!token) navigate('/admin/login')
  }, [])

  // ── Load slots ───────────────────────────────────────────────────────────────
  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    try {
      const res = await adminSchedulingApi.listSlots({
        status: slotFilter === 'all' ? undefined : slotFilter,
        limit: 200,
      })
      setSlots(res.data?.data?.slots || [])
    } catch {
      toast.error('Failed to load slots')
    } finally {
      setSlotsLoading(false)
    }
  }, [slotFilter])

  // ── Load bookings ────────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true)
    try {
      const res = await adminSchedulingApi.listBookings({
        page:   bookingPage,
        limit:  20,
        status: bookingStatusFilter || undefined,
        search: bookingSearch || undefined,
      })
      const result = res.data?.data || {}
      setBookings(result.data || [])
      setBookingsTotal(result.total || 0)
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setBookingsLoading(false)
    }
  }, [bookingPage, bookingSearch, bookingStatusFilter])

  useEffect(() => { if (activeTab === 'slots')    loadSlots()    }, [activeTab, loadSlots])
  useEffect(() => { if (activeTab === 'bookings') loadBookings() }, [activeTab, loadBookings])

  // ── Slot actions ─────────────────────────────────────────────────────────────
  const handleBlock = async (id) => {
    try {
      await adminSchedulingApi.blockSlot(id)
      toast.success('Slot blocked')
      loadSlots()
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to block slot')
    }
  }

  const handleUnblock = async (id) => {
    try {
      await adminSchedulingApi.unblockSlot(id)
      toast.success('Slot re-opened')
      loadSlots()
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to unblock slot')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this slot? This cannot be undone.')) return
    try {
      await adminSchedulingApi.deleteSlot(id)
      toast.success('Slot deleted')
      loadSlots()
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete slot')
    }
  }

  // ── Create slots form ────────────────────────────────────────────────────────
  const addDate = () => setSlotFormDates((d) => [...d, ''])
  const removeDate = (i) => setSlotFormDates((d) => d.filter((_, idx) => idx !== i))
  const updateDate = (i, v) => setSlotFormDates((d) => d.map((x, idx) => idx === i ? v : x))

  const addTimePreset = (preset) => setSlotFormTimes((t) => [...t, { ...preset }])
  const removeTime = (i) => setSlotFormTimes((t) => t.filter((_, idx) => idx !== i))

  const handleCreateSlots = async () => {
    const validDates = slotFormDates.filter(Boolean)
    if (validDates.length === 0) { toast.error('Add at least one date'); return }
    if (slotFormTimes.length === 0) { toast.error('Add at least one time window'); return }

    const slots = []
    for (const d of validDates) {
      for (const t of slotFormTimes) {
        slots.push({ date: d, startTime: t.startTime, endTime: t.endTime, label: t.label })
      }
    }

    setSavingSlots(true)
    try {
      await adminSchedulingApi.createSlots({ slots })
      toast.success(`${slots.length} slot(s) created`)
      setShowSlotForm(false)
      setSlotFormDates([''])
      setSlotFormTimes([TIME_PRESETS[0]])
      loadSlots()
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create slots')
    } finally {
      setSavingSlots(false)
    }
  }

  // ── Booking detail ───────────────────────────────────────────────────────────
  const openBookingDetail = async (id) => {
    setDetailLoading(true)
    try {
      const res = await adminSchedulingApi.getBooking(id)
      const b   = res.data?.data?.booking
      setDetailBooking(b)
      setEditMeetLink(b.googleMeetLink || b.meetingLink || '')
      setEditStatus(b.status)
    } catch {
      toast.error('Failed to load booking detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const saveDetail = async () => {
    if (!detailBooking) return
    setSavingDetail(true)
    try {
      const promises = []
      if (editMeetLink !== (detailBooking.googleMeetLink || detailBooking.meetingLink || '')) {
        promises.push(adminSchedulingApi.setMeetLink(detailBooking.id, editMeetLink))
      }
      if (editStatus !== detailBooking.status) {
        promises.push(adminSchedulingApi.updateBookingStatus(detailBooking.id, { status: editStatus }))
      }
      await Promise.all(promises)
      toast.success('Booking updated')
      setDetailBooking(null)
      loadBookings()
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to save')
    } finally {
      setSavingDetail(false)
    }
  }

  const sendMeetEmail = async (id) => {
    try {
      await adminSchedulingApi.sendMeetEmail(id)
      toast.success('Meet details email sent')
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to send email')
    }
  }

  // ── Grouped slots by date ────────────────────────────────────────────────────
  const groupedSlots = slots.reduce((acc, s) => {
    const key = s.dateStr || s.date
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalOpen   = slots.filter((s) => !s.isBooked && !s.isBlocked).length
  const totalBooked = slots.filter((s) => s.isBooked).length
  const totalBlocked = slots.filter((s) => s.isBlocked).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              ← Dashboard
            </button>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              📅 Scheduling
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Stat summary ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Open Slots',     value: totalOpen,    color: 'text-green-600 dark:text-green-400'  },
            { label: 'Booked Slots',   value: totalBooked,  color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Blocked Slots',  value: totalBlocked, color: 'text-red-600 dark:text-red-400'       },
          ].map(({ label, value, color }) => (
            <div key={label} className="card text-center py-5">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <TabBtn active={activeTab === 'slots'}    onClick={() => setActiveTab('slots')}>📆 Slot Calendar</TabBtn>
          <TabBtn active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')}>📋 Bookings</TabBtn>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SLOT CALENDAR TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'slots' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {['all', 'available', 'booked', 'blocked'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSlotFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                      slotFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSlotForm(!showSlotForm)}
                className="btn-primary text-sm"
              >
                + Add Slots
              </button>
            </div>

            {/* Create slot form */}
            {showSlotForm && (
              <div className="card space-y-5">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">Create Availability Slots</h3>

                {/* Dates */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                    Dates
                  </label>
                  <div className="space-y-2">
                    {slotFormDates.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={d}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => updateDate(i, e.target.value)}
                          className="input-field w-48"
                        />
                        {slotFormDates.length > 1 && (
                          <button onClick={() => removeDate(i)} className="text-red-500 text-xs hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addDate} className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline">
                      + Add another date
                    </button>
                  </div>
                </div>

                {/* Time windows */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                    Time Windows
                  </label>
                  <div className="space-y-2 mb-3">
                    {slotFormTimes.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-200 flex-1">{t.label}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{t.startTime}–{t.endTime}</span>
                        <button onClick={() => removeTime(i)} className="text-red-500 text-xs hover:underline">Remove</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {TIME_PRESETS.map((p) => (
                      <button
                        key={p.startTime}
                        onClick={() => addTimePreset(p)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        + {p.label.split(' — ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview count */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This will create <strong>{slotFormDates.filter(Boolean).length * slotFormTimes.length}</strong> slot(s).
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateSlots}
                    disabled={savingSlots}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {savingSlots ? 'Creating…' : 'Create Slots'}
                  </button>
                  <button
                    onClick={() => setShowSlotForm(false)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Calendar grid */}
            {slotsLoading ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">Loading slots…</div>
            ) : Object.keys(groupedSlots).length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                No slots found. Click <strong>+ Add Slots</strong> to create availability.
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedSlots).map(([dateStr, daySlots]) => (
                  <div key={dateStr}>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      {dateStr}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {daySlots.map((s) => (
                        <SlotCard
                          key={s.id}
                          slot={s}
                          onBlock={handleBlock}
                          onUnblock={handleUnblock}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            BOOKINGS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'bookings' && (
          <div className="space-y-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search by name or email…"
                value={bookingSearch}
                onChange={(e) => { setBookingSearch(e.target.value); setBookingPage(1) }}
                className="input-field w-64 text-sm"
              />
              <select
                value={bookingStatusFilter}
                onChange={(e) => { setBookingStatusFilter(e.target.value); setBookingPage(1) }}
                className="input-field w-48 text-sm"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button onClick={loadBookings} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                Refresh
              </button>
            </div>

            {bookingsLoading ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading bookings…</div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">No bookings found.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                        {['Student', 'Email', 'Scheduled', 'Status', 'Meet Link', 'Actions'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => {
                        const studentName  = b.user?.studentProfile?.fullName || b.user?.email?.split('@')[0] || '—'
                        const scheduledStr = b.availabilitySlot
                          ? `${b.availabilitySlot.label}`
                          : b.selectedSlot || '—'
                        const meetLink = b.googleMeetLink || b.meetingLink
                        return (
                          <tr key={b.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{studentName}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.user?.email || '—'}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[180px] truncate">{scheduledStr}</td>
                            <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                            <td className="px-4 py-3">
                              {meetLink ? (
                                <a href={meetLink} target="_blank" rel="noopener noreferrer"
                                   className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs truncate block max-w-[160px]">
                                  {meetLink}
                                </a>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">Not set</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openBookingDetail(b.id)}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                >
                                  Edit
                                </button>
                                {meetLink && (
                                  <button
                                    onClick={() => sendMeetEmail(b.id)}
                                    className="text-xs text-green-600 dark:text-green-400 hover:underline"
                                  >
                                    Resend Email
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{bookingsTotal} total bookings</span>
                  <div className="flex gap-2">
                    <button
                      disabled={bookingPage === 1}
                      onClick={() => setBookingPage((p) => p - 1)}
                      className="px-3 py-1 rounded border dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs"
                    >
                      ← Prev
                    </button>
                    <span className="px-3 py-1 text-xs">Page {bookingPage}</span>
                    <button
                      disabled={bookings.length < 20}
                      onClick={() => setBookingPage((p) => p + 1)}
                      className="px-3 py-1 rounded border dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Booking detail modal ── */}
      {(detailBooking || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !savingDetail && setDetailBooking(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="text-center py-10 text-gray-400">Loading…</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Booking Detail</h2>
                  <button onClick={() => setDetailBooking(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
                </div>

                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500 dark:text-gray-400">Student: </span>
                    <strong>{detailBooking.user?.studentProfile?.fullName || detailBooking.user?.email || '—'}</strong></p>
                  <p><span className="text-gray-500 dark:text-gray-400">Email: </span>{detailBooking.user?.email || '—'}</p>
                  <p><span className="text-gray-500 dark:text-gray-400">Booking ID: </span><code className="text-xs">{detailBooking.id}</code></p>
                  {detailBooking.availabilitySlot && (
                    <p><span className="text-gray-500 dark:text-gray-400">Scheduled: </span>
                      <strong>{detailBooking.availabilitySlot.label}</strong></p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Meet link */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
                    Google Meet Link
                  </label>
                  <input
                    type="url"
                    value={editMeetLink}
                    onChange={(e) => setEditMeetLink(e.target.value)}
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    className="input-field w-full text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveDetail}
                    disabled={savingDetail}
                    className="btn-primary text-sm flex-1 disabled:opacity-50"
                  >
                    {savingDetail ? 'Saving…' : 'Save Changes'}
                  </button>
                  {(editMeetLink || detailBooking.googleMeetLink || detailBooking.meetingLink) && (
                    <button
                      onClick={() => { sendMeetEmail(detailBooking.id); setDetailBooking(null) }}
                      className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      📧 Send Meet Email
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
