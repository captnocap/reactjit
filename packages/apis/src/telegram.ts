/**
 * Telegram Bot API hooks.
 * Auth: Bot token in URL path. Get one from @BotFather.
 */

import { useAPI, useAPIMutation, qs, type APIResult } from './base';

// ── Types ───────────────────────────────────────────────

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: Array<{ file_id: string; width: number; height: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
  reply_to_message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

// ── Hooks ───────────────────────────────────────────────

function tgUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

export function useTelegramBot(
  botToken: string | null,
): APIResult<{ ok: boolean; result: TelegramBotInfo }> {
  return useAPI(
    botToken ? tgUrl(botToken, 'getMe') : null,
  );
}

export function useTelegramUpdates(
  botToken: string | null,
  opts?: { offset?: number; limit?: number; interval?: number },
): APIResult<{ ok: boolean; result: TelegramUpdate[] }> {
  return useAPI(
    botToken
      ? tgUrl(botToken, `getUpdates${qs({ offset: opts?.offset, limit: opts?.limit ?? 20 })}`)
      : null,
    { interval: opts?.interval ?? 5000 },
  );
}

export function useTelegramSend(botToken: string | null) {
  const { execute, loading, error } = useAPIMutation();
  return {
    sendMessage: (chatId: number | string, text: string, opts?: { parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'; replyToMessageId?: number }) =>
      botToken
        ? execute(tgUrl(botToken, 'sendMessage'), {
            body: {
              chat_id: chatId,
              text,
              parse_mode: opts?.parseMode,
              reply_to_message_id: opts?.replyToMessageId,
            },
          })
        : Promise.reject(new Error('No bot token')),
    sendPhoto: (chatId: number | string, photoUrl: string, opts?: { caption?: string }) =>
      botToken
        ? execute(tgUrl(botToken, 'sendPhoto'), {
            body: { chat_id: chatId, photo: photoUrl, caption: opts?.caption },
          })
        : Promise.reject(new Error('No bot token')),
    loading,
    error,
  };
}
