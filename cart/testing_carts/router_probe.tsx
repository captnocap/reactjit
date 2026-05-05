import { useState } from 'react';
import { Box, Pressable, ScrollView, Text } from '@reactjit/runtime/primitives';
import {
  Route as RuntimeRoute,
  Router as RuntimeRouter,
  useNavigate,
  useRoute,
} from '@reactjit/runtime/router';

const paths = ['/', '/users/42', '/settings', '/missing'];

const colors = {
  bg: '#0a0f18',
  panel: '#111827',
  panel2: '#0f172a',
  border: '#243044',
  text: '#f8fafc',
  dim: '#94a3b8',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

function buttonStyle(active: boolean) {
  return {
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 6,
    backgroundColor: active ? colors.blue : '#1f2937',
    borderWidth: 1,
    borderColor: active ? '#60a5fa' : colors.border,
  };
}

function routeBox(color: string) {
  return {
    padding: 10,
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: color,
    backgroundColor: '#0b1220',
  };
}

function Button({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={buttonStyle(!!active)}>
      <Text fontSize={12} color={colors.text}>{label}</Text>
    </Pressable>
  );
}

function PageCard({ label, tone, detail }: { label: string; tone: string; detail: string }) {
  return (
    <Box style={{ ...routeBox(tone), minHeight: 88 }}>
      <Text fontSize={11} color={colors.dim}>route outlet card</Text>
      <Text fontSize={20} color={tone}>{label}</Text>
      <Text fontSize={12} color={colors.text}>{detail}</Text>
    </Box>
  );
}

function ProbeBody({ bump }: { bump: () => void }) {
  const nav = useNavigate();
  const route = useRoute();
  const currentPath = route.path || '(empty)';

  function go(path: string) {
    nav.push(path);
    bump();
  }

  function replace(path: string) {
    nav.replace(path);
    bump();
  }

  function back() {
    nav.back();
    bump();
  }

  function forward() {
    nav.forward();
    bump();
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: colors.bg }}>
      <ScrollView style={{ flexGrow: 1, padding: 18, gap: 14 }}>
        <Box style={{ gap: 6 }}>
          <Text fontSize={22} color={colors.text}>router probe</Text>
          <Text fontSize={11} color={colors.dim}>{`host path: ${currentPath}`}</Text>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {paths.map((path) => (
            <Button key={path} label={path} active={currentPath === path} onPress={() => go(path)} />
          ))}
          <Button label="replace /users/alice" onPress={() => replace('/users/alice')} />
          <Button label="back" onPress={back} />
          <Button label="forward" onPress={forward} />
        </Box>

        <Box style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.panel }}>
          <Text fontSize={15} color={colors.text}>lowercase host tags</Text>
          <Text fontSize={11} color={colors.dim}>
            The app shell is outside this block. The lowercase router below owns only this one card outlet.
          </Text>
          <Box style={{ padding: 10, borderWidth: 1, borderColor: '#334155', borderRadius: 6, backgroundColor: '#020617' }}>
            <router initialPath="/" style={{ gap: 8 }}>
              <route path="/">
                <PageCard label="HOME PAGE" tone={colors.blue} detail="Matched lowercase route path='/'." />
              </route>
              <route path="/users/:id">
                <PageCard label="USER PAGE" tone={colors.green} detail="Matched lowercase route path='/users/:id'." />
              </route>
              <route path="/settings">
                <PageCard label="SETTINGS PAGE" tone={colors.amber} detail="Matched lowercase route path='/settings'." />
              </route>
              <route fallback>
                <PageCard label="NOT FOUND PAGE" tone={colors.red} detail="Matched lowercase route fallback." />
              </route>
            </router>
          </Box>
          <Text fontSize={11} color={colors.dim}>
            Passing result: exactly one route outlet card is visible and changes when the path changes.
          </Text>
        </Box>

        <Box style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.panel2 }}>
          <Text fontSize={15} color={colors.text}>runtime Router/Route control</Text>
          <Text fontSize={11} color={colors.dim}>
            Same route table through runtime/router.tsx. This is the known-good comparison path.
          </Text>
          <Box style={{ padding: 10, borderWidth: 1, borderColor: '#334155', borderRadius: 6, backgroundColor: '#020617' }}>
            <RuntimeRoute path="/">
              <PageCard label="HOME PAGE" tone={colors.blue} detail="Runtime route matched '/'." />
            </RuntimeRoute>
            <RuntimeRoute path="/users/:id">
              {(params: any) => (
                <PageCard label="USER PAGE" tone={colors.green} detail={`Runtime route matched user id '${params.id}'.`} />
              )}
            </RuntimeRoute>
            <RuntimeRoute path="/settings">
              <PageCard label="SETTINGS PAGE" tone={colors.amber} detail="Runtime route matched '/settings'." />
            </RuntimeRoute>
            <RuntimeRoute fallback>
              <PageCard label="NOT FOUND PAGE" tone={colors.red} detail="Runtime fallback matched." />
            </RuntimeRoute>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}

export default function RouterProbe() {
  const [revision, setRevision] = useState(0);
  const bump = () => setRevision((n: number) => n + 1);

  return (
    <RuntimeRouter initialPath="/">
      <ProbeBody key={revision} bump={bump} />
    </RuntimeRouter>
  );
}
