/**
 * Google Calendar and Google Sheets API hooks.
 * Auth: OAuth2 Bearer token or API key.
 */

import { useAPI, useAPIMutation, bearer, qs, type APIResult } from './base';

// ── Calendar Types ──────────────────────────────────────

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  timeZone: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status: string;
  htmlLink: string;
  creator?: { email: string; displayName?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus: string }>;
  recurrence?: string[];
  colorId?: string;
}

export interface GoogleCalendarList {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  summary: string;
  timeZone: string;
}

// ── Calendar Hooks ──────────────────────────────────────

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

export function useGoogleCalendars(
  token: string | null,
): APIResult<{ items: GoogleCalendar[] }> {
  return useAPI(
    token ? `${CAL_BASE}/users/me/calendarList` : null,
    { headers: bearer(token!) },
  );
}

export function useGoogleCalendarEvents(
  token: string | null,
  opts?: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
  },
): APIResult<GoogleCalendarList> {
  const calId = encodeURIComponent(opts?.calendarId ?? 'primary');
  const timeMin = opts?.timeMin ?? new Date().toISOString();
  return useAPI(
    token
      ? `${CAL_BASE}/calendars/${calId}/events${qs({
          timeMin,
          timeMax: opts?.timeMax,
          maxResults: opts?.maxResults ?? 50,
          singleEvents: opts?.singleEvents ?? true,
          orderBy: opts?.orderBy ?? 'startTime',
        })}`
      : null,
    { headers: bearer(token!) },
  );
}

export function useGoogleCalendarMutation(token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? bearer(token) : undefined);
  return {
    createEvent: (calendarId: string, event: { summary: string; start: any; end: any; description?: string; location?: string }) =>
      execute(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, { body: event }),
    deleteEvent: (calendarId: string, eventId: string) =>
      execute(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: 'DELETE' }),
    loading,
    error,
  };
}

// ── Sheets Types ────────────────────────────────────────

export interface GoogleSheet {
  spreadsheetId: string;
  properties: { title: string; locale: string; timeZone: string };
  sheets: Array<{
    properties: { sheetId: number; title: string; index: number };
  }>;
}

export interface GoogleSheetValues {
  range: string;
  majorDimension: string;
  values: string[][];
}

// ── Sheets Hooks ────────────────────────────────────────

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export function useGoogleSheet(
  token: string | null,
  spreadsheetId: string | null,
): APIResult<GoogleSheet> {
  return useAPI(
    token && spreadsheetId ? `${SHEETS_BASE}/${spreadsheetId}` : null,
    { headers: bearer(token!) },
  );
}

export function useGoogleSheetValues(
  token: string | null,
  spreadsheetId: string | null,
  range: string | null,
): APIResult<GoogleSheetValues> {
  return useAPI(
    token && spreadsheetId && range
      ? `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
      : null,
    { headers: bearer(token!) },
  );
}

export function useGoogleSheetMutation(token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? bearer(token) : undefined);
  return {
    append: (spreadsheetId: string, range: string, values: string[][]) =>
      execute(
        `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append${qs({ valueInputOption: 'USER_ENTERED' })}`,
        { body: { values } },
      ),
    update: (spreadsheetId: string, range: string, values: string[][]) =>
      execute(
        `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}${qs({ valueInputOption: 'USER_ENTERED' })}`,
        { method: 'PUT', body: { values } },
      ),
    loading,
    error,
  };
}
