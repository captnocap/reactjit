// ── Types ───────────────────────────────────────────────
export type {
  Feed,
  FeedItem,
  RSSFeedOptions,
  RSSFeedResult,
  RSSAggregateOptions,
  RSSAggregateResult,
} from './types';

// ── Parser ──────────────────────────────────────────────
export { parseFeed } from './parser';

// ── Hooks ───────────────────────────────────────────────
export { useRSSFeed, useRSSAggregate, fetchFeed } from './hooks';

// ── OPML ────────────────────────────────────────────────
export { parseOPML, generateOPML } from './opml';
export type { OPMLOutline } from './opml';
