/** Normalized feed item — works for RSS 2.0, Atom, and RSS 1.0 feeds */
export interface FeedItem {
  /** Unique identifier (guid/id) */
  id: string;
  /** Item title */
  title: string;
  /** Item URL */
  link: string;
  /** Summary or full content (HTML) */
  description: string;
  /** Full content if available (content:encoded or atom content) */
  content: string | null;
  /** Publication date as ISO string */
  pubDate: string | null;
  /** Author name */
  author: string | null;
  /** Category tags */
  categories: string[];
  /** Enclosure (podcast audio, images, etc.) */
  enclosure: {
    url: string;
    type: string;
    length: number;
  } | null;
  /** Thumbnail/image URL extracted from media:thumbnail, media:content, or itunes:image */
  thumbnail: string | null;
}

/** Normalized feed metadata */
export interface Feed {
  /** Feed title */
  title: string;
  /** Feed description */
  description: string;
  /** Feed website link */
  link: string;
  /** Feed language (e.g. 'en') */
  language: string | null;
  /** Last build/update date */
  lastBuildDate: string | null;
  /** Feed image/logo URL */
  image: string | null;
  /** Feed type detected */
  type: 'rss2' | 'atom' | 'rss1' | 'unknown';
  /** All items in the feed */
  items: FeedItem[];
}

/** Options for useRSSFeed */
export interface RSSFeedOptions {
  /** Polling interval in ms (0 = no polling) */
  interval?: number;
  /** Max items to keep (newest first). Default: all */
  limit?: number;
  /** Enable deduplication by id. Default: true */
  dedupe?: boolean;
  /** CORS proxy prefix (prepended to feed URL). Useful for web target. */
  corsProxy?: string;
}

/** Result from useRSSFeed */
export interface RSSFeedResult {
  feed: Feed | null;
  items: FeedItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Options for useRSSAggregate */
export interface RSSAggregateOptions {
  interval?: number;
  limit?: number;
  corsProxy?: string;
}

/** Result from useRSSAggregate */
export interface RSSAggregateResult {
  items: Array<FeedItem & { feedTitle: string; feedUrl: string }>;
  feeds: Array<{ url: string; feed: Feed | null; error: Error | null }>;
  loading: boolean;
  refetch: () => void;
}
