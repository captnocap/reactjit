/**
 * AIConversationSidebar — Scrollable list of conversations
 * with new chat button and search.
 */

import React, { useState } from 'react';
import { Box, Text, ScrollView, ConversationCard, Pressable, TextInput, type Style } from '@reactjit/core';

export interface Conversation {
  id: string;
  title: string;
  subtitle?: string;
}

export interface AIConversationSidebarProps {
  /** List of conversations */
  conversations: Conversation[];
  /** Currently active conversation ID */
  activeId?: string;
  /** Called when a conversation is selected */
  onSelect?: (id: string) => void;
  /** Called when "New Chat" is pressed */
  onNewChat?: () => void;
  /** Whether to show search */
  showSearch?: boolean;
  /** Width of the sidebar */
  width?: number;
  /** Container style */
  style?: Style;
}

export function AIConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  showSearch = true,
  width = 260,
  style,
}: AIConversationSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.subtitle?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <Box style={{
      width,
      borderRightWidth: 1,
      borderColor: '#1e293b',
      backgroundColor: '#0b1120',
      ...style,
    }}>
      {/* Header */}
      <Box style={{ padding: 12, gap: 8 }}>
        <Pressable onPress={onNewChat}>
          {({ pressed, hovered }) => (
            <Box style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: pressed ? '#1e40af' : hovered ? '#1d4ed8' : '#2563eb',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold' }}>
                New Chat
              </Text>
            </Box>
          )}
        </Pressable>

        {showSearch && (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderColor="#475569"
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 6,
              padding: 6,
            }}
            textStyle={{ color: '#e2e8f0', fontSize: 12 }}
          />
        )}
      </Box>

      {/* Conversation list */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 4, gap: 2 }}>
          {filtered.map(convo => (
            <ConversationCard
              key={convo.id}
              title={convo.title}
              subtitle={convo.subtitle}
              active={convo.id === activeId}
              onPress={() => onSelect?.(convo.id)}
            />
          ))}
          {filtered.length === 0 && (
            <Box style={{ padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#475569' }}>
                {search ? 'No results' : 'No conversations'}
              </Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
