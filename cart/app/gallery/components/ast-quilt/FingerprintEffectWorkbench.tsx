import { useEffect, useRef, useState } from 'react';
import { Box, Col, Effect, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { prepareAstFingerprintFile } from './AstQuilt';
import {
  drawFingerprintEffect,
  extractFingerprintGenes,
  type FingerprintGenes,
} from './EffectFromFingerprint';
import {
  listFingerprintSamplePaths,
  loadRuntimeFingerprint,
  type FingerprintLoadResult,
} from './fingerprint';

const PREVIEW_SIZE = 360;

function chipStyle(active: boolean, color: string) {
  return {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: active ? color : '#14100d',
    backgroundColor: active ? '#0d1b25' : '#09131b',
  } as const;
}

function shortLabel(path: string): string {
  const clean = String(path || '').trim();
  if (!clean) return 'untitled';
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

function GeneChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Col
      style={{
        paddingLeft: 9,
        paddingRight: 9,
        paddingTop: 7,
        paddingBottom: 7,
        minWidth: 78,
        gap: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#14100d',
        backgroundColor: '#0e0b09',
      }}
    >
      <Text style={{ fontSize: 9, color: '#b8a890', fontWeight: 'bold' }}>{label}</Text>
      <Text style={{ fontSize: 11, color: color || '#c8b894', fontFamily: 'monospace' }}>{value}</Text>
    </Col>
  );
}

function fmtNumber(value: number, digits = 2): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits);
}

export function FingerprintEffectWorkbench(props: { initialPath?: string }) {
  const initialDraftPath = props.initialPath || 'cart/component-gallery/components/ast-quilt/AstQuilt.tsx';
  const [samplePaths] = useState<string[]>(() => {
    const available = listFingerprintSamplePaths();
    return available.length > 0 ? available : [initialDraftPath];
  });
  const [draftPath, setDraftPath] = useState<string>(() => props.initialPath || samplePaths[0] || initialDraftPath);
  const [activePath, setActivePath] = useState<string>('');
  const [result, setResult] = useState<FingerprintLoadResult | null>(null);
  const [genes, setGenes] = useState<FingerprintGenes | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const draftPathRef = useRef(draftPath);
  const requestIdRef = useRef(0);
  const preparedRef = useRef<{ pathKey: string; genes: FingerprintGenes | null } | null>(null);

  function updateDraft(p: string) {
    draftPathRef.current = p;
    setDraftPath(p);
  }

  function beginLoad(nextPath?: string) {
    const target = String(nextPath ?? draftPathRef.current).trim();
    if (!target) {
      setError('Enter a file path.');
      return;
    }
    draftPathRef.current = target;
    setDraftPath(target);
    setActivePath(target);
    setPending(true);
    setError('');
    const requestId = ++requestIdRef.current;
    loadRuntimeFingerprint(target)
      .then((next) => {
        if (requestIdRef.current !== requestId) return;
        const prepared = prepareAstFingerprintFile(next.file);
        const nextGenes = prepared.count > 0 ? extractFingerprintGenes(prepared) : null;
        preparedRef.current = { pathKey: `${target}:${prepared.count}:${prepared.maxEnd}`, genes: nextGenes };
        setResult(next);
        setGenes(nextGenes);
        setPending(false);
      })
      .catch((reason) => {
        if (requestIdRef.current !== requestId) return;
        setError(String((reason as any)?.message ?? reason ?? 'Unable to generate fingerprint.'));
        setPending(false);
      });
  }

  useEffect(() => {
    const initial = props.initialPath || samplePaths[0];
    if (initial) beginLoad(initial);
  }, []);

  return (
    <Row style={{ width: '100%', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', padding: 14 }}>
      <Col
        style={{
          flexGrow: 1,
          flexBasis: 420,
          minWidth: 380,
          gap: 14,
          padding: 16,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: '#14100d',
          backgroundColor: '#06121a',
        }}
      >
        <Col style={{ gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#b8a890' }}>Random Effect from Fingerprint</Text>
          <Text style={{ fontSize: 10, color: '#b8a890' }}>
            The fingerprint is mined for ~16 genes and a voice array, then dispatched to one of 8 procedural pixel engines. Same file → same effect, deterministically.
          </Text>
        </Col>

        <Col style={{ gap: 6 }}>
          <Text style={{ fontSize: 9, color: '#b8a890', fontWeight: 'bold' }}>FILE PATH</Text>
          <Row style={{ width: '100%', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={draftPath}
              onChangeText={updateDraft}
              onChange={updateDraft}
              onSubmit={() => beginLoad(draftPathRef.current)}
              placeholder="path/to/file"
              style={{
                flexGrow: 1,
                flexBasis: 0,
                minWidth: 280,
                height: 36,
                paddingLeft: 10,
                paddingRight: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#14100d',
                backgroundColor: '#0e0b09',
                color: '#b8a890',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            <Pressable onPress={() => beginLoad()} style={chipStyle(true, '#8aca6a')}>
              <Text style={{ fontSize: 10, color: '#d9ffe2', fontWeight: 'bold' }}>{pending ? 'Loading…' : 'Generate'}</Text>
            </Pressable>
          </Row>
        </Col>

        <Col style={{ gap: 6 }}>
          <Text style={{ fontSize: 9, color: '#b8a890', fontWeight: 'bold' }}>QUICK FILES</Text>
          <Row style={{ width: '100%', gap: 8, flexWrap: 'wrap' }}>
            {samplePaths.map((path) => (
              <Pressable key={path} onPress={() => beginLoad(path)} style={chipStyle(activePath === path, '#5a8bd6')}>
                <Text
                  style={{
                    fontSize: 9,
                    color: activePath === path ? '#d7f5ff' : '#9ec2d4',
                    fontFamily: 'monospace',
                  }}
                >
                  {shortLabel(path)}
                </Text>
              </Pressable>
            ))}
          </Row>
        </Col>

        <Row style={{ width: '100%', gap: 8, flexWrap: 'wrap' }}>
          <GeneChip label="engine" value={genes ? genes.engineName : 'idle'} color="#9ee6a8" />
          <GeneChip label="seed" value={genes ? genes.seed.toString(16).padStart(8, '0').slice(0, 8) : '—'} />
          <GeneChip label="hue" value={genes ? Math.round(genes.hueBase * 360) + '°' : '—'} />
          <GeneChip label="span" value={genes ? Math.round(genes.hueSpan * 100) + '%' : '—'} />
          <GeneChip label="speed" value={genes ? fmtNumber(genes.speed) : '—'} />
          <GeneChip label="symmetry" value={genes ? String(genes.symmetry) : '—'} />
          <GeneChip label="density" value={genes ? String(genes.density) : '—'} />
          <GeneChip label="warp" value={genes ? fmtNumber(genes.warp) : '—'} />
          <GeneChip label="twist" value={genes ? fmtNumber(genes.twist) : '—'} />
          <GeneChip label="detail" value={genes ? String(genes.detail) : '—'} />
          <GeneChip label="nodes" value={result ? String(result.file.count) : '—'} />
          <GeneChip label="strategy" value={result ? result.strategy : '—'} />
        </Row>

        <Col
          style={{
            gap: 6,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#14100d',
            backgroundColor: '#0e0b09',
          }}
        >
          <Text style={{ fontSize: 9, color: '#b8a890', fontWeight: 'bold' }}>STATUS</Text>
          <Text
            style={{
              fontSize: 10,
              color: pending ? '#d6a54a' : error ? '#e4b0c4' : '#b8a890',
              fontFamily: 'monospace',
            }}
          >
            {pending
              ? `loading ${activePath || draftPath}`
              : error
                ? error
                : genes
                  ? `engine=${genes.engineName}  seed=${genes.seed.toString(16).slice(0, 10)}  voices=${genes.voices.length}`
                  : 'idle'}
          </Text>
          <Text style={{ fontSize: 10, color: '#8ea8ba' }}>
            Engines: plasma · voronoi · mandala · waves · lattice · streams · spiral · reaction. Each pulls hue/density/symmetry/twist/warp/detail/voices from the fingerprint.
          </Text>
          <Text style={{ fontSize: 9, color: '#64839a', fontFamily: 'monospace' }}>{activePath || draftPath || 'no path selected'}</Text>
        </Col>
      </Col>

      <Col style={{ alignItems: 'center', gap: 8 }}>
        <Box
          style={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 30,
            borderWidth: 1,
            borderColor: '#14100d',
            backgroundColor: '#040b11',
          }}
        >
          {genes ? (
            <Box style={{ width: PREVIEW_SIZE - 28, height: PREVIEW_SIZE - 28 }}>
              <Effect
                onRender={(effect: any) => drawFingerprintEffect(effect, genes)}
                style={{ width: PREVIEW_SIZE - 28, height: PREVIEW_SIZE - 28 }}
              />
            </Box>
          ) : (
            <Text style={{ fontSize: 11, color: '#b8a890' }}>{pending ? 'rendering…' : 'no file loaded'}</Text>
          )}
        </Box>
        <Text style={{ width: PREVIEW_SIZE, fontSize: 10, color: '#b8a890', textAlign: 'center' }}>
          Pick another file to swap engines, palette, density, motion — all derived from the fingerprint.
        </Text>
      </Col>
    </Row>
  );
}
