const React: any = require('react');

import { Box, Col, ScrollView } from '../../../../runtime/primitives';

interface DiffVirtualizerProps {
  totalRows: number;
  rowHeight: number;
  threshold: number;
  viewportEstimate: number;
  overscan: number;
  scrollY: number;
  onScroll: (y: number) => void;
  renderRow: (index: number) => React.ReactNode;
}

export function DiffVirtualizer(props: DiffVirtualizerProps) {
  const {
    totalRows,
    rowHeight,
    threshold,
    viewportEstimate,
    overscan,
    scrollY,
    onScroll,
    renderRow,
  } = props;

  const shouldVirtualize = totalRows > threshold;

  const startIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollY / rowHeight) - overscan)
    : 0;
  const endIndex = shouldVirtualize
    ? Math.min(totalRows, Math.ceil((scrollY + viewportEstimate) / rowHeight) + overscan)
    : totalRows;

  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * rowHeight);

  return (
    <ScrollView
      showScrollbar={true}
      style={{ flexGrow: 1 }}
      onScroll={(payload: any) => {
        const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
        if (Math.abs(next - scrollY) >= rowHeight / 2) onScroll(next);
      }}
    >
      <Col>
        {topSpacer > 0 && <Box style={{ height: topSpacer }} />}
        {Array.from({ length: endIndex - startIndex }, (_, i) => renderRow(startIndex + i))}
        {bottomSpacer > 0 && <Box style={{ height: bottomSpacer }} />}
      </Col>
    </ScrollView>
  );
}
