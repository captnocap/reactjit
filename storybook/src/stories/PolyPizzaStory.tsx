import React, { useMemo, useState } from 'react';
import { Box, Pressable, ScrollView, Text, TextInput } from '../../../packages/core/src';
import {
  usePolyPizzaModelWithAttribution,
  usePolyPizzaSearch,
} from '../../../packages/apis/src';
import { useThemeColors } from '../../../packages/theme/src';

function asRecord(value: unknown): Record<string, any> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function getPath(obj: Record<string, any> | null, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function firstString(obj: Record<string, any> | null, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function normalizeSearchItems(payload: unknown): Record<string, any>[] {
  const root = asRecord(payload);
  if (!root) return [];

  const candidates = [
    getPath(root, 'results'),
    getPath(root, 'items'),
    getPath(root, 'data.results'),
    getPath(root, 'data.items'),
    getPath(root, 'data'),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(item => asRecord(item)).filter(Boolean) as Record<string, any>[];
    }
  }
  return [];
}

function idForModel(model: Record<string, any> | null): string | null {
  return firstString(model, ['id', 'slug', 'uuid']);
}

function titleForModel(model: Record<string, any> | null): string {
  return firstString(model, ['title', 'name']) ?? 'Untitled';
}

function authorForModel(model: Record<string, any> | null): string {
  const authorObj = asRecord(getPath(model, 'author')) ?? asRecord(getPath(model, 'creator'));
  return firstString(authorObj, ['name', 'username', 'displayName'])
    ?? firstString(model, ['author', 'creator'])
    ?? 'Unknown Author';
}

function licenseForModel(model: Record<string, any> | null): string {
  const licenseObj = asRecord(getPath(model, 'license'));
  return firstString(licenseObj, ['name', 'title', 'shortName', 'spdx'])
    ?? firstString(model, ['license'])
    ?? 'Unknown License';
}

function jsonPreview(value: unknown, max = 700): string {
  const raw = JSON.stringify(value, null, 2);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}\n...`;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onSubmit,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  onSubmit?: (text: string) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4, width: '100%' }}>
      <Text style={{ fontSize: 10, color: c.textDim }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmit={onSubmit}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={{
          width: '100%',
          height: 34,
          backgroundColor: c.bg,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          paddingLeft: 8,
          paddingRight: 8,
          fontSize: 12,
          color: c.text,
        }}
        textStyle={{ fontSize: 12, color: c.text }}
      />
    </Box>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'neutral';
}) {
  const c = useThemeColors();
  const bg = tone === 'primary' ? c.primary : c.surface;
  const fg = tone === 'primary' ? '#ffffff' : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => ({
        backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : bg,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 6,
      })}
    >
      <Text style={{ fontSize: 11, color: fg, fontWeight: 'normal' }}>{label}</Text>
    </Pressable>
  );
}

export function PolyPizzaStory() {
  const c = useThemeColors();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://poly.pizza/api/v1.1');

  const [modelPath, setModelPath] = useState('/models/{id}');
  const [modelInput, setModelInput] = useState('');
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const [searchPath, setSearchPath] = useState('/models/search');
  const [searchQueryKey, setSearchQueryKey] = useState('q');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState<string | null>(null);

  const apiKeyTrimmed = apiKey.trim();
  const keyForHooks = apiKeyTrimmed !== '' ? apiKeyTrimmed : null;

  const modelResult = usePolyPizzaModelWithAttribution(
    keyForHooks,
    activeModelId,
    {
      baseUrl: baseUrl.trim() || undefined,
      modelPath: modelPath.trim() || undefined,
    },
  );

  const searchResult = usePolyPizzaSearch(
    keyForHooks,
    activeSearch,
    {
      baseUrl: baseUrl.trim() || undefined,
      searchPath: searchPath.trim() || undefined,
      queryKey: searchQueryKey.trim() || undefined,
      perPage: 8,
    },
  );

  const searchItems = useMemo(
    () => normalizeSearchItems(searchResult.data),
    [searchResult.data],
  );

  const fetchModel = () => {
    const next = modelInput.trim();
    if (next === '') return;
    if (next === activeModelId) {
      modelResult.refetch();
      return;
    }
    setActiveModelId(next);
  };

  const runSearch = () => {
    const next = searchInput.trim();
    if (next === '') return;
    if (next === activeSearch) {
      searchResult.refetch();
      return;
    }
    setActiveSearch(next);
  };

  const pickFromSearch = (item: Record<string, any>) => {
    const id = idForModel(item);
    if (!id) return;
    setModelInput(id);
    if (id === activeModelId) {
      modelResult.refetch();
    } else {
      setActiveModelId(id);
    }
  };

  const modelObj = asRecord(modelResult.data);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>Poly Pizza API Test Bench</Text>
        <Text style={{ fontSize: 11, color: c.textSecondary }}>
          Paste an API key, search models, and fetch model metadata with attribution immediately.
        </Text>
      </Box>

      <Box style={{ width: '100%', flexDirection: 'row', gap: 12, flexGrow: 1 }}>
        <ScrollView style={{ width: 360, backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
          <Box style={{ width: '100%', padding: 12, gap: 10 }}>
            <LabeledInput
              label="API Key"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Paste Poly Pizza API key..."
              secureTextEntry={!showKey}
            />
            <ActionButton
              label={showKey ? 'Hide Key' : 'Show Key'}
              tone="neutral"
              onPress={() => setShowKey(v => !v)}
            />

            <LabeledInput
              label="Base URL"
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="https://poly.pizza/api/v1.1"
            />
            <LabeledInput
              label="Model Path Template"
              value={modelPath}
              onChangeText={setModelPath}
              placeholder="/models/{id}"
            />
            <LabeledInput
              label="Search Path"
              value={searchPath}
              onChangeText={setSearchPath}
              placeholder="/models/search"
            />
            <LabeledInput
              label="Search Query Param Key"
              value={searchQueryKey}
              onChangeText={setSearchQueryKey}
              placeholder="q"
            />

            <Box style={{ width: '100%', height: 1, backgroundColor: c.border }} />

            <LabeledInput
              label="Model ID / Slug / URL"
              value={modelInput}
              onChangeText={setModelInput}
              onSubmit={fetchModel}
              placeholder="2f6e4a0d or https://poly.pizza/..."
            />
            <ActionButton label="Fetch Model" onPress={fetchModel} />

            <LabeledInput
              label="Search Query"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmit={runSearch}
              placeholder="robot, car, tree..."
            />
            <ActionButton label="Search Models" onPress={runSearch} />
          </Box>
        </ScrollView>

        <ScrollView style={{ flexGrow: 1, backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
          <Box style={{ width: '100%', padding: 12, gap: 12 }}>
            <Box style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>Model Fetch</Text>
              {modelResult.loading && <Text style={{ fontSize: 11, color: c.warning }}>Loading model...</Text>}
              {modelResult.error && <Text style={{ fontSize: 11, color: c.error }}>{`Error: ${modelResult.error.message}`}</Text>}
              {!modelResult.loading && !modelResult.error && !modelObj && (
                <Text style={{ fontSize: 11, color: c.textDim }}>No model loaded yet.</Text>
              )}
              {modelObj && (
                <Box style={{ gap: 6, backgroundColor: c.bg, borderRadius: 6, borderWidth: 1, borderColor: c.border, padding: 10 }}>
                  <Text style={{ fontSize: 12, color: c.text, fontWeight: 'normal' }}>{titleForModel(modelObj)}</Text>
                  <Text style={{ fontSize: 11, color: c.textSecondary }}>{`ID: ${idForModel(modelObj) ?? 'unknown'}`}</Text>
                  <Text style={{ fontSize: 11, color: c.textSecondary }}>{`Author: ${authorForModel(modelObj)}`}</Text>
                  <Text style={{ fontSize: 11, color: c.textSecondary }}>{`License: ${licenseForModel(modelObj)}`}</Text>
                  {modelResult.attributionLine && (
                    <Box style={{ gap: 2 }}>
                      <Text style={{ fontSize: 10, color: c.textDim }}>Normalized attribution:</Text>
                      <Text style={{ fontSize: 11, color: c.info }}>{modelResult.attributionLine}</Text>
                    </Box>
                  )}
                  <Box style={{ gap: 2 }}>
                    <Text style={{ fontSize: 10, color: c.textDim }}>Raw JSON preview:</Text>
                    <Text style={{ fontSize: 10, color: c.textSecondary }}>{jsonPreview(modelResult.data)}</Text>
                  </Box>
                </Box>
              )}
            </Box>

            <Box style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: c.text, fontWeight: 'normal' }}>Search Results</Text>
              {searchResult.loading && <Text style={{ fontSize: 11, color: c.warning }}>Searching...</Text>}
              {searchResult.error && <Text style={{ fontSize: 11, color: c.error }}>{`Error: ${searchResult.error.message}`}</Text>}
              {!searchResult.loading && !searchResult.error && activeSearch && searchItems.length === 0 && (
                <Text style={{ fontSize: 11, color: c.textDim }}>No results in the current response shape.</Text>
              )}
              {searchItems.length > 0 && (
                <Box style={{ gap: 6 }}>
                  {searchItems.slice(0, 10).map((item, idx) => {
                    const id = idForModel(item);
                    return (
                      <Pressable key={`${id ?? 'row'}-${idx}`} onPress={() => pickFromSearch(item)}>
                        {({ pressed, hovered }) => (
                          <Box style={{
                            gap: 2,
                            backgroundColor: pressed ? c.primaryPressed : hovered ? c.surfaceHover : c.bg,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: c.border,
                            padding: 8,
                          }}>
                            <Text style={{ fontSize: 12, color: c.text, fontWeight: 'normal' }}>{titleForModel(item)}</Text>
                            <Text style={{ fontSize: 10, color: c.textSecondary }}>{`ID: ${id ?? 'unknown'}`}</Text>
                            <Text style={{ fontSize: 10, color: c.textDim }}>{`By ${authorForModel(item)} | ${licenseForModel(item)}`}</Text>
                            <Text style={{ fontSize: 10, color: c.info }}>Press to load this model</Text>
                          </Box>
                        )}
                      </Pressable>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>
        </ScrollView>
      </Box>
    </Box>
  );
}
