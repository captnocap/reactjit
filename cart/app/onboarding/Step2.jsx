import { useEffect, useRef, useState } from 'react';
import { Box, ScrollView } from '../../../runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { process as processHook } from '../../../runtime/hooks';
import { SnakeSpinner } from '../../component-gallery/components/grid-spinners/GridSpinners';
import { useAnimationTimeline } from '../anim';
import { useOnboarding } from './state';

// Carryover timeline (when name is already set, i.e. user came from step 1 exit).
const T_GREET_HOLD_END = 500;
const T_GREET_FADE_END = 1400;
const T_MAIN_IN_END    = 1950;
const T_MAIN_SLIDE_END = 2450;
const T_BTN1 = [2450, 2750];
const T_BTN2 = [2670, 2970];
const T_BTN3 = [2890, 3190];

const SKIP_GREET_OFFSET = T_GREET_FADE_END;
const FORM_FADE_MS = 400;
const NEXT_FADE_MS = 350;
const SLIDE_UP_PX = 80;
const LOCAL_RESULT_FADE_MS = 420;
const LOCAL_RESULT_SLIDE_PX = 12;
const LOCAL_MODEL_ROW_H = 40;
const LOCAL_MODEL_LIST_MAX_H = 220;

// Exit timeline (Next click → step 3).
const EXIT_TOTAL_MS    = 1900;
const EXIT_MENU_OUT    = [0,    380];
const EXIT_SPINNER_IN  = [190,  665];
const EXIT_THANKS_IN   = [570, 1235];

// ── Step 2 root ───────────────────────────────────────────────────────

export default function Step2() {
  const onb = useOnboarding();
  const persistedName = typeof onb.name === 'string' ? onb.name.trim() : '';
  const hasGreet = persistedName.length > 0;

  const tl = useAnimationTimeline({ skip: !hasGreet, skipOffsetMs: SKIP_GREET_OFFSET });

  const greetOp = hasGreet ? tl.fadeOut(T_GREET_HOLD_END, T_GREET_FADE_END) : 0;
  const mainOp  = tl.range(T_GREET_FADE_END, T_MAIN_IN_END);
  const slideP  = tl.range(T_MAIN_IN_END, T_MAIN_SLIDE_END);
  const btn1Op  = tl.range(T_BTN1[0], T_BTN1[1]);
  const btn2Op  = tl.range(T_BTN2[0], T_BTN2[1]);
  const btn3Op  = tl.range(T_BTN3[0], T_BTN3[1]);

  const [selected, setSelected] = useState(null); // null | 'api' | 'claude' | 'local'
  const [selectedAtT, setSelectedAtT] = useState(null);
  const selectedRef = useRef(selected);
  const selectedAtTRef = useRef(selectedAtT);
  selectedRef.current = selected;
  selectedAtTRef.current = selectedAtT;

  const [lockedIn, setLockedIn] = useState(false);
  const [lockedAtT, setLockedAtT] = useState(null);
  useEffect(() => {
    if (lockedIn && lockedAtT == null) {
      setLockedAtT(tl.tRef.current);
    }
    if (!lockedIn) {
      setLockedAtT(null);
    }
  }, [lockedIn, lockedAtT]);

  const [exitStartT, setExitStartT] = useState(null);
  const exitStartTRef = useRef(null);
  exitStartTRef.current = exitStartT;
  useEffect(() => {
    if (exitStartT == null) return;
    const id = setTimeout(() => {
      try { onb.setStep(2); } catch {}
    }, EXIT_TOTAL_MS);
    return () => clearTimeout(id);
  }, [exitStartT]);

  function pickProvider(kind) {
    if (selectedRef.current === kind) return;
    if (exitStartTRef.current != null) return;
    setSelected(kind);
    setLockedIn(false);
    if (selectedAtTRef.current == null) {
      setSelectedAtT(tl.tRef.current);
    }
    try { onb.setProviderKind(kind); } catch {}
  }

  function takeMeBack() {
    if (exitStartTRef.current != null) return;
    try { onb.setProviderKind(null); } catch {}
    try { onb.setStep(0); } catch {}
  }

  function onNext() {
    if (!lockedIn || exitStartTRef.current != null) return;
    setExitStartT(tl.tRef.current);
  }

  const formOp = selected && selectedAtT != null
    ? tl.range(selectedAtT, selectedAtT + FORM_FADE_MS)
    : 0;

  const nextOp = lockedAtT != null
    ? tl.range(lockedAtT, lockedAtT + NEXT_FADE_MS)
    : 0;

  const exitMenuOut    = exitStartT != null ? tl.range(exitStartT + EXIT_MENU_OUT[0],    exitStartT + EXIT_MENU_OUT[1])    : 0;
  const exitSpinnerIn  = exitStartT != null ? tl.range(exitStartT + EXIT_SPINNER_IN[0],  exitStartT + EXIT_SPINNER_IN[1])  : 0;
  const exitThanksIn   = exitStartT != null ? tl.range(exitStartT + EXIT_THANKS_IN[0],   exitStartT + EXIT_THANKS_IN[1])   : 0;
  const menuOpacityMul = 1 - exitMenuOut;

  return (
    <S.AppStepFrame>
      {/* Carryover greet */}
      {hasGreet && greetOp > 0.001 && (
        <S.AppStepCenter style={{ opacity: greetOp }}>
          <S.AppGreet>{`Nice to meet you ${persistedName}`}</S.AppGreet>
        </S.AppStepCenter>
      )}

      {/* Carryover spinner */}
      {hasGreet && greetOp > 0.001 && (
        <S.AppStepBottomRight style={{ opacity: greetOp }}>
          <SnakeSpinner />
        </S.AppStepBottomRight>
      )}

      {/* Main column: message + tile row + inline form */}
      <S.AppStepCenterCol
        style={{
          gap: 32,
          paddingLeft: 24, paddingRight: 24,
          opacity: mainOp * menuOpacityMul,
          marginTop: -slideP * SLIDE_UP_PX,
        }}
      >
        <S.AppPromptText>This application requires a connection to a provider</S.AppPromptText>

        <S.AppProviderRow>
          <ProviderTile
            op={btn1Op}
            active={selected === 'api'}
            title="I have an API key"
            subtitle="OpenAI, Anthropic, Mistral, OpenRouter, …"
            onPress={() => pickProvider('api')}
          />
          <ProviderTile
            op={btn2Op}
            active={selected === 'claude'}
            title="I have a Claude.ai subscription"
            subtitle="Claude Code SDK"
            onPress={() => pickProvider('claude')}
          />
          <ProviderTile
            op={btn3Op}
            active={selected === 'local'}
            title="I have local models"
            subtitle=".gguf files or a local API endpoint"
            onPress={() => pickProvider('local')}
          />
        </S.AppProviderRow>

        {selected ? (
          <S.AppStepDimmable style={{ opacity: formOp, marginTop: (1 - formOp) * 12 }}>
            {selected === 'api'    ? <ApiKeyForm   setLockedIn={setLockedIn} /> : null}
            {selected === 'claude' ? <ClaudeForm   setLockedIn={setLockedIn} /> : null}
            {selected === 'local'  ? <LocalForm    setLockedIn={setLockedIn} /> : null}
          </S.AppStepDimmable>
        ) : null}
      </S.AppStepCenterCol>

      {/* Take me back (bottom-left) */}
      <S.AppStepBottomLeft style={{ opacity: mainOp * menuOpacityMul }}>
        <S.ButtonOutline onPress={takeMeBack}>
          <S.ButtonOutlineLabel>Take me back!</S.ButtonOutlineLabel>
        </S.ButtonOutline>
      </S.AppStepBottomLeft>

      {/* Next (bottom-right) — appears when probe is locked in. */}
      {lockedIn ? (
        <S.AppStepBottomRight style={{ opacity: nextOp * menuOpacityMul, marginTop: (1 - nextOp) * 8 }}>
          <S.Button onPress={onNext}>
            <S.ButtonLabel>Next</S.ButtonLabel>
          </S.Button>
        </S.AppStepBottomRight>
      ) : null}

      {/* Exit "Thanks for that" (centered) */}
      {exitStartT != null ? (
        <S.AppStepCenter style={{ opacity: exitThanksIn, marginTop: (1 - exitThanksIn) * 8 }}>
          <S.AppGreet>Thanks for that</S.AppGreet>
        </S.AppStepCenter>
      ) : null}

      {/* Exit spinner (bottom-right) */}
      {exitStartT != null ? (
        <S.AppStepBottomRight style={{ opacity: exitSpinnerIn }}>
          {exitSpinnerIn > 0.001 ? <SnakeSpinner /> : null}
        </S.AppStepBottomRight>
      ) : null}
    </S.AppStepFrame>
  );
}

// ── Provider tile ─────────────────────────────────────────────────────

function ProviderTile({ op, active, title, subtitle, onPress }) {
  const Tile = active ? S.AppProviderTileActive : S.AppProviderTile;
  const Title = active ? S.AppProviderTileTitleActive : S.AppProviderTileTitle;
  return (
    <S.AppStepDimmable style={{ opacity: op, marginTop: (1 - op) * 12 }}>
      <Tile onPress={onPress}>
        <Title>{title}</Title>
        <S.AppProviderTileSubtitle>{subtitle}</S.AppProviderTileSubtitle>
      </Tile>
    </S.AppStepDimmable>
  );
}

// ── Inline form helpers ───────────────────────────────────────────────

function FormShell({ children }) {
  return <S.AppFormShell>{children}</S.AppFormShell>;
}

function LabeledInput({ label, value, onChange, placeholder, secret }) {
  const safe = typeof value === 'string' ? value : '';
  const handleChange = (...args) => {
    const first = args[0];
    if (typeof first === 'string') onChange(first);
    else if (first && typeof first === 'object' && typeof first.text === 'string') onChange(first.text);
  };

  const Input = secret ? S.AppFormInputMono : S.AppFormInput;
  return (
    <S.AppFormFieldCol>
      <S.AppFormLabel>{label}</S.AppFormLabel>
      <Input value={safe} onChange={handleChange} placeholder={placeholder || ''} />
    </S.AppFormFieldCol>
  );
}

function ProbeButton({ enabled, busy, label, onPress }) {
  return (
    <S.AppStepDimmable style={{ opacity: enabled ? 1 : 0.35 }}>
      <S.Button onPress={enabled && !busy ? onPress : () => {}}>
        <S.ButtonLabel>{busy ? 'Probing…' : label}</S.ButtonLabel>
      </S.Button>
    </S.AppStepDimmable>
  );
}

function ProbeResult({ status, message }) {
  if (!status) return null;
  const Tone = status === 'success' ? S.AppProbeOk : S.AppProbeFail;
  return (
    <S.AppProbeResult>
      <Tone>{status === 'success' ? 'Probe succeeded' : 'Probe failed'}</Tone>
      {message ? <S.AppProbeMessage>{message}</S.AppProbeMessage> : null}
    </S.AppProbeResult>
  );
}

function ModelList({ models, selectedModel, onSelect }) {
  const useScroll = models.length > 6;

  return (
    <S.AppFormFieldCol>
      <S.AppModelListLabel>Pick a model</S.AppModelListLabel>
      <S.AppModelListBox style={{ height: useScroll ? 220 : undefined, maxHeight: 220 }}>
        <ScrollView showScrollbar={useScroll} style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
          <Box style={{ flexDirection: 'column', gap: 4 }}>
            {models.map((m) => {
              const active = m === selectedModel;
              const Choice = active ? S.AppModelChoiceActive : S.AppModelChoice;
              const ChoiceText = active ? S.AppModelChoiceTextActive : S.AppModelChoiceText;
              return (
                <Choice key={m} onPress={() => onSelect(m)}>
                  <ChoiceText>{m}</ChoiceText>
                </Choice>
              );
            })}
          </Box>
        </ScrollView>
      </S.AppModelListBox>
    </S.AppFormFieldCol>
  );
}

// ── 1) API-key provider ───────────────────────────────────────────────

function ApiKeyForm({ setLockedIn }) {
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const endpointRef = useRef(endpoint);
  const apiKeyRef = useRef(apiKey);
  endpointRef.current = endpoint;
  apiKeyRef.current = apiKey;

  const hasAnyInput =
    (typeof endpoint === 'string' && endpoint.trim().length > 0) ||
    (typeof apiKey === 'string' && apiKey.trim().length > 0);

  useEffect(() => {
    setLockedIn(status === 'success' && chosen != null);
  }, [status, chosen]);
  useEffect(() => () => setLockedIn(false), []);

  async function probe() {
    setBusy(true);
    const ep = endpointRef.current;
    const key = apiKeyRef.current;
    console.log(`[onboarding] probe API: ${ep}/models key=${key ? '***' : '<none>'}`);
    setModels(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']);
    setStatus('success');
    setBusy(false);
  }

  return (
    <FormShell>
      <LabeledInput label="Endpoint URL" value={endpoint} onChange={setEndpoint} placeholder="https://api.openai.com/v1" />
      <LabeledInput label="API key" value={apiKey} onChange={setApiKey} placeholder="sk-..." secret />
      <S.AppFormButtonRow>
        <ProbeButton enabled={hasAnyInput} busy={busy} label="Probe" onPress={probe} />
      </S.AppFormButtonRow>
      {models ? <ModelList models={models} selectedModel={chosen} onSelect={setChosen} /> : null}
      <ProbeResult status={status} />
    </FormShell>
  );
}

// ── 2) Claude.ai subscription provider ────────────────────────────────

const CLAUDE_PROBE_PROMPT =
  "Testing connection to Claude Code SDK. If this lands, respond with 'Hey! It worked!' exactly";
const CLAUDE_EXPECTED = "Hey! It worked!";

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function ClaudeForm({ setLockedIn }) {
  const [home, setHome] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  const homeRef = useRef(home);
  homeRef.current = home;

  const hasAnyInput = typeof home === 'string' && home.trim().length > 0;

  useEffect(() => {
    setLockedIn(status === 'success');
  }, [status]);
  useEffect(() => () => setLockedIn(false), []);

  async function probe() {
    setBusy(true);
    setStatus(null);
    setMessage('');
    const homeVal = homeRef.current.trim();
    const promptArg = shellQuote(CLAUDE_PROBE_PROMPT);
    const cmd = homeVal
      ? `HOME=${shellQuote(homeVal.replace(/^~/, '$HOME'))} claude --print ${promptArg}`
      : `claude --print ${promptArg}`;
    console.log(`[onboarding] claude probe: ${cmd}`);
    try {
      const result = await processHook.execAsync(cmd);
      const out = (result && typeof result.stdout === 'string') ? result.stdout.trim() : '';
      if (result && result.code === 0 && out.includes(CLAUDE_EXPECTED)) {
        setStatus('success');
        setMessage(out);
      } else {
        setStatus('failed');
        setMessage(out || `(exit ${result && result.code})`);
      }
    } catch (e) {
      setStatus('failed');
      setMessage((e && e.message) ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <FormShell>
      <LabeledInput
        label="Claude Code home folder"
        value={home}
        onChange={setHome}
        placeholder="~/.claude"
      />
      <S.AppFormButtonRow>
        <ProbeButton enabled={hasAnyInput} busy={busy} label="Probe Claude" onPress={probe} />
      </S.AppFormButtonRow>
      <ProbeResult status={status} message={message} />
    </FormShell>
  );
}

// ── 3) Local models provider ──────────────────────────────────────────

function LocalForm({ setLockedIn }) {
  const tl = useAnimationTimeline({});
  const [path, setPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [hasProbed, setHasProbed] = useState(false);
  const [resultAtT, setResultAtT] = useState(null);
  const [modelsAtT, setModelsAtT] = useState(null);
  const [statusAtT, setStatusAtT] = useState(null);

  const pathRef = useRef(path);
  const keyRef = useRef(apiKey);
  pathRef.current = path;
  keyRef.current = apiKey;

  const hasAnyInput =
    (typeof path === 'string' && path.trim().length > 0) ||
    (typeof apiKey === 'string' && apiKey.trim().length > 0);

  useEffect(() => {
    setLockedIn(status === 'success' && chosen != null);
  }, [status, chosen]);
  useEffect(() => () => setLockedIn(false), []);
  useEffect(() => {
    setHasProbed(false);
    setStatus(null);
    setMessage('');
    setModels(null);
    setChosen(null);
    setResultAtT(null);
    setModelsAtT(null);
    setStatusAtT(null);
  }, [path, apiKey]);

  async function probe() {
    setHasProbed(true);
    setResultAtT(tl.tRef.current);
    setStatusAtT(tl.tRef.current);
    setModelsAtT(null);
    setBusy(true);
    setStatus('pending');
    setMessage('');
    setModels(null);
    setChosen(null);
    const p = pathRef.current.trim();
    const k = keyRef.current.trim();
    if (!p) {
      setModels(null);
      setStatus('failed');
      setMessage('No local path or endpoint provided.');
      setStatusAtT(tl.tRef.current);
      setBusy(false);
      return;
    }

    const normalizedPath = /^[a-zA-Z0-9.-]+:\d+(?:\/.*)?$/.test(p) ? `http://${p}` : p;

    if (/^https?:\/\//.test(normalizedPath)) {
      const HTTP_PROBE_TIMEOUT_MS = 2000;
      const base = normalizedPath.replace(/\/+$/, '');
      const probeUrls = [];
      if (/\/api\/v1\/models$/.test(base) || /\/(?:v1\/)?models$/.test(base) || /\/api\/tags$/.test(base)) {
        probeUrls.push(base);
      } else {
        const rootBase = base.replace(/\/(?:api\/v1|v1|models|api\/tags)$/, '');
        probeUrls.push(`${rootBase}/api/v1/models`);
        probeUrls.push(`${rootBase}/models`);
        probeUrls.push(`${rootBase}/v1/models`);
        probeUrls.push(`${rootBase}/api/tags`);
      }

      const seen = new Set();
      const uniqueProbeUrls = probeUrls.filter((u) => {
        if (seen.has(u)) return false;
        seen.add(u);
        return true;
      });
      const headers = k ? { Authorization: `Bearer ${k}` } : undefined;
      let lastErr = '';
      setMessage(`Probing endpoint: ${uniqueProbeUrls.join(', ')}`);

      try {
        for (const url of uniqueProbeUrls) {
          let res;
          try {
            const fetchRes = await Promise.race([
              fetch(url, { method: 'GET', headers }),
              new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${HTTP_PROBE_TIMEOUT_MS}ms`)), HTTP_PROBE_TIMEOUT_MS)),
            ]);
            const bodyText = await fetchRes.text();
            res = {
              status: fetchRes.status,
              body: bodyText,
            };
          } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            lastErr = `${url} -> ${msg}`;
            continue;
          }
          if (!res || typeof res.status !== 'number') {
            lastErr = `No response from ${url}`;
            continue;
          }
          if (res.status < 200 || res.status >= 300) {
            const bodySnippet = typeof res.body === 'string' ? res.body.trim().slice(0, 140) : '';
            lastErr = `${url} -> HTTP ${res.status}${bodySnippet ? `: ${bodySnippet}` : ''}`;
            continue;
          }

          let parsed = null;
          try { parsed = JSON.parse(res.body || '{}'); } catch {}

          const out = [];
          const pushModel = (v) => {
            if (typeof v === 'string' && v.trim().length > 0) out.push(v.trim());
          };
          const readRows = (rows) => {
            if (!Array.isArray(rows)) return;
            for (const row of rows) {
              if (typeof row === 'string') pushModel(row);
              else if (row && typeof row === 'object') {
                pushModel(row.id);
                pushModel(row.name);
                pushModel(row.model);
              }
            }
          };

          if (Array.isArray(parsed)) readRows(parsed);
          if (parsed && typeof parsed === 'object') {
            readRows(parsed.data);
            readRows(parsed.models);
          }

          const uniq = Array.from(new Set(out));
          if (uniq.length > 0) {
            setModels(uniq);
            setModelsAtT(tl.tRef.current);
            setStatus('success');
            setMessage(`Found ${uniq.length} model${uniq.length === 1 ? '' : 's'} at ${url}`);
            setStatusAtT(tl.tRef.current + 90);
            setBusy(false);
            return;
          }
          lastErr = `${url} returned no model ids`;
        }

        setModels(null);
        setStatus('failed');
        setMessage(lastErr || 'Unable to parse model list from endpoint.');
        setStatusAtT(tl.tRef.current);
      } catch (e) {
        setModels(null);
        setStatus('failed');
        setMessage((e && e.message) ? e.message : String(e));
        setStatusAtT(tl.tRef.current);
      }
      setBusy(false);
      return;
    }

    setModels([p.split('/').pop() || p]);
    setModelsAtT(tl.tRef.current);
    setStatus('success');
    setMessage(`Using local model path: ${p}`);
    setStatusAtT(tl.tRef.current + 90);
    setBusy(false);
  }

  const resultOp = resultAtT != null ? tl.range(resultAtT, resultAtT + LOCAL_RESULT_FADE_MS) : 0;
  const modelsOp = modelsAtT != null ? tl.range(modelsAtT, modelsAtT + LOCAL_RESULT_FADE_MS) : 0;
  const statusOp = statusAtT != null ? tl.range(statusAtT, statusAtT + LOCAL_RESULT_FADE_MS) : 0;
  const modelListHeight = models
    ? (models.length > 6 ? LOCAL_MODEL_LIST_MAX_H + 28 : models.length * LOCAL_MODEL_ROW_H + 34)
    : 0;

  return (
    <FormShell>
      <LabeledInput
        label=".gguf path or local endpoint"
        value={path}
        onChange={setPath}
        placeholder="/models/llama.gguf  or  http://localhost:11434/v1"
      />
      <LabeledInput
        label="API key (optional)"
        value={apiKey}
        onChange={setApiKey}
        placeholder="(usually empty)"
        secret
      />
      <S.AppFormButtonRow>
        <ProbeButton enabled={hasAnyInput} busy={busy} label="Probe" onPress={probe} />
      </S.AppFormButtonRow>
      {hasProbed ? (
        <Box style={{ flexDirection: 'column', gap: 10, opacity: resultOp, marginTop: (1 - resultOp) * LOCAL_RESULT_SLIDE_PX }}>
          {models ? (
            <Box
              style={{
                height: modelListHeight * modelsOp,
                overflow: 'hidden',
                opacity: modelsOp,
                marginTop: (1 - modelsOp) * LOCAL_RESULT_SLIDE_PX,
              }}
            >
              <ModelList models={models} selectedModel={chosen} onSelect={setChosen} />
            </Box>
          ) : null}
          <Box style={{ opacity: statusOp, marginTop: (1 - statusOp) * 8 }}>
            <ProbeResult status={status} message={message} />
          </Box>
        </Box>
      ) : null}
    </FormShell>
  );
}
