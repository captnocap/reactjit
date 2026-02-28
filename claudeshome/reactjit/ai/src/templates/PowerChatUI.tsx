/**
 * PowerChatUI — Full-featured AI chat with all the bells and whistles.
 *
 * Sidebar, settings, model selector, message actions, streaming,
 * error handling — everything wired together and configurable via props.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, type Style, type Color } from '@reactjit/core';
import { useChat } from '../hooks';
import type { ChatOptions, Message, AIConfig } from '../types';
import { AIMessageList } from '../components/AIMessageList';
import { AIChatInput } from '../components/AIChatInput';
import { AISettingsPanel } from '../components/AISettingsPanel';
import { AIConversationSidebar, type Conversation } from '../components/AIConversationSidebar';
import { AIMessageWithActions } from '../components/AIMessageWithActions';

export interface PowerChatUIProps extends ChatOptions {
  /** Title shown in the header */
  title?: string;

  // ── Sidebar ──────────────────────────────────
  /** Show conversation sidebar */
  showSidebar?: boolean;
  /** Conversation list for the sidebar */
  conversations?: Conversation[];
  /** Active conversation ID */
  activeConversationId?: string;
  /** Called when a conversation is selected */
  onSelectConversation?: (id: string) => void;
  /** Called when "New Chat" is pressed */
  onNewChat?: () => void;

  // ── Settings ─────────────────────────────────
  /** Show settings panel toggle */
  showSettings?: boolean;
  /** Initial settings panel open state */
  settingsOpen?: boolean;
  /** Called when config changes via settings panel */
  onConfigChange?: (patch: Partial<AIConfig>) => void;

  // ── Message actions ──────────────────────────
  /** Show action buttons on messages */
  showMessageActions?: boolean;
  /** Called when copy is pressed on a message */
  onCopyMessage?: (content: string) => void;
  /** Called when delete is pressed */
  onDeleteMessage?: (index: number) => void;

  // ── Customization ────────────────────────────
  /** Accent color */
  accentColor?: Color;
  /** Placeholder text */
  placeholder?: string;
  /** Custom message renderer */
  renderMessage?: (message: Message, index: number) => React.ReactNode | null;
  /** Container style */
  style?: Style;
}

export function PowerChatUI({
  title = 'Chat',
  showSidebar = false,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  showSettings = true,
  settingsOpen: initialSettingsOpen = false,
  onConfigChange,
  showMessageActions = true,
  onCopyMessage,
  onDeleteMessage,
  accentColor = '#2563eb',
  placeholder,
  renderMessage,
  style,
  ...chatOptions
}: PowerChatUIProps) {
  const chat = useChat(chatOptions);
  const { messages, send, isLoading, isStreaming, stop, error, setMessages } = chat;
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [localConfig, setLocalConfig] = useState<Partial<AIConfig>>({
    model: chatOptions.model,
    temperature: chatOptions.temperature,
    maxTokens: chatOptions.maxTokens,
    systemPrompt: chatOptions.systemPrompt,
    provider: chatOptions.provider,
  });

  const handleConfigChange = useCallback((patch: Partial<AIConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...patch }));
    onConfigChange?.(patch);
  }, [onConfigChange]);

  const handleCopy = useCallback((content: string) => {
    onCopyMessage?.(content);
  }, [onCopyMessage]);

  const handleDelete = useCallback((index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
    onDeleteMessage?.(index);
  }, [setMessages, onDeleteMessage]);

  const handleRegenerate = useCallback((index: number) => {
    // Find the last user message before this index
    const userMsg = messages.slice(0, index).reverse().find(m => m.role === 'user');
    if (userMsg && typeof userMsg.content === 'string') {
      // Remove messages from index onward and re-send
      setMessages(prev => prev.slice(0, index));
      send(userMsg.content);
    }
  }, [messages, setMessages, send]);

  // Custom renderer that wraps messages with actions
  const messageRenderer = useCallback((msg: Message, i: number) => {
    if (renderMessage) {
      const custom = renderMessage(msg, i);
      if (custom !== null) return custom;
    }

    if (showMessageActions && (msg.role === 'user' || msg.role === 'assistant')) {
      return (
        <AIMessageWithActions
          message={msg}
          index={i}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
        />
      );
    }

    return null; // fall through to default
  }, [showMessageActions, renderMessage, handleCopy, handleDelete, handleRegenerate]);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      flexDirection: 'row',
      backgroundColor: '#0f172a',
      ...style,
    }}>
      {/* Sidebar */}
      {showSidebar && (
        <AIConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNewChat={onNewChat}
        />
      )}

      {/* Main chat area */}
      <Box style={{ flexGrow: 1 }}>
        {/* Header */}
        <Box style={{
          padding: 12,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottomWidth: 1,
          borderColor: '#1e293b',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 'bold' }}>
            {title}
          </Text>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isStreaming && (
              <Pressable onPress={stop}>
                {({ pressed }) => (
                  <Box style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 6,
                    backgroundColor: pressed ? '#7f1d1d' : '#991b1b',
                  }}>
                    <Text style={{ fontSize: 11, color: '#fecaca', fontWeight: 'bold' }}>
                      Stop
                    </Text>
                  </Box>
                )}
              </Pressable>
            )}
            {showSettings && (
              <Pressable onPress={() => setSettingsOpen(v => !v)}>
                {({ pressed, hovered }) => (
                  <Box style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 6,
                    backgroundColor: settingsOpen
                      ? '#1e40af'
                      : pressed
                        ? '#334155'
                        : hovered
                          ? '#1e293b'
                          : 'transparent',
                  }}>
                    <Text style={{ fontSize: 11, color: settingsOpen ? '#bfdbfe' : '#94a3b8', fontWeight: 'bold' }}>
                      Settings
                    </Text>
                  </Box>
                )}
              </Pressable>
            )}
          </Box>
        </Box>

        {/* Error banner */}
        {error && (
          <Box style={{
            padding: 8,
            paddingLeft: 16,
            backgroundColor: '#450a0a',
            borderBottomWidth: 1,
            borderColor: '#7f1d1d',
          }}>
            <Text style={{ fontSize: 12, color: '#fca5a5' }}>
              {error.message}
            </Text>
          </Box>
        )}

        {/* Content area: messages + optional settings */}
        <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
          {/* Messages */}
          <AIMessageList
            messages={messages}
            isStreaming={isStreaming}
            renderMessage={messageRenderer}
            style={{ flexGrow: 1 }}
          />

          {/* Settings panel */}
          {settingsOpen && (
            <Box style={{
              width: 240,
              borderLeftWidth: 1,
              borderColor: '#1e293b',
              backgroundColor: '#0b1120',
            }}>
              <AISettingsPanel
                config={localConfig}
                onChange={handleConfigChange}
              />
            </Box>
          )}
        </Box>

        {/* Input */}
        <Box style={{ padding: 12 }}>
          <AIChatInput
            send={send}
            isLoading={isLoading}
            placeholder={placeholder}
            sendColor={accentColor}
            autoFocus
          />
        </Box>
      </Box>
    </Box>
  );
}
