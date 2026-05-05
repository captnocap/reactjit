import { Box, Col, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { BrowserTabState } from '../../lib/browser/tabs';
import type { BrowserPageState } from '../../lib/browser/navigation';

export function BrowserView(props: {
  tab: BrowserTabState | null;
  page: BrowserPageState | null;
  httpAvailable: boolean;
}) {
  return (
    <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Col style={{ gap: 10, padding: 12 }}>
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
            This browser fetches HTTP but does not render HTML - showing raw body.
          </Text>
        </Box>

        {!props.httpAvailable ? (
          <Box style={{ padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>
              HTTP host bindings are missing. The browser needs `__http_request_async` or `__http_request_sync` to fetch real pages.
            </Text>
          </Box>
        ) : null}

        {!props.tab || !props.tab.url ? (
          <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Enter a URL to fetch.</Text>
          </Box>
        ) : props.page?.loading ? (
          <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Fetching {props.page.url || props.tab.url}…</Text>
          </Box>
        ) : props.page?.error ? (
          <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
            <Text fontSize={12} color={COLORS.red} style={{ fontWeight: 'bold' }}>{props.page.error}</Text>
          </Box>
        ) : props.page ? (
          <Col style={{ gap: 8 }}>
            <Box style={{ padding: 10, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={9} color={COLORS.textDim}>status {props.page.status} · {props.page.contentType || 'unknown content-type'} · {props.page.finalUrl}</Text>
            </Box>
            <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, whiteSpace: 'pre-wrap' }}>{props.page.body || '(empty body)'}</Text>
            </Box>
          </Col>
        ) : props.tab?.url ? (
          <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Press Fetch to load raw body.</Text>
          </Box>
        ) : (
          <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Enter a URL to fetch.</Text>
          </Box>
        )}
      </Col>
    </ScrollView>
  );
}
