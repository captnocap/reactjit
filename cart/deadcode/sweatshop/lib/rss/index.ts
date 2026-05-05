// ── Types ───────────────────────────────────────────────
export type {
  Feed,
  FeedItem,
  FeedStreamOptions,
  FeedStreamResult,
  FeedAggregateOptions,
  FeedAggregateResult,
} from './types';

// ── Parser ──────────────────────────────────────────────
export { parseFeed } from './parser';

// ── Hooks ───────────────────────────────────────────────
export { useFeedStream, useFeedAggregate, fetchFeed } from './useFeedStream';

// ── OPML ────────────────────────────────────────────────
export { parseOPML, generateOPML } from './opml';
export type { OPMLOutline } from './opml';
