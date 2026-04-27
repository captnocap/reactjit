import { useRef, useState, createContext, useContext } from 'react';
import { Box, Col, Pressable, Text, TextInput } from '../../../../runtime/primitives';
import type { FormCtx, OnAction } from './types';

const FormContext = createContext<FormCtx | null>(null);

export function IntentForm({ children, onAction }: { children?: any; onAction: OnAction }) {
  const [, setTick] = useState(0);
  const valuesRef = useRef<Record<string, string>>({});
  const ctx: FormCtx = {
    valuesRef,
    set: (name, value) => {
      valuesRef.current[name] = value;
      setTick((n) => n + 1);
    },
  };
  // onAction is passed through context for nested Submit; we stash it on ctx via closure key.
  (ctx as any).onAction = onAction;
  return (
    <FormContext.Provider value={ctx}>
      <Col style={{
        gap: 8,
        padding: 12,
        backgroundColor: '#0f172a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
      }}>
        {children}
      </Col>
    </FormContext.Provider>
  );
}

export function IntentField({
  name,
  label,
  placeholder,
  initial,
}: {
  name: string;
  label?: string;
  placeholder?: string;
  initial?: string;
}) {
  const ctx = useContext(FormContext);
  const [value, setValue] = useState(initial ?? '');
  const seeded = useRef(false);
  if (ctx && !seeded.current && initial) {
    ctx.valuesRef.current[name] = initial;
    seeded.current = true;
  }
  if (!ctx) {
    return <Text style={{ fontSize: 12, color: '#fbbf24' }}>[Field outside Form]</Text>;
  }
  return (
    <Col style={{ gap: 4 }}>
      {label ? <Text style={{ fontSize: 12, color: '#94a3b8' }}>{label}</Text> : null}
      <TextInput
        value={value}
        placeholder={placeholder ?? ''}
        onChangeText={(text: string) => {
          setValue(text);
          ctx.set(name, text);
        }}
        style={{
          padding: 8,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: '#1e293b',
          color: '#f1f5f9',
          borderWidth: 1,
          borderColor: '#334155',
          borderRadius: 6,
          fontSize: 14,
        }}
      />
    </Col>
  );
}

export function IntentSubmit({
  replyTemplate,
  label,
}: {
  replyTemplate?: string;
  label?: string;
}) {
  const ctx = useContext(FormContext);
  if (!ctx) {
    return <Text style={{ fontSize: 12, color: '#fbbf24' }}>[Submit outside Form]</Text>;
  }
  const onAction: OnAction = (ctx as any).onAction;
  const press = () => {
    const values = ctx.valuesRef.current;
    const reply = replyTemplate ? interpolate(replyTemplate, values) : defaultReply(values);
    onAction(reply);
  };
  return (
    <Pressable onPress={press}>
      <Box style={{
        padding: 8,
        paddingLeft: 14,
        paddingRight: 14,
        backgroundColor: '#16a34a',
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{label ?? 'Submit'}</Text>
      </Box>
    </Pressable>
  );
}

function interpolate(tpl: string, values: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

function defaultReply(values: Record<string, string>): string {
  const pairs = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('; ');
  return `FORM_SUBMITTED: ${pairs}`;
}
