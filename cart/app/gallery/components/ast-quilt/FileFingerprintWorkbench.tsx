import { useEffect, useRef, useState } from 'react';
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { AstBinaryTile, AstTile, type AstFingerprintRenderMode } from './AstQuilt';
import { listFingerprintSamplePaths, loadRuntimeFingerprint, type FingerprintLoadResult } from './fingerprint';
import { classifiers as S } from '@reactjit/core';

const PREVIEW_SIZE = 360;

const STRATEGY_TONES: Record<string, string> = {
  json: 'theme:blue',
  text: 'theme:warn',
  binary: 'theme:paper',
  metadata: 'theme:ink',
  contract: 'theme:pin',
};

function chipStyle(active: boolean, color: string) {
  return {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: active ? color : 'theme:bg1',
    backgroundColor: active ? 'theme:bg2' : 'theme:bg1',
  } as const;
}

function shortLabel(path: string): string {
  const clean = String(path || '').trim();
  if (!clean) return 'untitled';
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

function MetricChip(props: { label: string; value: string; color?: string }) {
  return (
    <Col
      style={{
        paddingLeft: 9,
        paddingRight: 9,
        paddingTop: 7,
        paddingBottom: 7,
        minWidth: 82,
        gap: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'theme:bg1',
        backgroundColor: 'theme:bg',
      }}
    >
      <Text style={{ fontSize: 9, color: 'theme:inkDim', fontWeight: 'bold' }}>{props.label}</Text>
      <Text style={{ fontSize: 11, color: props.color || 'theme:inkDim', fontFamily: 'monospace' }}>{props.value}</Text>
    </Col>
  );
}

function EmptyPreview(props: { title: string; detail: string }) {
  return (
    <Col
      style={{
        width: PREVIEW_SIZE,
        height: PREVIEW_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'theme:bg1',
        backgroundColor: 'theme:bg',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'theme:inkDim' }}>{props.title}</Text>
      <Text style={{ width: 240, fontSize: 10, color: 'theme:inkDim', textAlign: 'center' }}>{props.detail}</Text>
    </Col>
  );
}

export function FileFingerprintWorkbench(props: { initialPath?: string; previewMode?: AstFingerprintRenderMode }) {
  const initialDraftPath = props.initialPath || 'cart/app/gallery/components/ast-quilt/AstQuilt.tsx';
  const previewMode = props.previewMode || 'treemap';
  const [samplePaths] = useState<string[]>(() => {
    const available = listFingerprintSamplePaths();
    if (available.length > 0) return available;
    return props.initialPath ? [props.initialPath] : [initialDraftPath];
  });
  const [draftPath, setDraftPath] = useState<string>(() => props.initialPath || samplePaths[0] || initialDraftPath);
  const [activePath, setActivePath] = useState<string>('');
  const [result, setResult] = useState<FingerprintLoadResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const draftPathRef = useRef(draftPath);
  const requestIdRef = useRef(0);

  function updateDraftPath(nextPath: string) {
    draftPathRef.current = nextPath;
    setDraftPath(nextPath);
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
        setResult(next);
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

  const tone = result ? STRATEGY_TONES[result.strategy] || 'theme:pin' : 'theme:pin';

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
          borderColor: 'theme:bg1',
          backgroundColor: 'theme:bg1',
        }}
      >
        <S.StackX2>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: 'theme:inkDim' }}>Runtime Fingerprint</Text>
          <Text style={{ fontSize: 10, color: 'theme:inkDim' }}>
            Point it at any local file path. The loader turns the file into a hierarchical object and paints the result on the spot.
          </Text>
        </S.StackX2>

        <S.StackX4>
          <Text style={{ fontSize: 9, color: 'theme:inkDim', fontWeight: 'bold' }}>FILE PATH</Text>
          <Row style={{ width: '100%', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={draftPath}
              onChangeText={updateDraftPath}
              onChange={updateDraftPath}
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
                borderColor: 'theme:bg1',
                backgroundColor: 'theme:bg',
                color: 'theme:inkDim',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            <Pressable onPress={() => beginLoad()} style={chipStyle(true, 'theme:pin')}>
              <Text style={{ fontSize: 10, color: 'theme:ink', fontWeight: 'bold' }}>{pending ? 'Generating…' : 'Generate'}</Text>
            </Pressable>
          </Row>
        </S.StackX4>

        <S.StackX4>
          <Text style={{ fontSize: 9, color: 'theme:inkDim', fontWeight: 'bold' }}>QUICK FILES</Text>
          <Row style={{ width: '100%', gap: 8, flexWrap: 'wrap' }}>
            {samplePaths.map((path) => (
              <Pressable
                key={path}
                onPress={() => beginLoad(path)}
                style={chipStyle(activePath === path, 'theme:blue')}
              >
                <Text style={{ fontSize: 9, color: activePath === path ? 'theme:ink' : 'theme:tool', fontFamily: 'monospace' }}>
                  {shortLabel(path)}
                </Text>
              </Pressable>
            ))}
          </Row>
        </S.StackX4>

        <Row style={{ width: '100%', gap: 8, flexWrap: 'wrap' }}>
          <MetricChip label="strategy" value={result ? result.strategy : 'idle'} color={tone} />
          <MetricChip label="nodes" value={result ? String(result.file.count) : '0'} />
          <MetricChip
            label="sample"
            value={result ? `${result.sampledBytes.toLocaleString()} / ${result.bytes.toLocaleString()}` : '0 / 0'}
          />
          <MetricChip label="focus" value={activePath ? shortLabel(activePath) : 'none'} />
        </Row>

        <Col
          style={{
            gap: 6,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'theme:bg1',
            backgroundColor: 'theme:bg',
          }}
        >
          <Text style={{ fontSize: 9, color: 'theme:inkDim', fontWeight: 'bold' }}>STATUS</Text>
          <Text style={{ fontSize: 10, color: pending ? 'theme:warn' : error ? 'theme:paper' : 'theme:inkDim', fontFamily: 'monospace' }}>
            {pending
              ? `generating ${activePath || draftPath}`
              : error
                ? error
                : result
                  ? `ready ${result.strategy} ${result.file.count} nodes`
                  : 'idle'}
          </Text>
          <Text style={{ fontSize: 10, color: 'theme:lilac' }}>
            {result?.note ||
              (previewMode === 'binary-squares'
                ? 'Binary preview maps each AST line span against the file average, then paints 1x1 through 9x9 bit squares.'
                : 'JSON files become object trees, text/code becomes line-and-token structure, binary files fall back to sampled byte windows.')}
          </Text>
          <Text style={{ fontSize: 9, color: 'theme:ok', fontFamily: 'monospace' }}>{activePath || draftPath || 'no path selected'}</Text>
        </Col>
      </Col>

      <S.StackX5Center>
        {result ? (
          previewMode === 'binary-squares' ? (
            <AstBinaryTile file={{ ...result.file, selected: true, tagColor: tone }} tileIndex={11} />
          ) : (
            <AstTile file={{ ...result.file, selected: true, tagColor: tone }} tileIndex={11} />
          )
        ) : (
          <EmptyPreview title="No File Loaded" detail="Pick a quick file or enter a path and generate a live fingerprint tile." />
        )}
        <Text style={{ width: PREVIEW_SIZE, fontSize: 10, color: 'theme:inkDim', textAlign: 'center' }}>
          {previewMode === 'binary-squares'
            ? 'Square side length is driven only by that span length versus the file average.'
            : 'The tile uses the same renderer as the gallery art pieces; only the file-to-tree adapter changes.'}
        </Text>
      </S.StackX5Center>
    </Row>
  );
}
