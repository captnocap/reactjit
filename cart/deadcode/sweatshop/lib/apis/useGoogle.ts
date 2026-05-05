import { useAPI, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface GoogleConfig { token?: string; }

export function useGoogle(config?: GoogleConfig) {
  const keys = useServiceKey('google');
  const token = config?.token ?? keys.token;
  const headers = token ? bearer(token) : {};
  const base = 'https://www.googleapis.com';

  const userInfo = () => useAPI<any>(token ? `${base}/oauth2/v3/userinfo` : null, { headers });
  const calendarList = () => useAPI<any>(token ? `${base}/calendar/v3/users/me/calendarList` : null, { headers });
  const calendarEvents = (calendarId: string, timeMin?: string, timeMax?: string) => {
    const id = encodeURIComponent(calendarId || 'primary');
    const qs = timeMin ? `&timeMin=${encodeURIComponent(timeMin)}` : '';
    return useAPI<any>(token ? `${base}/calendar/v3/calendars/${id}/events?maxResults=50${qs}` : null, { headers });
  };

  return { userInfo, calendarList, calendarEvents };
}
