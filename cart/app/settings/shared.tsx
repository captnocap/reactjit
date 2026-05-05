// shared.tsx — common helpers for the 7 settings routes.
//
// One namespace, one passthrough schema (all CRUD rows are validated
// upstream — useCRUD wants a Schema-shaped object), one set of well-known
// row ids. Atoms (Field/Input/PillRow) are kept here so each route file
// stays focused on its own logic, not its layout primitives.

import { useCallback, useEffect, useState } from 'react';
import { Box, Pressable } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useCRUD } from '../db';

export const NS = 'app';
export const USER_ID = 'user_local';
export const SETTINGS_ID = 'settings_default';
export const PRIVACY_ID = 'privacy_default';

export const passthrough = { parse: (v: any) => v };

// Stores ─────────────────────────────────────────────────────────────
export function useUserStore()       { return useCRUD('user',       passthrough as any, { namespace: NS }); }
export function useSettingsStore()   { return useCRUD('settings',   passthrough as any, { namespace: NS }); }
export function usePrivacyStore()    { return useCRUD('privacy',    passthrough as any, { namespace: NS }); }
export function useConnectionStore() { return useCRUD('connection', passthrough as any, { namespace: NS }); }
export function useModelStore()      { return useCRUD('model',      passthrough as any, { namespace: NS }); }

// Tiny load-on-key hook used by every route. Caller controls reload via
// bumping a key (parent passes it down) or returning the bumper.
export function useReloadable<T>(load: () => Promise<T>): { data: T | null; reload: () => void; busy: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    load().then((v) => { if (!cancelled) { setData(v); setBusy(false); } })
          .catch(() => { if (!cancelled) { setData(null); setBusy(false); } });
    return () => { cancelled = true; };
  // load is intentionally re-derived each render in callers; we key on k only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const reload = useCallback(() => setK((n) => n + 1), []);
  return { data, reload, busy };
}

// Atoms ──────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: any }) {
  return (
    <S.AppFormFieldCol>
      <S.AppFormLabel>{label}</S.AppFormLabel>
      {children}
    </S.AppFormFieldCol>
  );
}

export function Input({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  const Cls = mono ? S.AppFormInputMono : S.AppFormInput;
  return (
    <Cls
      value={value || ''}
      onChangeText={onChange}
      placeholder={placeholder || ''}
    />
  );
}

export function PillRow<T extends string>({ options, labels, value, onChange }: {
  options: T[];
  labels?: Partial<Record<T, string>>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isActive = opt === value;
        const Pill = isActive ? S.AppTraitChipActive : S.AppTraitChip;
        const Lbl  = isActive ? S.AppTraitChipTextActive : S.AppTraitChipText;
        return (
          <Pressable key={opt} onPress={() => onChange(opt)}>
            <Pill><Lbl>{labels?.[opt] ?? opt}</Lbl></Pill>
          </Pressable>
        );
      })}
    </Box>
  );
}

export function Card({ children, gap = 12 }: { children: any; gap?: number }) {
  return (
    <S.Card>
      <Box style={{ flexDirection: 'column', gap }}>{children}</Box>
    </S.Card>
  );
}

export function Section({ title, caption, children }: { title: string; caption?: string; children: any }) {
  return (
    <Box style={{ flexDirection: 'column', gap: 12 }}>
      <Box style={{ flexDirection: 'column', gap: 2 }}>
        {caption ? <S.Caption>{caption}</S.Caption> : null}
        <S.Title>{title}</S.Title>
      </Box>
      {children}
    </Box>
  );
}
