const React: any = require('react');
const { useState } = React;

import { Box, Text, ScrollView, TextInput, TextArea } from '../runtime/primitives';

function Field(props: any) {
  return (
    <Box style={{ gap: 6 }}>
      <Text fontSize={11} color="#f8fafc">{props.label}</Text>
      {props.children}
    </Box>
  );
}

export default function InputLab() {
  const [name, setName] = useState('Ada');
  const [query, setQuery] = useState('bridge parity');
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState('multi-line ready');
  const [activeField, setActiveField] = useState('none');
  const [hovered, setHovered] = useState(false);
  const [submitInfo, setSubmitInfo] = useState('none');
  const [scrollInfo, setScrollInfo] = useState('idle');
  const [hScrollInfo, setHScrollInfo] = useState('idle');
  const [rightClicks, setRightClicks] = useState(0);
  const [events, setEvents] = useState([
    'Type into the fields to verify controlled updates.',
    'Press Enter in the submit field to append an event.',
  ]);

  function pushEvent(line: string) {
    setEvents((prev: string[]) => {
      const next = prev.slice(-7);
      next.push(line);
      return next;
    });
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#081018' }}>
      <ScrollView style={{ flexGrow: 1, padding: 18, gap: 16 }}>
        <Box style={{ gap: 8 }}>
          <Text fontSize={18} color="#f8fafc">QJS Input Lab</Text>
          <Text fontSize={10} color="#94a3b8">
            Controlled value props, multiline input, and submit handlers on the real engine path.
          </Text>
        </Box>

        <Box style={{ gap: 6, padding: 12, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#162033', borderRadius: 8 }}>
          <Text fontSize={10} color="#e2e8f0">{`active field = ${activeField}`}</Text>
          <Text fontSize={10} color="#fbbf24">{`last submit = ${submitInfo}`}</Text>
          <Text fontSize={10} color="#93c5fd">{`hover status = ${hovered ? 'inside' : 'outside'}`}</Text>
          <Text fontSize={10} color="#93c5fd">{`right click count = ${rightClicks}`}</Text>
          <Text fontSize={10} color="#67e8f9">{`vertical scroll = ${scrollInfo}`}</Text>
          <Text fontSize={10} color="#7dd3fc">{`horizontal scroll = ${hScrollInfo}`}</Text>
        </Box>

        <Field label="Controlled TextInput via onChangeText">
          <TextInput
            value={name}
            placeholder="Name"
            fontSize={12}
            style={{ height: 34, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
            onChangeText={(text: string) => {
              setName(text);
              pushEvent(`onChangeText -> ${text}`);
            }}
            onFocus={() => {
              setActiveField('name');
              pushEvent('focus -> name');
            }}
            onBlur={() => {
              setActiveField((prev: string) => prev === 'name' ? 'none' : prev);
              pushEvent('blur -> name');
            }}
          />
          <Text fontSize={10} color="#38bdf8">{`state.name = ${name}`}</Text>
        </Field>

        <Field label="Controlled TextInput via onChange alias">
          <TextInput
            value={query}
            placeholder="Search"
            fontSize={12}
            style={{ height: 34, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
            onChange={(text: string) => {
              setQuery(text);
              pushEvent(`onChange -> ${text}`);
            }}
            onFocus={() => {
              setActiveField('query');
              pushEvent('focus -> query');
            }}
            onKeyDown={(payload: any) => {
              pushEvent(`key -> ${payload.keyCode}`);
            }}
            onBlur={() => {
              setActiveField((prev: string) => prev === 'query' ? 'none' : prev);
              pushEvent('blur -> query');
            }}
          />
          <Text fontSize={10} color="#22c55e">{`state.query = ${query}`}</Text>
        </Field>

        <Field label="Submit field">
          <TextInput
            value={draft}
            placeholder="Press Enter to submit"
            fontSize={12}
            style={{ height: 34, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
            onChangeText={setDraft}
            onSubmit={(text: string) => {
              setSubmitInfo(text || '(empty)');
              pushEvent(`onSubmit -> ${text}`);
              setDraft('');
            }}
            onFocus={() => {
              setActiveField('draft');
              pushEvent('focus -> draft');
            }}
            onBlur={() => {
              setActiveField((prev: string) => prev === 'draft' ? 'none' : prev);
              pushEvent('blur -> draft');
            }}
          />
          <Text fontSize={10} color="#f59e0b">{`draft = ${draft || '(empty)'}`}</Text>
          <Text fontSize={10} color="#fbbf24">{`last submit = ${submitInfo}`}</Text>
        </Field>

        <Box style={{ gap: 8 }}>
          <Box
            hoverable
            onMouseEnter={() => {
              setHovered(true);
              pushEvent('hover -> enter');
            }}
            onMouseLeave={() => {
              setHovered(false);
              pushEvent('hover -> exit');
            }}
            onRightClick={(payload: any) => {
              setRightClicks((count: number) => count + 1);
              pushEvent(`right click -> ${Math.round(payload.x || 0)},${Math.round(payload.y || 0)}`);
            }}
            style={{ padding: 12, backgroundColor: hovered ? '#1d4ed8' : '#132036', borderWidth: 1, borderColor: '#274061', borderRadius: 8 }}
          >
            <Text fontSize={11} color="#e2e8f0">Hover and right-click this box</Text>
            <Text fontSize={10} color="#93c5fd">{`hovered=${hovered} rightClicks=${rightClicks}`}</Text>
          </Box>
        </Box>

        <Field label="Nested ScrollView with onScroll">
          <ScrollView
            onScroll={(payload: any) => {
              const next = `scrollY=${Math.round(payload.scrollY || 0)} deltaY=${Math.round(payload.deltaY || 0)}`;
              setScrollInfo(next);
              pushEvent(`scroll -> ${next}`);
            }}
            style={{ height: 110, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#162033', borderRadius: 8, padding: 10, gap: 8 }}
          >
            {Array.from({ length: 12 }).map((_, index) => (
              <Text key={index} fontSize={10} color="#94a3b8">{`scroll row ${index + 1}`}</Text>
            ))}
          </ScrollView>
          <Text fontSize={10} color="#67e8f9">{`panel vertical = ${scrollInfo}`}</Text>
        </Field>

        <Field label="Horizontal ScrollView with onScroll">
          <ScrollView
            onScroll={(payload: any) => {
              const next = `scrollX=${Math.round(payload.scrollX || 0)} deltaX=${Math.round(payload.deltaX || 0)}`;
              setHScrollInfo(next);
              pushEvent(`hscroll -> ${next}`);
            }}
            style={{ height: 88, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#162033', borderRadius: 8, padding: 10 }}
          >
            <Box style={{ flexDirection: 'row', gap: 10, width: 1200 }}>
              {Array.from({ length: 7 }).map((_, index) => (
                <Box
                  key={index}
                  style={{
                    width: 150,
                    height: 54,
                    padding: 10,
                    backgroundColor: index % 2 === 0 ? '#12304d' : '#1f3f5b',
                    borderWidth: 1,
                    borderColor: '#35597d',
                    borderRadius: 8,
                    gap: 4,
                  }}
                >
                  <Text fontSize={11} color="#e0f2fe">{`lane ${index + 1}`}</Text>
                  <Text fontSize={9} color="#93c5fd">{`card ${index + 1}`}</Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
          <Text fontSize={10} color="#7dd3fc">{`panel horizontal = ${hScrollInfo}`}</Text>
        </Field>

        <Field label="Multiline TextArea">
          <TextArea
            value={notes}
            placeholder="Notes"
            fontSize={11}
            style={{ height: 110, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }}
            onChangeText={(text: string) => {
              setNotes(text);
              pushEvent(`notes len -> ${text.length}`);
            }}
            onFocus={() => {
              setActiveField('notes');
              pushEvent('focus -> notes');
            }}
            onBlur={() => {
              setActiveField((prev: string) => prev === 'notes' ? 'none' : prev);
              pushEvent('blur -> notes');
            }}
          />
          <Text fontSize={10} color="#c084fc">{`notes chars = ${notes.length}`}</Text>
        </Field>

        <Box style={{ gap: 8, padding: 12, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#162033', borderRadius: 8 }}>
          <Text fontSize={11} color="#f8fafc">Event Log</Text>
          {events.map((line: string, index: number) => (
            <Text key={index} fontSize={10} color="#94a3b8">{line}</Text>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}
