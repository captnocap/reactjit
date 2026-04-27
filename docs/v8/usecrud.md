# `useCRUD` (V8 Runtime)

`useCRUD` is a V8-only storage hook exposed from `runtime/hooks/useCRUD.ts`.

It provides one collapsed surface:

- typed CRUD methods
- query filtering/sorting/pagination
- optional record migrations
- reactive query hooks (`useQuery`, `useListQuery`)

## Runtime Scope

This implementation is wired only through V8 host bindings.

Required host functions:

- `__localstoreGet`
- `__localstoreHas`
- `__localstoreSet`
- `__localstoreDelete`
- `__localstoreKeysJson`

If these are missing, `useCRUD` throws on initialization.

## Signature

```ts
useCRUD<T extends Record<string, any>>(
  collection: string,
  schema: { parse(value: unknown): T },
  options?: {
    namespace?: string;                 // default: 'crud'
    migrations?: Record<number, (data: any) => any>;
    autoMigrate?: boolean;              // default: false
  },
)
```

## Returned Surface

```ts
{
  create(data: T): Promise<string>;
  get(id: string): Promise<T | null>;
  update(id: string, partial: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  list(query?: Query): Promise<T[]>;
  useQuery(id: string): {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  useListQuery(query?: Query): {
    data: T[];
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  };
}
```

## Query Shape

```ts
type Query = {
  where?: Record<
    string,
    any | Partial<Record<'$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$contains', any>>
  >;
  orderBy?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};
```

## Storage Model

- Backing store is namespaced localstore.
- Records are stored as JSON strings keyed by:
  - `${collection}:${id}`
- Namespace defaults to `crud` and is overrideable via `options.namespace`.

## Migrations

When `options.migrations` is provided:

- writes stamp `_version` with the latest migration version
- reads can migrate old records when `autoMigrate: true`
- migrated records are persisted back automatically

## Example

```ts
import { useCRUD } from '../../runtime/hooks';
import { z } from '../path/to/schema'; // any schema object with parse()

const Todo = z.object({
  id: z.string().optional(),
  title: z.string(),
  done: z.boolean().default(false),
});

export default function Todos() {
  const todos = useCRUD('todos', Todo, { namespace: 'app' });
  const { data, loading, refetch } = todos.useListQuery({
    where: { done: false },
    orderBy: 'title',
    order: 'asc',
  });

  // create/update/delete/list/get are all async methods on `todos`
  return null;
}
```

## File Map

- Hook surface: `runtime/hooks/useCRUD.ts`
- JS host wrappers: `runtime/hooks/localstore.ts`
- V8 host registration + callback: `framework/v8_bindings_core.zig`
