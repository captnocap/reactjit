import type { RouteMatch } from './types';

/**
 * Compile a route pattern into a RegExp and extract parameter names.
 *
 * Supports:
 *   /users/:id        → named parameter
 *   /files/*           → wildcard (captures rest of path as $rest)
 *   /users/:id/posts   → mixed static + dynamic
 *   /users/:id?        → optional parameter
 *
 * No external dependency — implements the subset of path-to-regexp
 * that covers real-world routing needs.
 */

interface CompiledRoute {
  regexp: RegExp;
  paramNames: string[];
  score: number;
}

const cache = new Map<string, CompiledRoute>();

function compilePattern(pattern: string): CompiledRoute {
  const cached = cache.get(pattern);
  if (cached) return cached;

  const paramNames: string[] = [];
  let score = 0;
  let regexpStr = '^';

  // Normalize: strip trailing slash (unless pattern is just "/")
  const normalized = pattern === '/' ? '/' : pattern.replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);

  for (const segment of segments) {
    if (segment === '*') {
      // Wildcard: matches the rest of the path
      paramNames.push('$rest');
      regexpStr += '(?:/(.*))?';
      score += 1;
    } else if (segment.startsWith(':')) {
      // Parameter segment
      const optional = segment.endsWith('?');
      const name = optional ? segment.slice(1, -1) : segment.slice(1);
      paramNames.push(name);
      if (optional) {
        regexpStr += '(?:/([^/]+))?';
        score += 2;
      } else {
        regexpStr += '/([^/]+)';
        score += 3;
      }
    } else {
      // Static segment — highest specificity
      regexpStr += '/' + escapeRegExp(segment);
      score += 4;
    }
  }

  // Allow optional trailing slash
  regexpStr += '/?$';

  const compiled: CompiledRoute = {
    regexp: new RegExp(regexpStr),
    paramNames,
    score,
  };
  cache.set(pattern, compiled);
  return compiled;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match a pathname against a route pattern.
 * Returns { matched, params, path } if the pathname matches the pattern.
 */
export function matchRoute(pattern: string, pathname: string): RouteMatch {
  const { regexp, paramNames } = compilePattern(pattern);
  const match = regexp.exec(pathname);

  if (!match) {
    return { matched: false, params: {}, path: pattern };
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    const value = match[i + 1];
    if (value !== undefined) {
      params[paramNames[i]] = decodeURIComponent(value);
    }
  }

  return { matched: true, params, path: pattern };
}

/**
 * Score a pattern for specificity ranking.
 * Higher scores = more specific. Used when multiple routes match.
 */
export function scorePattern(pattern: string): number {
  return compilePattern(pattern).score;
}

/**
 * Given an array of patterns, return the best match for a pathname.
 * "Best" means highest specificity score among all matching patterns.
 */
export function findBestMatch(patterns: string[], pathname: string): RouteMatch | null {
  let best: RouteMatch | null = null;
  let bestScore = -1;

  for (const pattern of patterns) {
    const result = matchRoute(pattern, pathname);
    if (result.matched) {
      const score = scorePattern(pattern);
      if (score > bestScore) {
        best = result;
        bestScore = score;
      }
    }
  }

  return best;
}
