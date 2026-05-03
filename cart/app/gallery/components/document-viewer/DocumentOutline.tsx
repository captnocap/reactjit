import { classifiers as S } from '@reactjit/core';
import { ScrollView } from '@reactjit/runtime/primitives';

export type OutlineEntry = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export type DocumentOutlineProps = {
  entries: OutlineEntry[];
  activeId: string | null;
  onSelect?: (id: string) => void;
};

function OutlineRow({
  entry,
  active,
  onSelect,
}: {
  entry: OutlineEntry;
  active: boolean;
  onSelect?: (id: string) => void;
}) {
  const handlePress = onSelect ? () => onSelect(entry.id) : undefined;
  const Label = entry.level === 1
    ? (active ? S.DocOutlineEntryH1Active : S.DocOutlineEntryH1)
    : (active ? S.DocOutlineEntryActive : S.DocOutlineEntry);

  if (active) {
    return (
      <S.DocOutlineRowActive onPress={handlePress}>
        <Label>{entry.text}</Label>
      </S.DocOutlineRowActive>
    );
  }
  return (
    <S.DocOutlineRow onPress={handlePress}>
      <Label>{entry.text}</Label>
    </S.DocOutlineRow>
  );
}

export function DocumentOutline({ entries, activeId, onSelect }: DocumentOutlineProps) {
  return (
    <S.DocOutline>
      <S.DocOutlineHeader>
        <S.DocOutlineLabel>OUTLINE</S.DocOutlineLabel>
      </S.DocOutlineHeader>
      <ScrollView style={{ flexGrow: 1, width: '100%' }} showScrollbar={false}>
        <S.StackX1>
          {entries.map((entry) => (
            <OutlineRow
              key={entry.id}
              entry={entry}
              active={entry.id === activeId}
              onSelect={onSelect}
            />
          ))}
        </S.StackX1>
      </ScrollView>
    </S.DocOutline>
  );
}
