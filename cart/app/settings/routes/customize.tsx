// Customize route — runtime theme token reassignment.

import { useMemo } from 'react';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import {
  getGalleryRuntimeTokenName,
  useGalleryTheme,
  type GalleryThemeOption,
} from '../../gallery/gallery-theme';
import { Field, Input, Section } from '../shared';

type ColorTokenRow = {
  categoryId: string;
  categoryTitle: string;
  tokenName: string;
  runtimeName: string;
  baseValue: string;
};

function isEditableColorToken(name: string, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (name === 'fontMono' || name === 'fontSans') return false;
  const v = value.trim();
  return (
    v === 'transparent' ||
    v.startsWith('#') ||
    v.startsWith('rgb(') ||
    v.startsWith('rgba(') ||
    v.startsWith('hsl(') ||
    v.startsWith('hsla(')
  );
}

function colorRowsFromTheme(theme: GalleryThemeOption | null): ColorTokenRow[] {
  if (!theme) return [];
  const rows: ColorTokenRow[] = [];
  for (const category of theme.mergedCategories) {
    for (const token of category.tokens) {
      const runtimeName = getGalleryRuntimeTokenName(category.id, token.name);
      if (!isEditableColorToken(runtimeName, token.value)) continue;
      rows.push({
        categoryId: category.id,
        categoryTitle: category.title,
        tokenName: token.name,
        runtimeName,
        baseValue: token.value,
      });
    }
  }
  return rows;
}

function Swatch({ value }: { value: string }) {
  return (
    <Box style={{
      width: 28, height: 28,
      borderRadius: 'theme:radiusSm',
      borderWidth: 1,
      borderColor: 'theme:ruleBright',
      backgroundColor: value || 'transparent',
      flexShrink: 0,
    }} />
  );
}

function TokenRow({
  row,
  value,
  override,
  onChange,
  onReset,
}: {
  row: ColorTokenRow;
  value: string;
  override: string;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'theme:rule',
      minWidth: 0,
    }}>
      <Swatch value={value} />
      <Box style={{ width: 150, flexShrink: 0, flexDirection: 'column', gap: 2 }}>
        <S.Body>{row.runtimeName}</S.Body>
        <S.Caption>{row.categoryId}.{row.tokenName}</S.Caption>
      </Box>
      <Box style={{ flexGrow: 1, minWidth: 0 }}>
        <Input
          mono
          value={override}
          onChange={onChange}
          placeholder={row.baseValue}
        />
        <S.Caption>Base: {row.baseValue}</S.Caption>
      </Box>
      <S.ButtonOutline onPress={onReset}>
        <S.ButtonOutlineLabel>Reset</S.ButtonOutlineLabel>
      </S.ButtonOutline>
    </Box>
  );
}

export default function CustomizeRoute() {
  const galleryTheme = useGalleryTheme();
  const rows = useMemo(() => colorRowsFromTheme(galleryTheme.active), [galleryTheme.activeThemeId]);
  const overrideCount = Object.keys(galleryTheme.tokenOverrides).length;

  return (
    <Section caption="Theme" title="Customize">
      <S.Card>
        <Box style={{ flexDirection: 'column', gap: 14 }}>
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <Box style={{ flexDirection: 'column', gap: 4, minWidth: 0, flexGrow: 1 }}>
              <S.Body>{galleryTheme.active?.label || 'No active theme'}</S.Body>
              <S.Caption>
                Reassigns component-gallery color tokens at runtime. Overrides are stored in localstore.
              </S.Caption>
            </Box>
            <S.ButtonOutline onPress={galleryTheme.clearTokenOverrides}>
              <S.ButtonOutlineLabel>{overrideCount ? `Clear ${overrideCount}` : 'Clear'}</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          </Box>

          <Field label="Active palette">
            <Box style={{ flexDirection: 'column', minWidth: 0 }}>
              {rows.map((row) => {
                const override = galleryTheme.tokenOverrides[row.runtimeName] || '';
                const value = override || row.baseValue;
                return (
                  <TokenRow
                    key={`${row.categoryId}.${row.tokenName}`}
                    row={row}
                    value={value}
                    override={override}
                    onChange={(next) => galleryTheme.setTokenOverride(row.runtimeName, next)}
                    onReset={() => galleryTheme.setTokenOverride(row.runtimeName, '')}
                  />
                );
              })}
            </Box>
          </Field>
        </Box>
      </S.Card>
    </Section>
  );
}
