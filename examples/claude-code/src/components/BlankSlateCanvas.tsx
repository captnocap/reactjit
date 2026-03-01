/**
 * BlankSlateCanvas — React-side renderer for Claude's semantic token stream.
 *
 * Uses claude:classified — reads vterm directly, works from frame 0.
 * DEBUG MODE: Logs poll results.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Text, ScrollView, Pressable, useLoveRPC, useWindowDimensions } from '@reactjit/core';
import { getTokenStyle } from '../lib/token-styles';
import { C } from '../theme';

// ── Types ────────────────────────────────────────────────────────

interface ClassifiedRow {
  row: number;
  kind: string;
  text: string;
}

interface ClassifiedResult {
  rows: ClassifiedRow[];
  mode: string;
  boundary: number;
}

// ── Layout constants ─────────────────────────────────────────────

const ROW_H = 18;
const INPUT_BAR_H = 46;
const CONTENT_GAP = 20;
const STRIPE_EVEN = '#0a1028';
const STRIPE_ODD = '#080c1e';

const HIDDEN_TOKENS = new Set([
  'status_bar',
  'input_border',
  'input_zone',
  'user_input',
  'idle_prompt',
  'image_attachment',
]);

const BANNER_TOKENS = new Set(['banner']);

// ── Text cleanup ─────────────────────────────────────────────────
// Strip box-drawing, border glyphs, and terminal decoration from display text.
// These are presentation artifacts from the CLI's TUI — the pretty side shows clean text.
const BOX_DRAWING_RE = /[\u2500-\u257F\u2580-\u259F\u2190-\u21FF\u256C\u2550-\u256B⎿⎡⎣⎤⎥⎢│┌┐└┘├┤┬┴┼─━╭╮╯╰]/g;

function cleanText(raw: string): string {
  return raw.replace(BOX_DRAWING_RE, '').replace(/\s{2,}/g, ' ').trim();
}

// ── Row renderer ─────────────────────────────────────────────────

function RowLine({ kind, text, even }: { kind: string; text: string; even: boolean }) {
  const style = getTokenStyle(kind, text);
  const display = cleanText(text);
  if (!display) return null;
  return (
    <Box style={{
      width: '100%',
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 3,
      paddingBottom: 3,
    }}>
      <Text style={{
        fontSize: style.fontSize ?? 13,
        color: style.color,
        fontWeight: style.fontWeight,
        opacity: even ? style.opacity : (style.opacity ?? 1) * 0.85,
      }}>
        {display}
      </Text>
    </Box>
  );
}

const MemoRow = React.memo(RowLine, (prev, next) =>
  prev.kind === next.kind && prev.text === next.text && prev.even === next.even
);

function FillRow({ idx }: { idx: number }) {
  return (
    <Box style={{
      width: '100%',
      height: ROW_H,
      backgroundColor: idx % 2 === 0 ? STRIPE_EVEN : STRIPE_ODD,
    }} />
  );
}

const MemoFill = React.memo(FillRow);

// ── Main component ───────────────────────────────────────────────

export function BlankSlateCanvas({ sessionId = 'default', windowHeight }: { sessionId?: string; windowHeight?: number }) {
  const dims = useWindowDimensions();
  const winH = windowHeight || dims.height || 735;
  const rpcClassified = useLoveRPC('claude:classified');
  const rpcRef = useRef(rpcClassified);
  rpcRef.current = rpcClassified;

  const rpcImages = useLoveRPC('claude:images');
  const imagesRef = useRef(rpcImages);
  imagesRef.current = rpcImages;

  const rpcOpenFile = useLoveRPC('claude:openFile');
  const openFileRef = useRef(rpcOpenFile);
  openFileRef.current = rpcOpenFile;

  const rpcRemoveImage = useLoveRPC('claude:removeImage');
  const removeImageRef = useRef(rpcRemoveImage);
  removeImageRef.current = rpcRemoveImage;

  const [rows, setRows] = useState<ClassifiedRow[]>([]);
  const [mode, setMode] = useState('idle');
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const lastFpRef = useRef('');
  const pollCountRef = useRef(0);

  const log = (msg: string) => {
    console.log('[BlankSlate] ' + msg);
    setDebugLog(prev => [...prev.slice(-14), msg]);
  };

  // ── Poll classified rows ─────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      pollCountRef.current++;
      const n = pollCountRef.current;

      try {
        const res = await rpcRef.current({ session: sessionId }) as ClassifiedResult;
        const rowList = Array.isArray(res?.rows) ? res.rows : [];

        if (n <= 5 || n % 20 === 0) {
          log(`poll#${n} rows=${rowList.length} mode=${res?.mode ?? 'nil'}`);
          if (rowList.length > 0) {
            const kindCounts: Record<string, number> = {};
            for (const r of rowList) kindCounts[r.kind] = (kindCounts[r.kind] || 0) + 1;
            log(`poll#${n} kinds: ${JSON.stringify(kindCounts)}`);
            log(`poll#${n} first3: ${rowList.slice(0, 3).map(r => `r${r.row}:${r.kind}`).join(' ')}`);
            log(`poll#${n} last3: ${rowList.slice(-3).map(r => `r${r.row}:${r.kind}`).join(' ')}`);
          }
        }

        if (rowList.length === 0) return;

        // Fingerprint
        const fp = rowList.length + ':' + res.mode + ':' + (rowList[rowList.length - 1]?.text ?? '').slice(0, 40);
        if (fp === lastFpRef.current) return;
        lastFpRef.current = fp;

        log(`UPDATED: ${rowList.length} rows, mode=${res.mode}`);
        setRows(rowList);
        setMode(res.mode ?? 'idle');
      } catch (err: any) {
        if (n <= 5 || n % 20 === 0) {
          log(`ERROR: ${err?.message ?? String(err)}`);
        }
      }
    };

    log(`mounted sessionId=${sessionId} winH=${winH}`);
    const interval = setInterval(poll, 250);
    poll();
    return () => { alive = false; clearInterval(interval); };
  }, [sessionId]);

  // ── Fetch image paths when attachments are present ───────────
  useEffect(() => {
    if (rows.some(r => r.kind === 'image_attachment')) {
      imagesRef.current({}).then((res: any) => {
        if (Array.isArray(res?.images)) setImagePaths(res.images);
      }).catch(() => {});
    }
  }, [rows]);

  // ── Split rows + merge consecutive same-kind into paragraphs ──
  const { bannerRows, contentRows, imageRows } = useMemo(() => {
    const banner: ClassifiedRow[] = [];
    const content: ClassifiedRow[] = [];
    const images: ClassifiedRow[] = [];
    let pastBanner = false;

    for (const r of rows) {
      if (r.kind === 'image_attachment') {
        images.push({ ...r });
        continue;
      }
      if (HIDDEN_TOKENS.has(r.kind)) continue;
      if (!pastBanner && BANNER_TOKENS.has(r.kind)) {
        // Merge consecutive banner rows into paragraphs
        const prev = banner.length > 0 ? banner[banner.length - 1] : null;
        if (prev && r.text.trim().length > 0 && prev.text.trim().length > 0) {
          prev.text = prev.text.trimEnd() + ' ' + r.text.trimStart();
        } else {
          banner.push({ ...r });
        }
      } else {
        pastBanner = true;
        // Merge consecutive rows of the same kind into one paragraph
        const prev = content.length > 0 ? content[content.length - 1] : null;
        if (prev && prev.kind === r.kind && r.text.trim().length > 0 && prev.text.trim().length > 0) {
          // Join with space (the terminal wrapped mid-sentence)
          prev.text = prev.text.trimEnd() + ' ' + r.text.trimStart();
        } else {
          content.push({ ...r });
        }
      }
    }

    return { bannerRows: banner, contentRows: content, imageRows: images };
  }, [rows]);

  // ── Fill count from window math ──────────────────────────────
  const bannerH = bannerRows.length > 0 ? (bannerRows.length * ROW_H + 13) : 0;
  const available = winH - bannerH - INPUT_BAR_H - CONTENT_GAP;
  const totalSlots = Math.max(0, Math.floor(available / ROW_H));
  const fillCount = Math.max(0, totalSlots - contentRows.length);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column', backgroundColor: C.bg }}>
      {/* Banner */}
      {bannerRows.length > 0 && (
        <Box style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderColor: C.border + '44',
        }}>
          {bannerRows.map((r, i) => (
            <MemoRow key={i} kind={r.kind} text={r.text} even={i % 2 === 0} />
          ))}
        </Box>
      )}

      {/* Content + fill */}
      <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={{ padding: 0 }}>
        {contentRows.map((r, i) => (
          <MemoRow key={r.row} kind={r.kind} text={r.text} even={i % 2 === 0} />
        ))}
        {Array.from({ length: fillCount }, (_, i) => (
          <MemoFill key={`f${i}`} idx={contentRows.length + i} />
        ))}
      </ScrollView>

      {/* Image attachments */}
      {imageRows.length > 0 && (
        <Box style={{
          flexShrink: 0,
          flexDirection: 'row',
          gap: 8,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 4,
        }}>
          {imageRows.map((r, i) => {
            const label = r.text.replace(/[⎿\s]+/g, ' ').trim();
            const path = imagePaths[i] ?? null;
            return (
              <Box key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                <Pressable
                  onPress={() => { if (path) openFileRef.current({ path }); }}
                >
                  <Box style={{
                    paddingLeft: 8,
                    paddingRight: 6,
                    paddingTop: 3,
                    paddingBottom: 3,
                    borderRadius: 4,
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRightWidth: 0,
                  }}>
                    <Text style={{ fontSize: 11, color: path ? C.accent : C.muted }}>
                      {label}
                    </Text>
                  </Box>
                </Pressable>
                <Pressable
                  onPress={() => { removeImageRef.current({ index: i, total: imageRows.length }); }}
                >
                  <Box style={{
                    paddingLeft: 5,
                    paddingRight: 5,
                    paddingTop: 3,
                    paddingBottom: 3,
                    borderRadius: 4,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    backgroundColor: C.surface,
                    borderWidth: 1,
                    borderColor: C.border,
                  }}>
                    <Text style={{ fontSize: 11, color: C.muted }}>{'\u00D7'}</Text>
                  </Box>
                </Pressable>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
