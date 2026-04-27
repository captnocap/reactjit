# `useMedia` (V8 Runtime)

`useMedia` is the collapsed media surface for the V8 runtime.

It provides:

- filesystem media scanning
- directory stats
- media indexing
- local query/filter/sort/pagination
- reactive hook variants for each method

## Runtime Scope

This implementation is V8-only and depends on fs-domain host bindings.

Required host functions:

- `__fs_media_scan_json`
- `__fs_media_stats_json`
- `__fs_media_index_json`

These are registered in `framework/v8_bindings_fs.zig`.

## Import

```ts
import { useMedia } from '../../runtime/hooks';
```

Or low-level wrappers:

```ts
import { media } from '../../runtime/hooks';
```

## Collapsed Surface

`useMedia()` returns:

```ts
{
  // Imperative methods
  scan(options): Promise<MediaFile[]>;
  stats(options): Promise<DirStats>;
  index(options): Promise<MediaFile[]>;
  query(options): Promise<MediaFile[]>;

  // Reactive methods
  useScan(options):  { files, loading, error, rescan };
  useStats(options): { stats, loading, error, rescan };
  useIndex(options): { index, loading, error, rescan };
  useQuery(options): { results, loading, error, refetch };

  // Utilities
  classifyFile(filename): MediaType;
  formatSize(bytes): string;
}
```

## Types

```ts
type MediaType =
  | 'video'
  | 'audio'
  | 'image'
  | 'subtitle'
  | 'document'
  | 'archive'
  | 'metadata'
  | 'unknown';

type MediaFile = {
  path: string;
  name: string;
  size: number;
  mtime?: number;
  type: MediaType;
  source: 'filesystem' | 'archive';
  archivePath?: string;
  archiveEntry?: string;
};

type DirStats = {
  total: number;
  byType: Partial<Record<MediaType, number>>;
  totalSize: number;
  largestFile: MediaFile | null;
};
```

## Method Option Shapes

```ts
type ScanOptions = {
  dir: string | null;
  recursive?: boolean; // default true
  maxDepth?: number;   // default 10
  kinds?: MediaType[];
};

type StatsOptions = {
  dir: string | null;
  recursive?: boolean; // default true
  maxDepth?: number;   // default 10
};

type IndexOptions = {
  dir: string | null;
  recursive?: boolean;      // default true
  maxDepth?: number;        // default 10
  indexArchives?: boolean;  // default true
  archivePattern?: string;
  kinds?: MediaType[];
};

type QueryOptions = {
  dir: string | null;
  source?: 'scan' | 'index'; // default 'scan'
  recursive?: boolean;
  maxDepth?: number;
  indexArchives?: boolean;
  archivePattern?: string;
  text?: string;             // name/path contains
  kinds?: MediaType[];
  minSize?: number;
  maxSize?: number;
  orderBy?: 'name' | 'size' | 'mtime' | 'type'; // default 'name'
  order?: 'asc' | 'desc';                        // default 'asc'
  limit?: number;
  offset?: number;
};
```

## Coverage Notes

- `scan` and `stats` are fully implemented from Zig traversal/classification.
- `index` currently returns filesystem index coverage (same base traversal as scan).
- `indexArchives` and `archivePattern` are accepted by the API surface, but archive-entry expansion is not yet implemented in this V8 path.
- `query` runs in JS over scan/index results (text/kind/size filters + sorting + pagination).

## Example

```ts
import { useMedia } from '../../runtime/hooks';

export default function MediaPanel() {
  const media = useMedia();

  const { files, loading, rescan } = media.useScan({
    dir: '/home/user/Movies',
    recursive: true,
    maxDepth: 6,
    kinds: ['video', 'subtitle'],
  });

  const { stats } = media.useStats({
    dir: '/home/user/Movies',
  });

  const { results } = media.useQuery({
    dir: '/home/user/Movies',
    source: 'scan',
    text: 'beethoven',
    kinds: ['audio'],
    orderBy: 'size',
    order: 'desc',
    limit: 100,
  });

  return null;
}
```

## File Map

- Zig host implementation: `framework/v8_bindings_fs.zig`
- Low-level runtime wrapper: `runtime/hooks/media.ts`
- Collapsed hook surface: `runtime/hooks/useMedia.ts`
- Public exports: `runtime/hooks/index.ts`
