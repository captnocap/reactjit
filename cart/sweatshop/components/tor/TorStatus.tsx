import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { probeReachability, type ReachabilityResult } from '../../lib/tor/reachability';

// Reconnaissance surface — no IRC, no connect button, no saved servers.
// Just a status row that tells the user whether a local Tor daemon is
// reachable so follow-up work (IRC over SOCKS5, control-port circuit
// queries, etc.) knows if the prerequisite is in place.

function ago(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 1500) return 'just now';
  if (delta < 60000) return Math.floor(delta / 1000) + 's ago';
  return Math.floor(delta / 60000) + 'm ago';
}

function StatusDot(props: { tone: 'green' | 'amber' | 'red' }) {
  const color = props.tone === 'green' ? COLORS.green : props.tone === 'amber' ? COLORS.yellow : COLORS.red;
  return (
    <Box style={{
      width: 10, height: 10,
      borderRadius: TOKENS.radiusPill,
      backgroundColor: color,
    }} />
  );
}

function PortRow(props: {
  label: string;
  host: string;
  port: number;
  tone: 'green' | 'amber' | 'red';
  headline: string;
  detail?: string;
}) {
  return (
    <Row style={{
      padding: TOKENS.padNormal,
      gap: TOKENS.spaceSm,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1, borderColor: COLORS.borderSoft,
      backgroundColor: COLORS.panelAlt,
      alignItems: 'center',
    }}>
      <StatusDot tone={props.tone} />
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
        <Row style={{ gap: 8, alignItems: 'baseline' }}>
          <Text fontSize={TOKENS.fontSm} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>{props.label}</Text>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{props.host}:{props.port}</Text>
        </Row>
        <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontUI }}>{props.headline}</Text>
        {props.detail ? <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{props.detail}</Text> : null}
      </Col>
    </Row>
  );
}

export function TorStatus() {
  const [result, setResult] = useState<ReachabilityResult | null>(null);
  const [probing, setProbing] = useState(false);

  const runProbe = useCallback(() => {
    setProbing(true);
    // probeReachability is synchronous (__exec is sync today); defer so
    // the 'Probing…' label actually paints once before we block.
    const id = (globalThis as any).setTimeout(() => {
      setResult(probeReachability());
      setProbing(false);
    }, 0);
    return () => (globalThis as any).clearTimeout(id);
  }, []);

  useEffect(() => { runProbe(); }, [runProbe]);

  const socksTone: 'green' | 'amber' | 'red' = !result ? 'amber' : result.hasSocks ? 'green' : 'red';
  const controlTone: 'green' | 'amber' | 'red' = !result ? 'amber' : result.hasControl ? 'green' : 'red';

  const socksHeadline = !result ? 'probing…' : result.hasSocks ? 'SOCKS5 listener reachable' : 'no listener';
  const socksDetail = !result ? undefined
    : result.error ? result.error
    : result.hasSocks ? 'ready to accept CONNECT requests (SOCKS5 handshake not yet verified)'
    : 'install tor: apt install tor && systemctl start tor';

  const controlHeadline = !result ? 'probing…'
    : result.hasControl ? 'Tor control port confirmed (PROTOCOLINFO 250)'
    : 'no Tor control port';
  const controlDetail = !result ? undefined
    : result.error ? result.error
    : result.hasControl ? result.controlBanner
    : 'enable ControlPort 9051 in /etc/tor/torrc if you want circuit info';

  return (
    <Col style={{
      padding: TOKENS.padLoose,
      gap: TOKENS.spaceSm,
      backgroundColor: COLORS.panelBg,
      flexGrow: 1, flexBasis: 0,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>Tor Reachability</Text>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI }}>
          reconnaissance only — no IRC connect yet
        </Text>
        <Box style={{ flexGrow: 1, flexBasis: 0 }} />
        {result ? <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>probed {ago(result.probedAt)}</Text> : null}
        <Pressable onPress={runProbe}>
          <Box style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusXs, borderWidth: 1,
            borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
            opacity: probing ? 0.6 : 1,
          }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontWeight: 'bold' }}>{probing ? 'Probing…' : 'Re-probe'}</Text>
          </Box>
        </Pressable>
      </Row>

      {result?.error ? (
        <Box style={{
          padding: TOKENS.padNormal, borderRadius: TOKENS.radiusSm,
          borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep,
        }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.yellow}>{result.error}</Text>
        </Box>
      ) : null}

      <PortRow label="SOCKS5"        host="127.0.0.1" port={9050} tone={socksTone}   headline={socksHeadline}   detail={socksDetail} />
      <PortRow label="Control Port"  host="127.0.0.1" port={9051} tone={controlTone} headline={controlHeadline} detail={controlDetail} />

      <Box style={{
        padding: TOKENS.padNormal,
        borderRadius: TOKENS.radiusSm,
        borderWidth: 1, borderColor: COLORS.borderSoft,
        backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>
          Raw TCP from the cart still requires a JS binding for framework/net/socks5.zig
          (no v8_bindings_socks5.zig today). This panel uses the kernel TCP stack
          through __exec to keep the reconnaissance result honest.
        </Text>
      </Box>
    </Col>
  );
}
