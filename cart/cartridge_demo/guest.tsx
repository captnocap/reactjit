// Guest cartridge — gets bundled with `cart-bundle.js --cartridge` and
// loaded by the host's <Cartridge src=…>. Imports the shared DB from the
// SAME relative path as the host; the import is bundled into the guest, but
// the data lives on globalThis so host and guest see the same rows.

import { useDB, addRow } from './shared_db';

export default function CartridgeDemoGuest() {
  const { rows } = useDB();
  const [draft, setDraft] = useState('');

  return (
    <Col style={{ gap: 8 }}>
      <Text style={{ color: '#cfd8e3', fontSize: 13 }}>
        I'm the guest. I see {rows.length} row{rows.length === 1 ? '' : 's'} in the host's DB.
      </Text>

      <Row style={{ gap: 6 }}>
        <TextInput
          value={draft}
          onChangeText={(t: string) => setDraft(t)}
          placeholder="message"
          style={{ flexGrow: 1, padding: 8, backgroundColor: '#0c1016', borderRadius: 4, color: '#e8edf2' }}
        />
        <Pressable
          onPress={() => {
            if (!draft.trim()) return;
            addRow(draft.trim(), 'guest');
            setDraft('');
          }}
          style={{ padding: 8, backgroundColor: '#3a2c1f', borderRadius: 4 }}
        >
          <Text style={{ color: '#cfd8e3' }}>+ guest row</Text>
        </Pressable>
      </Row>

      <Pressable
        onPress={() => addRow('guest auto-row', 'guest')}
        style={{ padding: 8, backgroundColor: '#2c1f3a', borderRadius: 4 }}
      >
        <Text style={{ color: '#cfd8e3' }}>+ quick guest row</Text>
      </Pressable>
    </Col>
  );
}
