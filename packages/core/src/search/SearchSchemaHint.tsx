/**
 * SearchSchemaHint — shows what fields are being searched.
 *
 * Renders a small "Searching: name, description (auto)" line under a search
 * bar. Non-technical users immediately know what data the search looks at.
 *
 * @example
 * const schema = useSearchSchema(users);
 * <SearchSchemaHint schema={schema} />
 * // → "Searching: name, email  (auto-detected)"
 *
 * @example
 * // Inline in SearchCombo
 * <SearchCombo items={products} showSchema />
 */

import React from 'react';
import { Box, Text } from '../primitives';
import type { SearchSchema } from '../useSearch';

export interface SearchSchemaHintProps {
  schema: SearchSchema;
  /** Text color for the label. */
  color?: string;
  /** Accent color for field names. */
  fieldColor?: string;
  fontSize?: number;
}

export function SearchSchemaHint({
  schema,
  color = 'rgba(255,255,255,0.35)',
  fieldColor = 'rgba(255,255,255,0.55)',
  fontSize = 10,
}: SearchSchemaHintProps) {
  if (schema.activeFields.length === 0) return null;

  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      <Text style={{ fontSize, color }}>Searching:</Text>
      {schema.activeFields.map((field, i) => (
        <Box key={field} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize, color: fieldColor }}>{field}</Text>
          {i < schema.activeFields.length - 1 && (
            <Text style={{ fontSize, color }}>,</Text>
          )}
        </Box>
      ))}
      {schema.isAutoDetected && (
        <Text style={{ fontSize: fontSize - 1, color }}>(auto)</Text>
      )}
    </Box>
  );
}
