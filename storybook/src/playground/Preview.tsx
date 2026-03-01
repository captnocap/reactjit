/**
 * Preview — Right pane that renders the user's component.
 */

import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

interface PreviewProps { UserComponent: React.ComponentType | null; errors: string[]; }

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: any; colors: { bgElevated: string; error: string } },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMessage: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMessage: error?.message || String(error) }; }
  componentDidUpdate(prev: any) { if (prev.resetKey !== this.props.resetKey && this.state.hasError) this.setState({ hasError: false, errorMessage: '' }); }
  render() {
    const { colors } = this.props;
    if (this.state.hasError) return (
      <Box style={{ padding: 16, backgroundColor: colors.bgElevated, borderRadius: 8, margin: 12 }}>
        <Text style={{ color: colors.error, fontSize: 13, fontWeight: 'normal' }}>Runtime Error</Text>
        <Box style={{ height: 8 }} />
        <Text style={{ color: colors.error, fontSize: 12 }}>{this.state.errorMessage}</Text>
      </Box>
    );
    return this.props.children;
  }
}

export function Preview({ UserComponent, errors }: PreviewProps) {
  const c = useThemeColors();
  const hasErrors = errors.length > 0;
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, height: '100%', backgroundColor: c.bg }}>
      <Box style={{ height: 32, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>Preview</Text>
        {hasErrors && (
          <Box style={{ backgroundColor: c.error, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
            <Text style={{ color: c.error, fontSize: 9 }}>ERROR</Text>
          </Box>
        )}
      </Box>
      {/* rjit-ignore-next-line */}
      <Box style={{ flexGrow: 1, overflow: 'scroll', padding: 12, textScale: 1 }}>
        {hasErrors ? (
          <Box style={{ padding: 16, backgroundColor: c.bgElevated, borderRadius: 8 }}>
            {errors.map((err, i) => (
              <Box key={i} style={{ paddingBottom: i < errors.length - 1 ? 8 : 0 }}>
                <Text style={{ color: c.error, fontSize: 12 }}>{err}</Text>
              </Box>
            ))}
          </Box>
        ) : UserComponent ? (
          <ErrorBoundary resetKey={UserComponent} colors={{ bgElevated: c.bgElevated, error: c.error }}><UserComponent /></ErrorBoundary>
        ) : (
          <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.textDim, fontSize: 14 }}>Type JSX to see it render here</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
