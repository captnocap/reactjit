
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ImportConfirmFooter } from './ImportConfirmFooter';
import { ImportDropZone } from './ImportDropZone';
import { ImportFilters, type ImportTypeFilter } from './ImportFilters';
import { ImportPreview } from './ImportPreview';
import { ImportProgressRow } from './ImportProgressRow';
import { useMediaImport, type MediaImportItem } from './useMediaImport';

function matchesFilter(item: MediaImportItem, typeFilter: ImportTypeFilter, nameFilter: string): boolean {
  const q = nameFilter.trim().toLowerCase();
  if (q && item.name.toLowerCase().indexOf(q) < 0 && item.path.toLowerCase().indexOf(q) < 0) return false;
  if (typeFilter === 'all') return true;
  if (typeFilter === 'images') return item.kind === 'image';
  if (typeFilter === 'videos') return item.kind === 'video';
  return item.kind === 'gif';
}

export function MediaImportDialog(props: { open: boolean; onClose: () => void; onConfirm: (items: MediaImportItem[]) => void }) {
  const [thumbSize, setThumbSize] = useState(132);
  const [gridDensity, setGridDensity] = useState(4);
  const [autoAccept, setAutoAccept] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ImportTypeFilter>('all');
  const [sizeCapMb, setSizeCapMb] = useState(256);
  const [nameFilter, setNameFilter] = useState('');
  const importer = useMediaImport({ maxSizeBytes: sizeCapMb * 1024 * 1024, onConfirm: props.onConfirm });
  const visible = useMemo(() => importer.batch.filter((item) => matchesFilter(item, typeFilter, nameFilter)), [importer.batch, typeFilter, nameFilter]);
  const ready = useMemo(() => importer.batch.filter((item) => item.status === 'ready'), [importer.batch]);

  useEffect(() => {
    if (!props.open || !autoAccept || importer.batch.length === 0) return;
    if (importer.batch.some((item) => item.status === 'queued' || item.status === 'loading')) return;
    if (ready.length > 0) { props.onConfirm(ready); props.onClose(); importer.clear(); }
  }, [autoAccept, importer, props, ready]);

  if (!props.open) return null;
  const density = Math.max(1, Math.min(6, gridDensity));

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 12000, backgroundColor: 'rgba(2,6,12,0.82)', padding: 14 }}>
      <Col style={{ width: '100%', height: '100%', borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
          <Col style={{ gap: 2 }}>
            <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Import media</Text>
            <Text fontSize={10} color={COLORS.textDim}>Drop files, pick them from the system dialog, then confirm the batch.</Text>
          </Col>
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setAutoAccept(!autoAccept)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: autoAccept ? COLORS.blue : COLORS.border, backgroundColor: autoAccept ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={autoAccept ? COLORS.blue : COLORS.text}>{autoAccept ? 'auto-accept on' : 'auto-accept off'}</Text></Pressable>
            <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}><Text fontSize={10} color={COLORS.textDim}>close</Text></Pressable>
          </Row>
        </Row>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 12 }}>
          <Col style={{ gap: 12 }}>
            <ImportDropZone onPick={importer.pickFiles} onDropPaths={importer.addPaths} />
            <Row style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 280 }}><ImportFilters typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} sizeCapMb={sizeCapMb} onSizeCapMbChange={setSizeCapMb} nameFilter={nameFilter} onNameFilterChange={setNameFilter} /></Box>
              <Box style={{ width: 240, gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>View</Text>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {[96, 124, 148, 180, 220].map((n) => <Pressable key={String(n)} onPress={() => setThumbSize(n)} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: thumbSize === n ? COLORS.blue : COLORS.border, backgroundColor: thumbSize === n ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={thumbSize === n ? COLORS.blue : COLORS.text}>{String(n) + 'px'}</Text></Pressable>)}
                </Row>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <Pressable key={String(n)} onPress={() => setGridDensity(n)} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: gridDensity === n ? COLORS.blue : COLORS.border, backgroundColor: gridDensity === n ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={gridDensity === n ? COLORS.blue : COLORS.text}>{String(n) + ' cols'}</Text></Pressable>)}
                </Row>
              </Box>
            </Row>
            <ImportPreview items={visible} thumbSize={thumbSize} density={density} onRemove={importer.remove} />
            <Box style={{ gap: 8 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Import status</Text>
              {importer.batch.length === 0 ? <Text fontSize={10} color={COLORS.textDim}>No files staged yet.</Text> : importer.batch.map((item) => <ImportProgressRow key={item.id} item={item} />)}
            </Box>
            <ImportConfirmFooter items={importer.batch} onCancel={() => { importer.clear(); props.onClose(); }} onConfirm={() => { props.onConfirm(importer.batch.filter((item) => item.status === 'ready')); importer.clear(); props.onClose(); }} />
          </Col>
        </ScrollView>
      </Col>
    </Box>
  );
}

export default MediaImportDialog;
