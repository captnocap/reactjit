/**
 * Multi-Window Story — One app, N windows, all in sync.
 *
 * Demonstrates the <Window> component: children render in a separate
 * OS window while sharing the same React tree. State flows naturally
 * via props — click something in window 1, window 2 reacts instantly.
 *
 * SDL2 target only (Love2D does not support multiple windows).
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, Window } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>{title}</Text>
      <Box style={{ gap: 6 }}>
        {children}
      </Box>
    </Box>
  );
}

function Button({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress}>
      <Box style={{
        backgroundColor: active ? c.primary : c.surface2,
        borderRadius: 6,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
      }}>
        <Text style={{ fontSize: 11, color: active ? c.background : c.text }}>
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}

function EventLog({ entries }: { entries: string[] }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 2 }}>
      {entries.length === 0 && (
        <Text style={{ fontSize: 10, color: c.textDim }}>{'No events yet'}</Text>
      )}
      {entries.slice(-8).map((entry, i) => (
        <Text key={i} style={{ fontSize: 10, color: c.textDim }}>{entry}</Text>
      ))}
    </Box>
  );
}

/** Content rendered inside a child window */
function DetachedPanel({
  title,
  items,
  selectedIndex,
  onSelect,
}: {
  title: string;
  items: string[];
  selectedIndex: number;
  onSelect: (idx: number) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.background, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 16, color: c.text, fontWeight: 'bold' }}>{title}</Text>
      <Box style={{ gap: 4 }}>
        {items.map((item, i) => (
          <Pressable key={i} onPress={() => onSelect(i)}>
            <Box style={{
              backgroundColor: i === selectedIndex ? c.primary : c.surface1,
              borderRadius: 6,
              padding: 8,
            }}>
              <Text style={{
                fontSize: 12,
                color: i === selectedIndex ? c.background : c.text,
              }}>
                {item}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>
      <Text style={{ fontSize: 10, color: c.textDim }}>
        {'Selected: ' + items[selectedIndex]}
      </Text>
    </Box>
  );
}

export function MultiWindowStory() {
  const c = useThemeColors();

  // Shared state — flows to all windows
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const items = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];

  const logEvent = (msg: string) => {
    setEvents(prev => [...prev.slice(-20), new Date().toLocaleTimeString() + ' ' + msg]);
  };

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
        {'Multi-Window'}
      </Text>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {'One React tree, multiple OS windows, state in sync. SDL2 only.'}
      </Text>

      {/* Controls */}
      <SectionCard title="Window Controls">
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={showPanel ? 'Close Panel' : 'Open Panel'}
            onPress={() => {
              setShowPanel(!showPanel);
              logEvent(showPanel ? 'Panel closed' : 'Panel opened');
            }}
            active={showPanel}
          />
          <Button
            label={showLog ? 'Close Log' : 'Open Log'}
            onPress={() => {
              setShowLog(!showLog);
              logEvent(showLog ? 'Log closed' : 'Log opened');
            }}
            active={showLog}
          />
        </Box>
      </SectionCard>

      {/* Shared state display */}
      <SectionCard title="Shared State (main window)">
        <Text style={{ fontSize: 11, color: c.text }}>
          {'Selected: ' + items[selectedIndex] + ' (index ' + selectedIndex + ')'}
        </Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {items.map((item, i) => (
            <Button
              key={i}
              label={item}
              active={i === selectedIndex}
              onPress={() => {
                setSelectedIndex(i);
                logEvent('Selected ' + item + ' from main window');
              }}
            />
          ))}
        </Box>
      </SectionCard>

      {/* Event log in main window */}
      <SectionCard title="Event Log">
        <EventLog entries={events} />
      </SectionCard>

      {/* Child window: selection panel */}
      {showPanel && (
        <Window
          title="Selection Panel"
          width={300}
          height={400}
          onClose={() => {
            setShowPanel(false);
            logEvent('Panel closed via window button');
          }}
          onFocus={() => logEvent('Panel focused')}
          onBlur={() => logEvent('Panel blurred')}
        >
          <DetachedPanel
            title="Pick an Item"
            items={items}
            selectedIndex={selectedIndex}
            onSelect={(i) => {
              setSelectedIndex(i);
              logEvent('Selected ' + items[i] + ' from panel window');
            }}
          />
        </Window>
      )}

      {/* Child window: live event log */}
      {showLog && (
        <Window
          title="Event Log"
          width={400}
          height={300}
          onClose={() => {
            setShowLog(false);
            logEvent('Log closed via window button');
          }}
        >
          <Box style={{ width: '100%', height: '100%', backgroundColor: c.background, padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>
              {'Live Events'}
            </Text>
            <Text style={{ fontSize: 10, color: c.textDim }}>
              {'This window shows the same event stream as the main window.'}
            </Text>
            <Box style={{ flexGrow: 1, backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 2 }}>
              <EventLog entries={events} />
            </Box>
          </Box>
        </Window>
      )}
    </Box>
  );
}
