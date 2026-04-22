import { Box, Col, ScrollView } from '../../../../runtime/primitives';
import { LogRow } from './LogRow';
import type { LogEntry } from './useLogStream';

const ROW_HEIGHT = 24;
const VIEWPORT_ESTIMATE = 600;
const OVERSCAN = 5;

export interface LogListProps {
  entries: LogEntry[];
  selectedId: string | null;
  onSelect: (entry: LogEntry) => void;
  follow: boolean;
  timestampFormat: 'iso' | 'time' | 'relative';
  colorPerCategory: boolean;
  categoryColors: Record<string, string>;
}

export function LogList(props: LogListProps) {
  const { entries, selectedId, onSelect, follow, timestampFormat, colorPerCategory, categoryColors } = props;
  const [scrollY, setScrollY] = useState(0);
  const total = entries.length;

  const startIndex = Math.max(0, Math.floor(scrollY / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(total, Math.ceil((scrollY + VIEWPORT_ESTIMATE) / ROW_HEIGHT) + OVERSCAN);
  const window = entries.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (total - endIndex) * ROW_HEIGHT);

  const handleScroll = useCallback((payload: any) => {
    const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
    if (Math.abs(next - scrollY) >= ROW_HEIGHT / 2) setScrollY(next);
  }, [scrollY]);

  return (
    <ScrollView
      showScrollbar={true}
      style={{ flexGrow: 1, height: '100%' }}
      onScroll={handleScroll}
    >
      <Col>
        {topSpacer > 0 && <Box style={{ height: topSpacer }} />}
        {window.map((entry) => (
          <LogRow
            key={entry.id}
            entry={entry}
            selected={selectedId === entry.id}
            onPress={() => onSelect(entry)}
            timestampFormat={timestampFormat}
            colorPerCategory={colorPerCategory}
            categoryColors={categoryColors}
          />
        ))}
        {bottomSpacer > 0 && <Box style={{ height: bottomSpacer }} />}
      </Col>
    </ScrollView>
  );
}
