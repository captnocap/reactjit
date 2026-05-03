// cartridge_probe — empirical test of the predicted cartridge interop
// failure modes. Each section runs an experiment whose outcome shows up as
// rendered text the autotest can assert on.

import { Component } from 'react';
import { getMarker } from './singleton';
import { ProbeCtx } from './ctx';
import { cacheSize } from '@reactjit/runtime/cartridge_loader';

// Thin error boundary so a guest's render-throw is contained to its
// section instead of unmounting the whole cart. The boundary's existence
// is itself the test of failure-mode #3 — if you delete it and re-ship,
// the host tree dies.
class GuestBoundary extends Component<any, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Text style={{ color: '#ff8a8a', fontSize: 13 }}>
          boundary caught: {String(this.state.error?.message || this.state.error)}
        </Text>
      );
    }
    return this.props.children;
  }
}

const GUEST = 'bundle-cartridge_probe_guest.cart.js';
const THROWER = 'bundle-cartridge_probe_thrower.cart.js';

function Section({ title, children }: any) {
  return (
    <Col style={{ padding: 12, gap: 6, backgroundColor: '#141a24', borderRadius: 8 }}>
      <Text style={{ color: '#7ba3d9', fontSize: 14 }}>{title}</Text>
      {children}
    </Col>
  );
}

export default function Probe() {
  const hostMarker = getMarker();
  const [showGuest, setShowGuest] = useState(true);
  const [, force] = useState(0);
  const cache = cacheSize();

  return (
    <Col style={{ width: '100%', height: '100%', padding: 24, gap: 12, backgroundColor: '#0c1016' }}>
      <Text style={{ fontSize: 22, color: '#e8edf2' }}>Cartridge probe</Text>

      <Section title="1. module singleton sharing">
        <Text style={{ color: '#cfd8e3', fontSize: 13 }}>host singleton marker: {hostMarker}</Text>
        {showGuest && <Cartridge src={GUEST} />}
        <Text style={{ color: '#5a6478', fontSize: 11 }}>
          same number = shared module instance, different = duplicated copy in guest bundle
        </Text>
      </Section>

      <Section title="2. React context across boundary">
        <ProbeCtx.Provider value="from-host">
          {showGuest && <Cartridge src={GUEST} />}
        </ProbeCtx.Provider>
        <Text style={{ color: '#5a6478', fontSize: 11 }}>
          'from-host' = context shared, 'default-value (provider not seen)' = guest got its own ctx object
        </Text>
      </Section>

      <Section title="3. guest render-throw containment (with boundary)">
        <GuestBoundary>
          <Cartridge src={THROWER} />
        </GuestBoundary>
        <Text style={{ color: '#5a6478', fontSize: 11 }}>
          if the boundary caught the throw, the rest of this cart still renders below
        </Text>
      </Section>

      <Section title="4. loader cache after unmount">
        <Text style={{ color: '#cfd8e3', fontSize: 13 }}>cache size now: {cache}</Text>
        <Row style={{ gap: 8 }}>
          <Pressable
            onPress={() => setShowGuest((v: boolean) => !v)}
            style={{ padding: 8, backgroundColor: '#1f2a3a', borderRadius: 4 }}
          >
            <Text style={{ color: '#cfd8e3' }}>{showGuest ? 'unmount guests' : 'mount guests'}</Text>
          </Pressable>
          <Pressable
            onPress={() => force((x: number) => x + 1)}
            style={{ padding: 8, backgroundColor: '#1f3a2c', borderRadius: 4 }}
          >
            <Text style={{ color: '#cfd8e3' }}>refresh</Text>
          </Pressable>
        </Row>
        <Text style={{ color: '#5a6478', fontSize: 11 }}>
          unmount drops the React subtree but the loader cache is module-scope and not auto-evicted
        </Text>
      </Section>

      <Text style={{ color: '#7be8a3', fontSize: 14 }}>tail marker — reaching this means host survived</Text>
    </Col>
  );
}
