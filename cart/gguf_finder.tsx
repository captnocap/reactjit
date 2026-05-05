// gguf_finder — type a path, walk 5 layers deep, list every .gguf file found.
//
// Exercises the @reactjit/runtime/hooks/fs binding (listDir + stat). The walk
// is breadth-first so shallow hits surface first; hidden dirs (`.`-prefixed)
// are skipped because every gguf I've ever seen lives in a non-hidden tree.
//
// fs.stat returns { size, mtimeMs, isDir } — there is NO isFile/isDirectory
// field. Earlier copies of this walker checked the wrong key and silently
// found nothing.

import { useState } from 'react';
import { Box, Col, Row, Text, TextInput, Pressable, ScrollView } from '@reactjit/runtime/primitives';
import * as fs from '@reactjit/runtime/hooks/fs';

const MAX_DEPTH = 5;
const MAX_FILES = 500;

type LogLine = { depth: number; kind: 'dir' | 'hit' | 'skip' | 'err' | 'info'; msg: string };

type WalkResult = {
  hits: string[];
  dirs: number;
  perDepth: { dirs: number; files: number; hits: number }[];
  truncated: boolean;
  ms: number;
  error: string | null;
  log: LogLine[];
};

function walkForGgufs(root: string): WalkResult {
  const start = Date.now();
  const out: string[] = [];
  const log: LogLine[] = [];
  const perDepth: { dirs: number; files: number; hits: number }[] = [];
  for (let i = 0; i <= MAX_DEPTH; i++) perDepth.push({ dirs: 0, files: 0, hits: 0 });
  let truncated = false;

  const rootStat = fs.stat(root);
  if (!rootStat) {
    return {
      hits: [], dirs: 0, perDepth, truncated: false, ms: 0,
      error: `path not found: ${root}`,
      log: [{ depth: 0, kind: 'err', msg: `stat null on root ${root}` }],
    };
  }
  log.push({ depth: 0, kind: 'info', msg: `root stat: isDir=${rootStat.isDir} size=${rootStat.size}` });

  // If they pointed at a single .gguf file directly.
  if (!rootStat.isDir && root.toLowerCase().endsWith('.gguf')) {
    return {
      hits: [root], dirs: 0, perDepth, truncated: false, ms: Date.now() - start,
      error: null, log,
    };
  }

  const queue: { path: string; depth: number }[] = [{ path: root, depth: 0 }];
  let totalDirs = 0;
  while (queue.length > 0 && out.length < MAX_FILES) {
    const { path, depth } = queue.shift()!;
    totalDirs += 1;
    perDepth[depth].dirs += 1;
    let entries: string[] = [];
    try {
      entries = fs.listDir(path) || [];
    } catch (e: any) {
      log.push({ depth, kind: 'err', msg: `listDir threw on ${path}: ${e?.message || e}` });
      continue;
    }
    log.push({ depth, kind: 'dir', msg: `[d=${depth}] ${path} → ${entries.length} entries` });

    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const full = `${path}/${name}`;
      const st = fs.stat(full);
      if (!st) {
        log.push({ depth, kind: 'skip', msg: `stat null: ${full}` });
        continue;
      }
      if (st.isDir) {
        if (depth < MAX_DEPTH) {
          queue.push({ path: full, depth: depth + 1 });
        }
      } else {
        perDepth[depth].files += 1;
        if (name.toLowerCase().endsWith('.gguf')) {
          out.push(full);
          perDepth[depth].hits += 1;
          log.push({ depth, kind: 'hit', msg: `HIT: ${full}` });
          if (out.length >= MAX_FILES) {
            truncated = true;
            break;
          }
        }
      }
    }
  }
  out.sort();
  return { hits: out, dirs: totalDirs, perDepth, truncated, ms: Date.now() - start, error: null, log };
}

const BG = '#0d0f12';
const PANEL = '#161a20';
const ACCENT = '#8be9fd';
const MUTED = '#6c7480';
const TEXT = '#e6e6e6';
const ERR = '#ff6b6b';
const HIT = '#a3e635';
const DIR = '#7aa2f7';

const LOG_COLORS: Record<LogLine['kind'], string> = {
  dir: DIR, hit: HIT, skip: MUTED, err: ERR, info: ACCENT,
};

export default function GgufFinder() {
  const [path, setPath] = useState('/home/siah');
  const [result, setResult] = useState<WalkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLog, setShowLog] = useState(true);

  const run = () => {
    if (!path) return;
    setBusy(true);
    setTimeout(() => {
      setResult(walkForGgufs(path));
      setBusy(false);
    }, 0);
  };

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 24 }}>
      <Col style={{ gap: 16, height: '100%' }}>
        <Col style={{ gap: 4 }}>
          <Text fontSize={20} color={TEXT} bold style={{ letterSpacing: 1.2 }}>
            GGUF · FINDER
          </Text>
          <Text fontSize={11} color={MUTED}>
            Walk a directory {MAX_DEPTH} levels deep for *.gguf files. Hidden dirs skipped.
          </Text>
        </Col>

        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Box style={{ flexGrow: 1, backgroundColor: PANEL, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
            <TextInput
              value={path}
              onChangeText={(t: string) => setPath(t)}
              placeholder="/path/to/search"
              style={{ color: TEXT, fontSize: 13, fontFamily: 'mono' }}
            />
          </Box>
          <Pressable
            onPress={run}
            style={{
              backgroundColor: busy ? '#2a3340' : ACCENT,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 6,
            }}
          >
            <Text fontSize={12} color={busy ? MUTED : '#0d0f12'} bold>
              {busy ? 'SCANNING…' : 'SCAN'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowLog(v => !v)}
            style={{
              backgroundColor: PANEL,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 6,
            }}
          >
            <Text fontSize={12} color={showLog ? ACCENT : MUTED} bold>
              {showLog ? 'LOG ON' : 'LOG OFF'}
            </Text>
          </Pressable>
        </Row>

        {result && (
          <Col style={{ gap: 6 }}>
            <Row style={{ gap: 16 }}>
              <Text fontSize={11} color={HIT}>
                {result.hits.length} hit{result.hits.length === 1 ? '' : 's'}
              </Text>
              <Text fontSize={11} color={MUTED}>{result.dirs} dirs walked</Text>
              <Text fontSize={11} color={MUTED}>{result.ms} ms</Text>
              {result.truncated && <Text fontSize={11} color={ACCENT}>truncated @ {MAX_FILES}</Text>}
              {result.error && <Text fontSize={11} color={ERR}>{result.error}</Text>}
            </Row>
            <Row style={{ gap: 12, flexWrap: 'wrap' }}>
              {result.perDepth.map((d, i) => (
                d.dirs > 0 || d.files > 0 ? (
                  <Text key={i} fontSize={10} color={d.hits > 0 ? HIT : MUTED} style={{ fontFamily: 'mono' }}>
                    d{i}: {d.dirs}dir / {d.files}file{d.hits > 0 ? ` / ${d.hits}HIT` : ''}
                  </Text>
                ) : null
              ))}
            </Row>
          </Col>
        )}

        <Box style={{ flexGrow: 1, backgroundColor: PANEL, borderRadius: 8, padding: 12, height: '100%' }}>
          <ScrollView style={{ height: '100%' }}>
            <Col style={{ gap: 2 }}>
              {!result && (
                <Text fontSize={12} color={MUTED}>
                  Enter a path and press SCAN.
                </Text>
              )}
              {result && result.hits.length === 0 && !result.error && !showLog && (
                <Text fontSize={12} color={MUTED}>No .gguf files found. Toggle LOG ON to see what was walked.</Text>
              )}
              {result && !showLog && result.hits.map((p, i) => (
                <Text key={i} fontSize={12} color={HIT} style={{ fontFamily: 'mono' }}>
                  {p}
                </Text>
              ))}
              {result && showLog && result.log.map((l, i) => (
                <Text key={i} fontSize={11} color={LOG_COLORS[l.kind]} style={{ fontFamily: 'mono' }}>
                  {' '.repeat(l.depth * 2)}{l.msg}
                </Text>
              ))}
            </Col>
          </ScrollView>
        </Box>
      </Col>
    </Box>
  );
}
