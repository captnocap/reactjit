import React, { useState, useMemo } from 'react';
import { Box, Text, TextInput, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Icon } from '../../../packages/icons/src';
import * as AllIcons from '../../../packages/icons/src/icons';
import { iconNames } from '../../../packages/icons/src/iconNames';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const SIZES = [16, 20, 24, 32, 48];
const ICONS_PER_PAGE = 80;

// Build a lookup from PascalCase name → path data
const iconMap: Record<string, number[][]> = AllIcons as any;

export function IconStory() {
  const c = useThemeColors();
  const [filter, setFilter] = useState('');
  const [selectedSize, setSelectedSize] = useState(24);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!filter) return iconNames;
    const lower = filter.toLowerCase();
    return iconNames.filter(n => n.toLowerCase().includes(lower));
  }, [filter]);

  const totalPages = Math.ceil(filtered.length / ICONS_PER_PAGE);
  const pageIcons = filtered.slice(page * ICONS_PER_PAGE, (page + 1) * ICONS_PER_PAGE);

  return (
    <StoryPage>
      <StorySection index={1} title={`Icons — ${filtered.length} of ${iconNames.length}`}>
        <Box style={{ width: '100%', gap: 8 }}>
          {/* Search + size controls */}
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ flexGrow: 1 }}>
              <TextInput
                placeholder={`Search ${iconNames.length} icons...`}
                value={filter}
                onChangeText={(t: string) => { setFilter(t); setPage(0); }}
                style={{
                  backgroundColor: c.bg,
                  color: c.text,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 13,
                }}
              />
            </Box>
            {SIZES.map(sz => (
              <Pressable
                key={sz}
                onPress={() => setSelectedSize(sz)}
                style={{
                  backgroundColor: sz === selectedSize ? c.primary : c.surface,
                  borderRadius: 4,
                  paddingTop: 4,
                  paddingBottom: 4,
                  paddingLeft: 8,
                  paddingRight: 8,
                }}
              >
                <Text style={{ color: sz === selectedSize ? '#fff' : c.text, fontSize: 11 }}>
                  {`${sz}px`}
                </Text>
              </Pressable>
            ))}
          </Box>

          {/* Icon grid */}
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {pageIcons.map(name => {
              const data = iconMap[name];
              if (!data) return null;
              const isSelected = selectedIcon === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setSelectedIcon(isSelected ? null : name)}
                  style={{
                    width: 64,
                    height: 64,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? c.primary : c.surface,
                    borderRadius: 6,
                    gap: 2,
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: c.primary,
                  }}
                >
                  <Icon icon={data} size={selectedSize} color={isSelected ? '#fff' : c.text} />
                </Pressable>
              );
            })}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              <Pressable
                onPress={() => setPage(Math.max(0, page - 1))}
                style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
              >
                <Text style={{ color: c.text, fontSize: 11 }}>{`< Prev`}</Text>
              </Pressable>
              <Text style={{ color: c.muted, fontSize: 11 }}>
                {`Page ${page + 1} of ${totalPages}`}
              </Text>
              <Pressable
                onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
                style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
              >
                <Text style={{ color: c.text, fontSize: 11 }}>{`Next >`}</Text>
              </Pressable>
            </Box>
          )}
        </Box>
      </StorySection>

      {/* Selected icon detail */}
      {selectedIcon && (
        <StorySection index={2} title="Selected Icon">
          <Box style={{ width: '100%', alignItems: 'center', gap: 12 }}>
            <Icon icon={iconMap[selectedIcon]} size={64} color={c.text} />
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>
              {selectedIcon}
            </Text>
            <Box style={{
              width: '100%',
              backgroundColor: c.bg,
              borderRadius: 6,
              padding: 10,
            }}>
              <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'monospace' }}>
                {`import { Icon, ${selectedIcon} } from '@reactjit/icons';\n\n<Icon icon={${selectedIcon}} size={24} color="#fff" />`}
              </Text>
            </Box>
            {/* Size variants */}
            // rjit-ignore-next-line
            <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-end' }}>
              {SIZES.map(sz => (
                <Box key={sz} style={{ alignItems: 'center', gap: 4 }}>
                  <Icon icon={iconMap[selectedIcon]} size={sz} color={c.text} />
                  <Text style={{ color: c.muted, fontSize: 9 }}>{`${sz}`}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </StorySection>
      )}

      <StorySection index={3} title="Usage Examples">
        <Box style={{ width: '100%', gap: 12 }}>
          {/* Inline with text */}
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon icon={iconMap.Home} size={16} color={c.text} />
            <Text style={{ color: c.text, fontSize: 13 }}>{`Home`}</Text>
            <Box style={{ width: 1, height: 16, backgroundColor: c.border }} />
            <Icon icon={iconMap.Settings} size={16} color={c.text} />
            <Text style={{ color: c.text, fontSize: 13 }}>{`Settings`}</Text>
            <Box style={{ width: 1, height: 16, backgroundColor: c.border }} />
            <Icon icon={iconMap.Search} size={16} color={c.text} />
            <Text style={{ color: c.text, fontSize: 13 }}>{`Search`}</Text>
          </Box>

          {/* Color variants */}
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Icon icon={iconMap.Heart} size={24} color="#ef4444" />
            <Icon icon={iconMap.Star} size={24} color="#eab308" />
            <Icon icon={iconMap.Zap} size={24} color="#3b82f6" />
            <Icon icon={iconMap.Leaf} size={24} color="#22c55e" />
            <Icon icon={iconMap.Flame} size={24} color="#f97316" />
            <Icon icon={iconMap.Sparkles} size={24} color="#a855f7" />
          </Box>

          {/* Button-like usage */}
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => {}} style={{
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              backgroundColor: c.primary,
              borderRadius: 6,
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 12,
            }}>
              <Icon icon={iconMap.Plus} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12 }}>{`New Item`}</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={{
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              backgroundColor: c.surface,
              borderRadius: 6,
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 12,
              borderWidth: 1,
              borderColor: c.border,
            }}>
              <Icon icon={iconMap.Download} size={14} color={c.text} />
              <Text style={{ color: c.text, fontSize: 12 }}>{`Download`}</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={{
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              backgroundColor: '#ef4444',
              borderRadius: 6,
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 12,
            }}>
              <Icon icon={iconMap.Trash2} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12 }}>{`Delete`}</Text>
            </Pressable>
          </Box>
        </Box>
      </StorySection>
    </StoryPage>
  );
}
