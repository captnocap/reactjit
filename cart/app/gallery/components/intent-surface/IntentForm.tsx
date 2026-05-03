import { useRef, useState, createContext, useContext } from 'react';
import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Col, Pressable, Text, TextInput } from '@reactjit/runtime/primitives';
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
  const FormFrame = S.Card || Col;
  return (
    <FormContext.Provider value={ctx}>
      <FormFrame>{children}</FormFrame>
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
    const ErrorText = S.Error || Text;
    return <ErrorText>[Field outside Form]</ErrorText>;
  }
  const Field = S.StackX2 || Col;
  const Label = S.Label || Text;
  const Input = S.AppFormInput || TextInput;
  return (
    <Field>
      {label ? <Label>{label}</Label> : null}
      <Input
        value={value}
        placeholder={placeholder ?? ''}
        onChangeText={(text: string) => {
          setValue(text);
          ctx.set(name, text);
        }}
      />
    </Field>
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
    const ErrorText = S.Error || Text;
    return <ErrorText>[Submit outside Form]</ErrorText>;
  }
  const onAction: OnAction = (ctx as any).onAction;
  const press = () => {
    const values = ctx.valuesRef.current;
    const reply = replyTemplate ? interpolate(replyTemplate, values) : defaultReply(values);
    onAction(reply);
  };
  const Button = S.Button || Pressable;
  const Label = S.ButtonLabel || Text;
  return (
    <Button onPress={press} style={{ alignSelf: 'flex-start' }}>
      <Label>{label ?? 'Submit'}</Label>
    </Button>
  );
}

function interpolate(tpl: string, values: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

function defaultReply(values: Record<string, string>): string {
  const pairs = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('; ');
  return `FORM_SUBMITTED: ${pairs}`;
}
