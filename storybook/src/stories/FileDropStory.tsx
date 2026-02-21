import React, { useCallback, useState } from 'react';
import { Box, Text, TextEditor } from '../../../packages/shared/src';
import type { LoveEvent } from '../../../packages/shared/src/types';
import { useThemeColors } from '../../../packages/theme/src';

type Attachment = {
  name: string;
  size: number | null;
  path: string;
};

function fileNameFromPath(path: string): string {
  return path.split('/').pop() ?? path;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function FileDropStory() {
  const c = useThemeColors();

  const [uploadHover, setUploadHover] = useState(false);
  const [previewHover, setPreviewHover] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTruncated, setPreviewTruncated] = useState(false);

  const handleUploadDrop = useCallback((e: LoveEvent) => {
    if (!e.filePath) return;
    const next: Attachment = {
      name: e.fileName ?? fileNameFromPath(e.filePath),
      size: e.fileSize ?? null,
      path: e.filePath,
    };
    setAttachments(prev => [next, ...prev].slice(0, 6));
    setUploadHover(false);
  }, []);

  const handlePreviewDrop = useCallback((e: LoveEvent) => {
    if (!e.filePath) return;
    setPreviewHover(false);
    setPreviewName(e.fileName ?? fileNameFromPath(e.filePath));
    setPreviewTruncated(Boolean(e.filePreviewTruncated));

    if (typeof e.filePreviewText === 'string') {
      setPreviewText(e.filePreviewText);
      setPreviewError(null);
    } else {
      setPreviewText('');
      setPreviewError(e.filePreviewError ?? 'preview_unavailable');
    }
  }, []);

  return (
    <Box style={{ width: '100%', gap: 20, padding: 20 }}>
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>File Drop Modes</Text>
        <Text style={{ color: c.textDim, fontSize: 11 }}>
          Declare drop intent in React with fileDropMode. Lua handles attachment mode vs text preview mode.
        </Text>
      </Box>

      <Box style={{
        width: '100%',
        gap: 10,
        padding: 12,
        backgroundColor: c.bgAlt,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>Upload Mode (`fileDropMode="upload"`)</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Drops become attachment-style metadata only (path, size, name).
        </Text>
        <Box
          fileDropMode="upload"
          onFileDrop={handleUploadDrop}
          onFileDragEnter={() => setUploadHover(true)}
          onFileDragLeave={() => setUploadHover(false)}
          style={{
            width: '100%',
            height: 92,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: uploadHover ? c.primary : c.border,
            backgroundColor: uploadHover ? c.bg : [1, 1, 1, 0.02],
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: uploadHover ? c.info : c.textSecondary, fontSize: 12 }}>
            {uploadHover ? 'Release to attach' : 'Drop files here to attach'}
          </Text>
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Event includes `filePath`, `fileSize`, `fileName`, `fileDropMode`
          </Text>
        </Box>
        <Box style={{ gap: 6 }}>
          {attachments.length === 0 ? (
            <Text style={{ color: c.textDim, fontSize: 10 }}>No attachments yet.</Text>
          ) : attachments.map((item, i) => (
            <Box key={`${item.path}-${i}`} style={{
              flexDirection: 'row',
              width: '100%',
              alignItems: 'center',
              gap: 8,
              backgroundColor: [1, 1, 1, 0.03],
              borderRadius: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
            }}>
              <Text style={{ color: c.textSecondary, fontSize: 10 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Box style={{ flexGrow: 1 }} />
              <Text style={{ color: c.textDim, fontSize: 10 }}>
                {item.size !== null ? formatSize(item.size) : '--'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box style={{
        width: '100%',
        gap: 10,
        padding: 12,
        backgroundColor: c.bgAlt,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>Preview Mode (`fileDropMode="preview"`)</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Lua reads text files immediately and includes preview content in the drop event.
        </Text>
        <Box
          fileDropMode="preview"
          onFileDrop={handlePreviewDrop}
          onFileDragEnter={() => setPreviewHover(true)}
          onFileDragLeave={() => setPreviewHover(false)}
          style={{
            width: '100%',
            height: 92,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: previewHover ? c.info : c.border,
            backgroundColor: previewHover ? c.bg : [1, 1, 1, 0.02],
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: previewHover ? c.info : c.textSecondary, fontSize: 12 }}>
            {previewHover ? 'Release to preview in editor' : 'Drop .txt / .md / source files to preview'}
          </Text>
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Event adds `filePreviewText`, `filePreviewError`, `filePreviewTruncated`
          </Text>
        </Box>

        <Box style={{
          width: '100%',
          height: 250,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
        }}>
          <TextEditor
            value={previewText}
            readOnly
            lineNumbers
            syntaxHighlight
            tooltipLevel="clean"
            placeholder="Drop a text file in preview mode to hydrate this editor instantly."
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: c.bg,
            }}
            textStyle={{
              fontSize: 11,
              color: c.text,
              fontFamily: 'monospace',
            }}
          />
        </Box>

        {previewName ? (
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            Previewing: {previewName}
          </Text>
        ) : (
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            No preview file dropped yet.
          </Text>
        )}

        {previewTruncated && (
          <Text style={{ color: c.warning, fontSize: 10 }}>
            Preview truncated to 128 KB.
          </Text>
        )}

        {previewError && (
          <Text style={{ color: c.error, fontSize: 10 }}>
            Preview unavailable: {previewError}
          </Text>
        )}
      </Box>
    </Box>
  );
}
