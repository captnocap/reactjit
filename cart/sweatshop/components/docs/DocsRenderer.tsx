const React: any = require('react');
const { useMemo, useState } = React;

import { Box } from '../../../../runtime/primitives';
import { copyToClipboard } from '../agent/clipboard';
import { HeadingNav } from '../markdown/HeadingNav';
import { MarkdownRenderer } from '../markdown/MarkdownRenderer';
import { useMarkdownAst } from '../markdown/useMarkdownAst';
import { COLORS } from '../../theme';

export function DocsRenderer(props: {
  path: string;
  source: string;
  query: string;
  onOpenPath: (path: string) => void;
  onAnchorPress?: (id: string) => void;
}) {
  const ast = useMarkdownAst(props.source);
  const [scrollY, setScrollY] = useState(0);
  const [headingY, setHeadingY] = useState<Record<string, number>>({});

  const activeHeadingId = useMemo(() => {
    let active = ast.headings[0]?.id || '';
    for (const heading of ast.headings) if ((headingY[heading.id] ?? 0) <= scrollY + 24) active = heading.id;
    return active;
  }, [ast.headings, headingY, scrollY]);

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, position: 'relative', backgroundColor: COLORS.panelBg }}>
      <MarkdownRenderer
        ast={ast}
        basePath={props.path}
        fontSize={12}
        lineWidth={900}
        query={props.query}
        scrollY={scrollY}
        onScroll={setScrollY}
        onHeadingLayout={(id, y) => setHeadingY((prev) => (prev[id] === y ? prev : { ...prev, [id]: y }))}
        onOpenPath={props.onOpenPath}
        onAnchorPress={(id) => copyToClipboard(`${props.path}#${id}`)}
      />
      {ast.headings.length > 0 ? (
        <HeadingNav headings={ast.headings} activeId={activeHeadingId} visible={true} onJump={(id) => setScrollY(headingY[id] ?? 0)} />
      ) : null}
    </Box>
  );
}

export default DocsRenderer;
