const React: any = require('react');
import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { SearchScope as Scope } from './useSearchEngine';

export interface SearchScopeProps {
  scope: Scope;
  onChange: (s: Scope) => void;
  customGlob: string;
  onCustomGlobChange: (g: string) => void;
  openFileCount: number;
  currentFile?: string | null;
  hasSelection?: boolean;
}

interface Option { id: Scope; label: string; hint: string; }

const OPTIONS: Option[] = [
  { id: 'currentFile', label: 'File',      hint: 'current buffer'     },
  { id: 'openFiles',   label: 'Open',      hint: 'all open tabs'      },
  { id: 'selection',   label: 'Selection', hint: 'marked range only'  },
  { id: 'directory',   label: 'Directory', hint: 'whole workspace'    },
  { id: 'customGlob',  label: 'Glob',      hint: 'custom pattern'     },
];

export function SearchScope(props: SearchScopeProps) {
  const { scope, onChange, customGlob, onCustomGlobChange, openFileCount, currentFile, hasSelection } = props;
  const tone = COLORS.green || '#7ee787';

  return (
    <Col style={{
      gap: 6, padding: 8,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>SCOPE</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{scopeSummary(scope, { openFileCount, currentFile, hasSelection })}</Text>
      </Row>

      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {OPTIONS.map((opt) => {
          const active = scope === opt.id;
          const disabled = (opt.id === 'selection' && !hasSelection) || (opt.id === 'currentFile' && !currentFile);
          return (
            <Pressable
              key={opt.id}
              onPress={() => { if (!disabled) onChange(opt.id); }}
              style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
                borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
                opacity: disabled ? 0.4 : 1,
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textBright, fontSize: 10, fontWeight: 700 }}>{opt.label}</Text>
              <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 8 }}>{opt.hint}</Text>
            </Pressable>
          );
        })}
      </Row>

      {scope === 'customGlob' ? (
        <Box style={{
          backgroundColor: COLORS.panelAlt || '#05090f',
          borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
          paddingHorizontal: 8, paddingVertical: 4,
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>glob</Text>
          <TextInput
            value={customGlob}
            placeholder="src/**/*.tsx"
            onChangeText={(t: string) => onCustomGlobChange(t)}
            style={{ flexGrow: 1, fontSize: 11, color: COLORS.textBright }}
          />
        </Box>
      ) : null}
    </Col>
  );
}

function scopeSummary(scope: Scope, ctx: { openFileCount: number; currentFile?: string | null; hasSelection?: boolean }): string {
  if (scope === 'currentFile') return ctx.currentFile ? basename(ctx.currentFile) : '(no file open)';
  if (scope === 'openFiles')   return ctx.openFileCount + ' open files';
  if (scope === 'selection')   return ctx.hasSelection ? 'marked range' : '(no selection)';
  if (scope === 'directory')   return 'workspace root';
  return 'custom glob';
}

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}
