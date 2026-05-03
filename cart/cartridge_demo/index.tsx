// cartridge_demo — host cart that demonstrates <Cartridge>.
//
// Mounts a guest cart by path. The guest writes rows to a shared in-memory
// "database" exposed via cart/cartridge_demo/shared_db.ts. The host reads
// from the same store and renders the rows. A toggle button drops the guest
// when not needed (React unmounts its subtree, registry entries are
// released; the cached bundle bytes stay in V8 until evictCartridge() runs).

import { useDB, addRow, clearRows } from './shared_db';

// The guest's bundle path. Built by:
//   tools/v8cli scripts/cart-bundle.js cart/cartridge_demo/guest.tsx \
//     --out bundle-cartridge_demo_guest.cart.js --cartridge
const GUEST_BUNDLE = 'bundle-cartridge_demo_guest.cart.js';

export default function CartridgeDemo() {
  const { rows } = useDB();
  const [showGuest, setShowGuest] = useState(true);

  return (
    <Col style={{ width: '100%', height: '100%', padding: 24, gap: 16, backgroundColor: '#0c1016' }}>
      <Text style={{ fontSize: 22, color: '#e8edf2' }}>Cartridge demo — host</Text>
      <Text style={{ fontSize: 13, color: '#8a96a8' }}>
        Both halves share the same DB. Toggle drops the guest entirely.
      </Text>

      <Row style={{ gap: 8 }}>
        <Pressable
          onPress={() => addRow('host row #' + (rows.length + 1), 'host')}
          style={{ padding: 10, backgroundColor: '#1f2a3a', borderRadius: 6 }}
        >
          <Text style={{ color: '#cfd8e3' }}>+ host row</Text>
        </Pressable>
        <Pressable
          onPress={() => clearRows()}
          style={{ padding: 10, backgroundColor: '#3a1f1f', borderRadius: 6 }}
        >
          <Text style={{ color: '#cfd8e3' }}>clear</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowGuest((v) => !v)}
          style={{ padding: 10, backgroundColor: '#1f3a2c', borderRadius: 6 }}
        >
          <Text style={{ color: '#cfd8e3' }}>{showGuest ? 'unmount guest' : 'mount guest'}</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 16, flexGrow: 1 }}>
        <Col style={{ flexGrow: 1, padding: 12, backgroundColor: '#141a24', borderRadius: 8, gap: 6 }}>
          <Text style={{ color: '#7ba3d9', fontSize: 14 }}>shared DB ({rows.length} rows)</Text>
          {rows.map((r) => (
            <Text key={r.id} style={{ color: '#cfd8e3', fontSize: 13 }}>
              [{r.owner}] {r.text}
            </Text>
          ))}
          {rows.length === 0 && <Text style={{ color: '#5a6478', fontSize: 12 }}>(empty — click any add button)</Text>}
        </Col>

        <Col style={{ flexGrow: 1, padding: 12, backgroundColor: '#141a24', borderRadius: 8 }}>
          <Text style={{ color: '#d97b9e', fontSize: 14, marginBottom: 8 }}>guest cartridge</Text>
          {showGuest
            ? <Cartridge src={GUEST_BUNDLE} />
            : <Text style={{ color: '#5a6478', fontSize: 12 }}>(unmounted)</Text>}
        </Col>
      </Row>
    </Col>
  );
}
