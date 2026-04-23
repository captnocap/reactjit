// Script library hook — persisted list + record-mode state + run-mode progress.


import { listScripts, saveScripts, newScript, runStep, type Script, type ScriptStep, type AutomationKind, type StepResult } from '../../../lib/automation/script';

export interface AutomationScriptApi {
  scripts: Script[];
  recording: boolean;
  recordKind: AutomationKind;
  draft: Script | null;
  startRecording: (kind: AutomationKind, name?: string) => void;
  stopRecording: () => Script | null;
  recordStep: (s: ScriptStep) => void;
  cancelRecording: () => void;

  runProgress: { scriptId: string; index: number; total: number; results: StepResult[] } | null;
  running: boolean;
  runScript: (script: Script) => Promise<StepResult[]>;
  stopRun: () => void;

  saveScript: (script: Script) => void;
  deleteScript: (id: string) => void;
  renameScript: (id: string, name: string) => void;
}

export function useAutomationScript(): AutomationScriptApi {
  const [scripts, setScripts] = useState<Script[]>(() => listScripts());
  const [draft, setDraft] = useState<Script | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordKind, setRecordKind] = useState<AutomationKind>('browser');
  const [runProgress, setRunProgress] = useState<AutomationScriptApi['runProgress']>(null);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const persist = useCallback((next: Script[]) => { setScripts(next); saveScripts(next); }, []);

  const startRecording = useCallback((kind: AutomationKind, name?: string) => {
    setDraft(newScript(name || (kind + ' script ' + new Date().toLocaleTimeString()), kind));
    setRecordKind(kind);
    setRecording(true);
  }, []);

  const stopRecording = useCallback((): Script | null => {
    setRecording(false);
    const cur = draft;
    if (cur && cur.steps.length > 0) {
      const updated = { ...cur, updatedAt: Date.now() };
      persist([updated, ...scripts.filter((s) => s.id !== updated.id)]);
      setDraft(null);
      return updated;
    }
    setDraft(null);
    return null;
  }, [draft, scripts, persist]);

  const cancelRecording = useCallback(() => { setRecording(false); setDraft(null); }, []);

  const recordStep = useCallback((s: ScriptStep) => {
    setDraft((cur: Script | null) => cur ? { ...cur, steps: cur.steps.concat([s]) } : cur);
  }, []);

  const runScript = useCallback(async (script: Script): Promise<StepResult[]> => {
    stopRef.current = false;
    setRunning(true);
    const results: StepResult[] = [];
    for (let i = 0; i < script.steps.length; i++) {
      if (stopRef.current) break;
      setRunProgress({ scriptId: script.id, index: i, total: script.steps.length, results: results.slice() });
      const r = await runStep(script.steps[i]);
      results.push(r);
      if (!r.ok) break;
    }
    setRunProgress({ scriptId: script.id, index: script.steps.length, total: script.steps.length, results });
    setRunning(false);
    return results;
  }, []);

  const stopRun = useCallback(() => { stopRef.current = true; }, []);

  const saveScript = useCallback((s: Script) => {
    const updated = { ...s, updatedAt: Date.now() };
    persist([updated, ...scripts.filter((x) => x.id !== s.id)]);
  }, [scripts, persist]);

  const deleteScript = useCallback((id: string) => {
    persist(scripts.filter((s) => s.id !== id));
  }, [scripts, persist]);

  const renameScript = useCallback((id: string, name: string) => {
    persist(scripts.map((s) => s.id === id ? { ...s, name, updatedAt: Date.now() } : s));
  }, [scripts, persist]);

  return {
    scripts, recording, recordKind, draft,
    startRecording, stopRecording, recordStep, cancelRecording,
    runProgress, running, runScript, stopRun,
    saveScript, deleteScript, renameScript,
  };
}
