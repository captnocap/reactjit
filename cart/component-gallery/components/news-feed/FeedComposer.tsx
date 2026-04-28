import { Box, Col, Pressable, Row, Text, TextArea } from '@reactjit/runtime/primitives';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';
import { BarChart3, Globe2, ImagePlus, Link, Send } from '@reactjit/runtime/icons/icons';

export type FeedComposerAuthor = {
  name: string;
  handle: string;
  initials: string;
};

export type FeedComposerProps = {
  author: FeedComposerAuthor;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const COLORS = {
  panel: '#18120e',
  panelRaised: '#211915',
  rule: '#3a2a1e',
  ruleBright: '#8a4a20',
  ink: '#f2e8dc',
  inkDim: '#b8a890',
  inkFaint: '#7a6e5d',
  accent: '#d26a2a',
  success: '#6aa390',
  link: '#5a8bd6',
};

function composerTool(icon: IconData, label: string, color: string) {
  return (
    <Pressable>
      <Row
        style={{
          height: 26,
          alignItems: 'center',
          gap: 5,
          paddingLeft: 7,
          paddingRight: 8,
          borderRadius: 5,
          backgroundColor: COLORS.panelRaised,
          borderWidth: 1,
          borderColor: COLORS.rule,
        }}
      >
        <Icon icon={icon} size={13} color={color} strokeWidth={2.1} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.inkDim }}>{label}</Text>
      </Row>
    </Pressable>
  );
}

function readInputValue(value: any): string {
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  if (typeof value?.value === 'string') return value.value;
  if (typeof value?.target?.value === 'string') return value.target.value;
  return value == null ? '' : String(value);
}

export function FeedComposer({ author, value, onChange, onSubmit }: FeedComposerProps) {
  const canPost = value.trim().length > 0;
  return (
    <Col
      style={{
        width: '100%',
        gap: 12,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.ruleBright,
        backgroundColor: COLORS.panel,
      }}
    >
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Box
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#2c211a',
            borderWidth: 1,
            borderColor: COLORS.ruleBright,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.ink }}>{author.initials}</Text>
        </Box>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 8 }}>
          <Row style={{ gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.ink }}>{author.name}</Text>
            <Text style={{ fontSize: 11, color: COLORS.inkFaint }}>{author.handle}</Text>
            <Row
              style={{
                height: 22,
                alignItems: 'center',
                gap: 5,
                paddingLeft: 7,
                paddingRight: 8,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: COLORS.rule,
                backgroundColor: COLORS.panelRaised,
              }}
            >
              <Icon icon={Globe2} size={12} color={COLORS.success} strokeWidth={2.1} />
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.inkDim }}>Public</Text>
            </Row>
          </Row>
          <TextArea
            value={value}
            onChange={(next: any) => onChange(readInputValue(next))}
            placeholder="What is happening?"
            style={{
              minHeight: 74,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 9,
              paddingBottom: 9,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: COLORS.rule,
              backgroundColor: '#100c09',
              color: COLORS.ink,
              fontSize: 14,
              lineHeight: 19,
            }}
          />
        </Col>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Row style={{ gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          {composerTool(ImagePlus, 'Media', COLORS.accent)}
          {composerTool(BarChart3, 'Poll', COLORS.success)}
          {composerTool(Link, 'Link', COLORS.link)}
        </Row>
        <Pressable onPress={canPost ? onSubmit : undefined}>
          <Row
            style={{
              height: 31,
              minWidth: 84,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              paddingLeft: 12,
              paddingRight: 13,
              borderRadius: 6,
              backgroundColor: canPost ? COLORS.accent : COLORS.panelRaised,
              borderWidth: 1,
              borderColor: canPost ? COLORS.accent : COLORS.rule,
            }}
          >
            <Icon icon={Send} size={14} color={canPost ? COLORS.ink : COLORS.inkFaint} strokeWidth={2.2} />
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: canPost ? COLORS.ink : COLORS.inkFaint }}>Post</Text>
          </Row>
        </Pressable>
      </Row>
    </Col>
  );
}
