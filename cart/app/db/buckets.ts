// Database buckets — multi-DB partitioning by role × cartridge.
//
// Why multi-DB: blast-radius isolation. Each bucket is an independent
// Postgres database in the embedded cluster, so `DROP DATABASE foo` resets
// one without touching the others.
//
// Partitioning axes (per cart/app/docs/12-the-three-roles.md):
//   - Assistant lives at shell level → one cross-cartridge bucket.
//   - User identity is shell level, but user's *operational* data within a
//     cartridge is cartridge-scoped → `user` + `user-<cart>`.
//   - Worker is cartridge-defined → `worker-<cart>`.
//   - Supervisor exists only in cartridges that hire workers (currently
//     just sweatshop) → `supervisor-<cart>` for those.
//   - Embeddings + memories are large/independent enough to stand alone.
//   - Provider-keys is the encryption boundary for credential material
//     (empty until/unless the cart stores key bytes in-DB).

export type BucketId =
  | 'user'
  | 'assistant'
  | 'embeddings'
  | 'memories'
  | 'provider-keys'
  | 'user-sweatshop'
  | 'supervisor-sweatshop'
  | 'worker-sweatshop';

export interface Bucket {
  id: BucketId;
  // Postgres database name. Lowercase, underscore-separated; prefixed
  // `cart_` to namespace away from `embed_bench` and other clusters.
  databaseName: string;
  description: string;
}

export const BUCKETS: Record<BucketId, Bucket> = {
  'user': {
    id: 'user',
    databaseName: 'cart_user',
    description: 'Cross-cartridge user identity, settings, privacy, env, UI customization.',
  },
  'assistant': {
    id: 'assistant',
    databaseName: 'cart_assistant',
    description: 'Cross-cartridge assistant: Character + Manifest + voice substrate, registries, model/retrieval interaction.',
  },
  'embeddings': {
    id: 'embeddings',
    databaseName: 'cart_embeddings',
    description: 'Vectors + corpus chunks + ingest pipeline state. Largest blast radius; HNSW rebuilds are slow.',
  },
  'memories': {
    id: 'memories',
    databaseName: 'cart_memories',
    description: 'M3A layers — semantic / episodic / procedural / working / agent memory.',
  },
  'provider-keys': {
    id: 'provider-keys',
    databaseName: 'cart_provider_keys',
    description: 'Encrypted provider API key material. Empty unless the cart stores key bytes in-DB rather than referencing OS env.',
  },
  'user-sweatshop': {
    id: 'user-sweatshop',
    databaseName: 'cart_user_sweatshop',
    description: 'User\'s sweatshop-grain operational data: goals, plans, projects, tasks, budgets.',
  },
  'supervisor-sweatshop': {
    id: 'supervisor-sweatshop',
    databaseName: 'cart_supervisor_sweatshop',
    description: 'Sweatshop supervisor: pathology catalog, laws, recipes, traces, edit-trail.',
  },
  'worker-sweatshop': {
    id: 'worker-sweatshop',
    databaseName: 'cart_worker_sweatshop',
    description: 'Sweatshop workers + sessions + events + jobs + raw event sources.',
  },
};

export const BUCKET_IDS: BucketId[] = Object.keys(BUCKETS) as BucketId[];
