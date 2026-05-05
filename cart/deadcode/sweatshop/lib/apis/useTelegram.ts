import { useAPI, useAPIMutation, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface TelegramConfig { botToken?: string; }

export function useTelegram(config?: TelegramConfig) {
  const keys = useServiceKey('telegram');
  const token = config?.botToken ?? keys.botToken;
  const base = token ? `https://api.telegram.org/bot${token}` : null;

  const me = () => useAPI<any>(base ? `${base}/getMe` : null);
  const updates = (offset?: number) =>
    useAPI<any>(base ? `${base}/getUpdates?${qs({ offset, limit: 20 })}` : null);
  const sendMessage = () => useAPIMutation<any>(base ? `${base}/sendMessage` : '', { method: 'POST', headers: { 'Content-Type': 'application/json' } });

  return { me, updates, sendMessage };
}
