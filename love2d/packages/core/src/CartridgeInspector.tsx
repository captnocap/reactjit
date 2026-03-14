/**
 * CartridgeInspector — Trust UI for CartridgeOS
 *
 * Drop a manifest.json (or future: .cart binary) to see the full nutrition
 * label: declared capabilities, source file hashes, build metadata, and
 * signature status.
 *
 * Used both as a storybook story and as a standalone app.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Row, Col } from './primitives';
import { ScrollView } from './ScrollView';
import { useLoveRPC } from './hooks';
import type { LoveEvent } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Manifest {
  name?: string;
  version?: string;
  capabilities?: Record<string, any>;
  sources?: Array<{ file: string; hash?: string }>;
  build?: {
    commit?: string;
    timestamp?: string;
    toolchain?: string;
    bundleHash?: string;
  };
  signature?: string | null;
}

interface LoadResult {
  manifest?: Manifest;
  valid?: boolean;
  errors?: string[];
  error?: string;
  path?: string;
  size?: number;
}

// All known capability categories
const ALL_CAPABILITIES = [
  'network', 'filesystem', 'clipboard', 'storage',
  'ipc', 'gpu', 'process', 'sysmon', 'browse',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DropZone({
  dragHover,
  onDrop,
  onDragEnter,
  onDragLeave,
  error,
  colors,
}: {
  dragHover: boolean;
  onDrop: (e: LoveEvent) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  error: string | null;
  colors: any;
}) {
  return (
    <Box
      onFileDrop={onDrop}
      onFileDragEnter={onDragEnter}
      onFileDragLeave={onDragLeave}
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        backgroundColor: dragHover ? colors.bgElevated : colors.bg,
      }}
    >
      <Box
        style={{
          width: 400,
          padding: 48,
          borderWidth: 2,
          borderColor: dragHover ? colors.primary : colors.border,
          borderRadius: 12,
          alignItems: 'center',
          gap: 16,
          backgroundColor: dragHover ? colors.bg : 'transparent',
        }}
      >
        <Text style={{ fontSize: 18, color: colors.text, fontWeight: 'bold' }}>
          Cartridge Inspector
        </Text>
        <Text style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>
          {dragHover
            ? 'Release to inspect'
            : 'Drop a manifest.json to inspect'}
        </Text>
      </Box>
      {error ? (
        <Box style={{ width: 400, padding: 12, backgroundColor: '#2d1418', borderRadius: 8 }}>
          <Text style={{ fontSize: 11, color: '#f87171' }}>{error}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return (
    <Box style={{ paddingBottom: 8, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
      <Text style={{ fontSize: 11, color: colors.textDim, fontWeight: 'bold', letterSpacing: 1 }}>
        {title}
      </Text>
    </Box>
  );
}

function CapabilityRow({ name, value, colors }: { name: string; value: any; colors: any }) {
  const isGranted = value === true || (typeof value === 'object' && value !== null);
  const isDenied = value === false;
  // Not declared = not in manifest at all (undefined treated as denied)

  const indicator = isGranted ? { text: 'GRANTED', color: '#4ade80' }
    : isDenied ? { text: 'DENIED', color: '#f87171' }
    : { text: 'DENIED', color: '#6b7280' };

  return (
    <Box style={{ gap: 2, marginBottom: 6 }}>
      <Row style={{ width: '100%', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: indicator.color, fontWeight: 'bold', width: 60 }}>
          {indicator.text}
        </Text>
        <Text style={{ fontSize: 12, color: colors.text }}>
          {name}
        </Text>
      </Row>
      {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
        // Object value (e.g. filesystem paths)
        <Box style={{ paddingLeft: 68 }}>
          {Object.entries(value).map(([k, v]) => (
            <Text key={k} style={{ fontSize: 10, color: colors.textDim }}>
              {k} ({String(v)})
            </Text>
          ))}
        </Box>
      ) : null}
      {Array.isArray(value) && value.length > 0 ? (
        // Array value (e.g. network ports)
        <Box style={{ paddingLeft: 68 }}>
          {value.map((item: string, i: number) => (
            <Text key={i} style={{ fontSize: 10, color: colors.textDim }}>
              {item}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function CapabilitiesPanel({ manifest, colors }: { manifest: Manifest; colors: any }) {
  const caps = manifest.capabilities || {};
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, gap: 4 }}>
      <SectionHeader title="CAPABILITIES" colors={colors} />
      {ALL_CAPABILITIES.map(name => (
        <CapabilityRow
          key={name}
          name={name}
          value={caps[name]}
          colors={colors}
        />
      ))}
    </Box>
  );
}

function SourcesPanel({ manifest, colors }: { manifest: Manifest; colors: any }) {
  const sources = manifest.sources || [];
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, gap: 4 }}>
      <SectionHeader title="SOURCES" colors={colors} />
      {sources.length === 0 ? (
        <Text style={{ fontSize: 11, color: colors.textDim }}>No sources declared</Text>
      ) : (
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ gap: 4 }}>
            {sources.map((src, i) => (
              <Box key={i} style={{ gap: 1 }}>
                <Text style={{ fontSize: 11, color: colors.text }}>{src.file}</Text>
                {src.hash ? (
                  <Text style={{ fontSize: 9, color: colors.textDim, paddingLeft: 8 }}>
                    {src.hash.length > 20 ? src.hash.slice(0, 15) + '...' + src.hash.slice(-8) : src.hash}
                  </Text>
                ) : null}
              </Box>
            ))}
          </Box>
        </ScrollView>
      )}
      <Box style={{ paddingTop: 8, borderTopWidth: 1, borderColor: colors.border, marginTop: 8 }}>
        <Text style={{ fontSize: 10, color: colors.textDim }}>
          {sources.length} file{sources.length !== 1 ? 's' : ''}
        </Text>
      </Box>
    </Box>
  );
}

function BuildPanel({ manifest, colors }: { manifest: Manifest; colors: any }) {
  const build = manifest.build || {};
  const sig = manifest.signature;

  const rows: Array<{ label: string; value: string; color?: string }> = [
    { label: 'name', value: manifest.name || 'unknown' },
    { label: 'version', value: manifest.version || '0.0.0' },
    { label: 'commit', value: build.commit || 'none' },
    { label: 'toolchain', value: build.toolchain || 'unknown' },
    { label: 'timestamp', value: build.timestamp ? build.timestamp.split('T')[0] : 'unknown' },
  ];

  if (build.bundleHash) {
    const hash = build.bundleHash;
    rows.push({
      label: 'bundle',
      value: hash.length > 24 ? hash.slice(0, 15) + '...' + hash.slice(-8) : hash,
    });
  }

  rows.push({
    label: 'signature',
    value: sig ? 'verified' : 'unsigned',
    color: sig ? '#4ade80' : '#fbbf24',
  });

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, gap: 4 }}>
      <SectionHeader title="BUILD INFO" colors={colors} />
      {rows.map(row => (
        <Row key={row.label} style={{ width: '100%', gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 10, color: colors.textDim, width: 70, textAlign: 'right' }}>
            {row.label}
          </Text>
          <Text style={{ fontSize: 11, color: row.color || colors.text }}>
            {row.value}
          </Text>
        </Row>
      ))}
    </Box>
  );
}

function ValidationErrors({ errors, colors }: { errors: string[]; colors: any }) {
  return (
    <Box style={{ padding: 12, backgroundColor: '#2d1418', borderRadius: 8, margin: 16 }}>
      <Text style={{ fontSize: 11, color: '#fbbf24', fontWeight: 'bold', marginBottom: 4 }}>
        Validation warnings
      </Text>
      {errors.map((err, i) => (
        <Text key={i} style={{ fontSize: 10, color: '#f87171' }}>{err}</Text>
      ))}
    </Box>
  );
}

function InspectorHeader({
  manifest,
  filePath,
  onClear,
  colors,
}: {
  manifest: Manifest;
  filePath: string;
  onClear: () => void;
  colors: any;
}) {
  const fileName = filePath.split('/').pop() || filePath;
  return (
    <Row style={{
      width: '100%',
      padding: 12,
      paddingLeft: 16,
      paddingRight: 16,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
    }}>
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, color: colors.text, fontWeight: 'bold' }}>
          {manifest.name || fileName}
        </Text>
        <Text style={{ fontSize: 10, color: colors.textDim }}>
          {fileName} {manifest.version ? 'v' + manifest.version : ''}
        </Text>
      </Box>
      <Box
        onClick={onClear}
        style={{
          padding: 6,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: colors.bg,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 10, color: colors.textDim }}>Clear</Text>
      </Box>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CartridgeInspectorProps {
  /** Theme colors — pass from useThemeColors() */
  colors: {
    bg: string;
    bgElevated: string;
    text: string;
    textDim: string;
    textSecondary?: string;
    primary: string;
    border: string;
    [key: string]: any;
  };
}

export function CartridgeInspector({ colors }: CartridgeInspectorProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState(false);

  const loadManifest = useLoveRPC<LoadResult>('inspector:loadManifest');

  // rjit-ignore-next-line — framework API: cartridge inspector handlers
  const handleDrop = useCallback(async (e: LoveEvent) => {
    setDragHover(false);
    if (!e.filePath) return;

    setError(null);
    setManifest(null);
    setValidationErrors([]);

    try {
      const result = await loadManifest({ path: e.filePath });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.manifest) {
        setManifest(result.manifest);
        setFilePath(result.path || e.filePath);
        setValidationErrors(result.errors || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load manifest');
    }
  }, [loadManifest]);

  // rjit-ignore-next-line — framework API: cartridge inspector handlers
  const handleClear = useCallback(() => {
    setManifest(null);
    setFilePath('');
    setError(null);
    setValidationErrors([]);
  }, []);

  if (!manifest) {
    return (
      <DropZone
        dragHover={dragHover}
        onDrop={handleDrop}
        onDragEnter={() => setDragHover(true)}
        onDragLeave={() => setDragHover(false)}
        error={error}
        colors={colors}
      />
    );
  }

  return (
    <Box
      onFileDrop={handleDrop}
      onFileDragEnter={() => setDragHover(true)}
      onFileDragLeave={() => setDragHover(false)}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.bg,
      }}
    >
      <InspectorHeader
        manifest={manifest}
        filePath={filePath}
        onClear={handleClear}
        colors={colors}
      />

      {validationErrors.length > 0 ? (
        <ValidationErrors errors={validationErrors} colors={colors} />
      ) : null}

      {/* Three-panel layout */}
      <Row style={{
        width: '100%',
        flexGrow: 1,
        gap: 0,
      }}>
        <CapabilitiesPanel manifest={manifest} colors={colors} />
        <Box style={{ width: 1, backgroundColor: colors.border }} />
        <SourcesPanel manifest={manifest} colors={colors} />
        <Box style={{ width: 1, backgroundColor: colors.border }} />
        <BuildPanel manifest={manifest} colors={colors} />
      </Row>
    </Box>
  );
}
