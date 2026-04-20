'use strict';
/**
 * googleMeetService.js — Phase 10
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates Google Calendar events with a Google Meet link attached.
 *
 * Prerequisites (set in environment):
 *   GOOGLE_CALENDAR_ENABLED=true
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN   (obtained via OAuth2 consent for the admin calendar)
 *   GOOGLE_CALENDAR_ID     (defaults to "primary")
 *   GOOGLE_CALENDAR_TIMEZONE (defaults to "Asia/Kolkata")
 *
 * When GOOGLE_CALENDAR_ENABLED is false (or credentials are missing), the
 * service returns a graceful fallback object so the rest of the booking flow
 * continues uninterrupted.  Admin can later update the meetingLink manually.
 */

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const config  = require('../../config');
const logger  = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build an RFC 3339 dateTime string for a given date + HH:MM + timezone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combine a Date (used for year/month/day) and a time string "HH:MM"
 * into an ISO-8601 string that Google Calendar accepts.
 * We append the IST offset (+05:30) directly so no server-side TZ conversion
 * is needed.
 *
 * @param {Date}   date      - JS Date object (date portion used only)
 * @param {string} timeStr   - "09:00" or "14:00" (24-hour IST)
 * @returns {string}         - "2026-06-25T09:00:00+05:30"
 */
function buildDateTimeIST(date, timeStr) {
  const y   = date.getUTCFullYear();
  const m   = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d   = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${timeStr}:00+05:30`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy OAuth2 client — only constructed when feature is enabled
// ─────────────────────────────────────────────────────────────────────────────

let _calendarClient = null;

function getCalendarClient() {
  if (_calendarClient) return _calendarClient;

  const oauth2 = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  oauth2.setCredentials({ refresh_token: config.google.refreshToken });
  _calendarClient = google.calendar({ version: 'v3', auth: oauth2 });
  return _calendarClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// createMeetEvent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Google Calendar event with a Google Meet link.
 *
 * @param {object} params
 * @param {string} params.bookingId          - Used as idempotency key
 * @param {string} params.studentName
 * @param {string} params.studentEmail
 * @param {Date}   params.date               - The calendar date of the session
 * @param {string} params.startTime          - "09:00" (IST, 24-hour)
 * @param {string} params.endTime            - "12:00" (IST, 24-hour)
 * @param {string} params.counsellorName
 * @param {string} params.counsellorEmail
 *
 * @returns {Promise<{meetLink: string, eventId: string, isReal: boolean}>}
 *   isReal=false when credentials are missing or feature is disabled.
 */
async function createMeetEvent({
  bookingId,
  studentName,
  studentEmail,
  date,
  startTime,
  endTime,
  counsellorName,
  counsellorEmail,
}) {
  // ── Feature-flag guard ────────────────────────────────────────────────────
  if (
    !config.google.enabled ||
    !config.google.clientId ||
    !config.google.clientSecret ||
    !config.google.refreshToken
  ) {
    logger.warn('[GoogleMeet] Feature disabled or credentials missing — returning placeholder', {
      bookingId,
    });
    return {
      meetLink: 'https://meet.google.com/pending-admin-setup',
      eventId:  null,
      isReal:   false,
    };
  }

  try {
    const calendar   = getCalendarClient();
    const startDT    = buildDateTimeIST(date, startTime);
    const endDT      = buildDateTimeIST(date, endTime);
    const requestId  = `cg-${bookingId}`.slice(0, 36); // max 36 chars for Google

    const attendees = [{ email: studentEmail }];
    if (counsellorEmail) attendees.push({ email: counsellorEmail });

    const event = await calendar.events.insert({
      calendarId: config.google.calendarId || 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Career Blueprint Session — ${studentName}`,
        description: `1:1 Career Counselling session with ${counsellorName} for ${studentName}.\n\nBooking ID: ${bookingId}`,
        start: {
          dateTime: startDT,
          timeZone: config.google.timezone || 'Asia/Kolkata',
        },
        end: {
          dateTime: endDT,
          timeZone: config.google.timezone || 'Asia/Kolkata',
        },
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email',  minutes: 60 },
            { method: 'popup',  minutes: 15 },
          ],
        },
        guestsCanSeeOtherGuests: false,
      },
    });

    const meetLink = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.[0]?.uri || '';
    const eventId  = event.data.id;

    logger.info('[GoogleMeet] Event created', { bookingId, eventId, meetLink: meetLink.slice(0, 50) });

    return { meetLink, eventId, isReal: true };
  } catch (err) {
    logger.error('[GoogleMeet] Failed to create calendar event', {
      bookingId,
      error: err.message,
      code:  err.code,
    });
    // Graceful fallback — booking continues, admin updates link manually
    return {
      meetLink: 'https://meet.google.com/pending-admin-setup',
      eventId:  null,
      isReal:   false,
      error:    err.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateMeetEvent — update an existing event (e.g. when slot changes)
// ─────────────────────────────────────────────────────────────────────────────

async function updateMeetEvent({ eventId, date, startTime, endTime }) {
  if (!config.google.enabled || !eventId) return null;

  try {
    const calendar = getCalendarClient();
    await calendar.events.patch({
      calendarId: config.google.calendarId || 'primary',
      eventId,
      requestBody: {
        start: {
          dateTime: buildDateTimeIST(date, startTime),
          timeZone: config.google.timezone || 'Asia/Kolkata',
        },
        end: {
          dateTime: buildDateTimeIST(date, endTime),
          timeZone: config.google.timezone || 'Asia/Kolkata',
        },
      },
    });
    logger.info('[GoogleMeet] Event updated', { eventId });
    return true;
  } catch (err) {
    logger.error('[GoogleMeet] Failed to update event', { eventId, error: err.message });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteMeetEvent — cancel when booking is cancelled
// ─────────────────────────────────────────────────────────────────────────────

async function deleteMeetEvent(eventId) {
  if (!config.google.enabled || !eventId) return null;

  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({
      calendarId: config.google.calendarId || 'primary',
      eventId,
    });
    logger.info('[GoogleMeet] Event deleted', { eventId });
    return true;
  } catch (err) {
    logger.error('[GoogleMeet] Failed to delete event', { eventId, error: err.message });
    return null;
  }
}

module.exports = { createMeetEvent, updateMeetEvent, deleteMeetEvent };
