/** Normalized feed item — works for RSS 2.0, Atom, and RSS 1.0 feeds */
export interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  content: string | null;
  pubDate: string | null;
  author: string | null;
  categories: string[];
  enclosure: {
    url: string;
    type: string;
    length: number;
  } | null;
  thumbnail: string | null;
}

/** Normalized feed metadata */
export interface Feed {
  title: string;
  description: string;
  link: string;
  language: string | null;
  lastBuildDate: string | null;
  image: string | null;
  type: 'rss2' | 'atom' | 'rss1' | 'unknown';
  items: FeedItem[];
}

/** Options for useFeedStream */
export interface FeedStreamOptions {
  interval?: number;
  limit?: number;
  dedupe?: boolean;
  corsProxy?: string;
}

/** Result from useFeedStream */
export interface FeedStreamResult {
  feed: Feed | null;
  items: FeedItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Options for useFeedAggregate */
export interface FeedAggregateOptions {
  interval?: number;
  limit?: number;
  corsProxy?: string;
}

/** Result from useFeedAggregate */
export interface FeedAggregateResult {
  items: Array<FeedItem & { feedTitle: string; feedUrl: string }>;
  feeds: Array<{ url: string; feed: Feed | null; error: Error | null }>;
  loading: boolean;
  refetch: () => void;
}
