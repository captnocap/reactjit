import React from 'react';
import { Box, Text, Pressable } from '../../../../packages/shared/src';
import { MetadataBadges } from './MetadataBadges';
import { CodeBlock } from './CodeBlock';
import { ExampleCard } from './ExampleCard';
import { useDocsFontScale } from './DocsFontScale';

interface ParsedContentLike {
  metadata: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    platforms: string[];
  };
  sections: {
    overview: string;
    api: string;
    examples: { title: string; code: string; platforms: string[] }[];
    platformNotes: Record<string, string>;
    commonPatterns: string;
    performance: string;
    criticalRules: string[];
    seeAlso: string[];
    code: string;
    explanation: string;
  };
}

function SectionHeader({ title, s }: { title: string; s: (n: number) => number }) {
  return (
    <Box style={{ marginTop: 20, marginBottom: 8 }}>
      <Box style={{ height: 1, backgroundColor: '#1e293b', marginBottom: 10 }} />
      <Text style={{ color: '#64748b', fontSize: s(12) }}>
        {title}
      </Text>
    </Box>
  );
}

function ContentText({ text, s }: { text: string; s: (n: number) => number }) {
  return (
    <Text style={{ color: '#94a3b8', fontSize: s(11) }}>
      {text}
    </Text>
  );
}

/** Parse a see-also ref like "05-components/pressable.txt - Description" into section + fileKey */
function parseSeeAlsoRef(ref: string): { sectionId: string; fileKey: string; label: string } | null {
  const dashIdx = ref.indexOf(' - ');
  const path = dashIdx >= 0 ? ref.substring(0, dashIdx).trim() : ref.trim();
  const description = dashIdx >= 0 ? ref.substring(dashIdx + 3).trim() : '';

  // Format: "section/file.txt" or just "file.txt"
  const parts = path.replace(/\.txt$/, '').split('/');
  if (parts.length === 2) {
    return { sectionId: parts[0], fileKey: parts[1], label: `${parts[1]} - ${description}` };
  } else if (parts.length === 1) {
    return { sectionId: '', fileKey: parts[0], label: `${parts[0]} - ${description}` };
  }
  return null;
}

export function DocPage({ content, onNavigate, currentSectionId }: { content: ParsedContentLike; onNavigate?: (sectionId: string, fileKey: string) => void; currentSectionId?: string }) {
  const { metadata, sections } = content;
  const { scale } = useDocsFontScale();
  const s = (base: number) => Math.round(base * scale);

  return (
    <Box style={{ width: '100%', padding: 16, paddingBottom: 40 }}>
      {/* Title */}
      <Text style={{ color: '#e2e8f0', fontSize: s(18), fontWeight: 'bold', marginBottom: 6 }}>
        {metadata.title}
      </Text>

      {/* Description */}
      {metadata.description ? (
        <Text style={{ color: '#64748b', fontSize: s(11), marginBottom: 8 }}>
          {metadata.description}
        </Text>
      ) : null}

      {/* Badges */}
      <MetadataBadges
        category={metadata.category}
        difficulty={metadata.difficulty}
        platforms={metadata.platforms}
      />

      {/* Overview */}
      {sections.overview ? (
        <Box>
          <SectionHeader title="OVERVIEW" s={s} />
          <ContentText text={sections.overview} s={s} />
        </Box>
      ) : null}

      {/* API / Syntax */}
      {sections.api ? (
        <Box>
          <SectionHeader title="API / SYNTAX" s={s} />
          <CodeBlock code={sections.api} />
        </Box>
      ) : null}

      {/* Examples */}
      {sections.examples.length > 0 ? (
        <Box>
          <SectionHeader title="EXAMPLES" s={s} />
          {sections.examples.map((ex, i) => (
            <ExampleCard key={i} title={ex.title} code={ex.code} platforms={ex.platforms} />
          ))}
        </Box>
      ) : null}

      {/* Code section (for standalone examples) */}
      {sections.code ? (
        <Box>
          <SectionHeader title="CODE" s={s} />
          <CodeBlock code={sections.code} />
        </Box>
      ) : null}

      {/* Platform Notes */}
      {Object.keys(sections.platformNotes).length > 0 ? (
        <Box>
          <SectionHeader title="PLATFORM NOTES" s={s} />
          {Object.entries(sections.platformNotes).map(([platform, notes]) => (
            <Box key={platform} style={{ marginBottom: 8 }}>
              <Text style={{ color: '#cbd5e1', fontSize: s(10), lineHeight: s(16), fontWeight: 'bold', marginBottom: 4 }}>
                {platform}
              </Text>
              <ContentText text={notes} s={s} />
            </Box>
          ))}
        </Box>
      ) : null}

      {/* Common Patterns */}
      {sections.commonPatterns ? (
        <Box>
          <SectionHeader title="COMMON PATTERNS" s={s} />
          <ContentText text={sections.commonPatterns} s={s} />
        </Box>
      ) : null}

      {/* Performance */}
      {sections.performance ? (
        <Box>
          <SectionHeader title="PERFORMANCE" s={s} />
          <ContentText text={sections.performance} s={s} />
        </Box>
      ) : null}

      {/* Critical Rules */}
      {sections.criticalRules.length > 0 ? (
        <Box>
          <SectionHeader title="CRITICAL RULES" s={s} />
          {sections.criticalRules.map((rule, i) => (
            <Box key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ color: '#f59e0b', fontSize: s(10), lineHeight: s(16) }}>{`- `}</Text>
              <Box style={{ flexShrink: 1 }}>
                <Text style={{ color: '#94a3b8', fontSize: s(10), lineHeight: s(16) }}>{rule}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}

      {/* Explanation (for examples) */}
      {sections.explanation ? (
        <Box>
          <SectionHeader title="EXPLANATION" s={s} />
          <ContentText text={sections.explanation} s={s} />
        </Box>
      ) : null}

      {/* See Also */}
      {sections.seeAlso.length > 0 ? (
        <Box>
          <SectionHeader title="SEE ALSO" s={s} />
          {sections.seeAlso.map((ref, i) => {
            const parsed = parseSeeAlsoRef(ref);
            if (parsed && onNavigate) {
              const targetSection = parsed.sectionId || currentSectionId || '';
              return (
                <Pressable key={i} onPress={() => onNavigate(targetSection, parsed.fileKey)}
                  style={{ marginBottom: 4 }}>
                  <Text style={{ color: '#3b82f6', fontSize: s(10), lineHeight: s(16) }}>
                    {`> ${parsed.label}`}
                  </Text>
                </Pressable>
              );
            }
            return (
              <Text key={i} style={{ color: '#3b82f6', fontSize: s(10), lineHeight: s(16), marginBottom: 4 }}>
                {`> ${ref}`}
              </Text>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}
