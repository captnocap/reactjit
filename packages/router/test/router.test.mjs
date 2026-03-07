import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryHistory, locationToString, parsePath } from '../src/history.ts';
import { findBestMatch, matchRoute, scorePattern } from '../src/matcher.ts';

describe('router matching semantics', () => {
  it('matches exact static routes and tolerates trailing slashes', () => {
    assert.deepEqual(matchRoute('/settings', '/settings/'), {
      matched: true,
      params: {},
      path: '/settings',
    });

    assert.deepEqual(matchRoute('/', '/'), {
      matched: true,
      params: {},
      path: '/',
    });
  });

  it('rejects non-matching static routes', () => {
    assert.deepEqual(matchRoute('/settings', '/profile'), {
      matched: false,
      params: {},
      path: '/settings',
    });
  });

  it('extracts and decodes named parameters', () => {
    assert.deepEqual(
      matchRoute('/users/:userId/posts/:slug', '/users/alice%20smith/posts/hello%2Fworld'),
      {
        matched: true,
        params: {
          userId: 'alice smith',
          slug: 'hello/world',
        },
        path: '/users/:userId/posts/:slug',
      },
    );
  });

  it('supports optional parameters when omitted or present', () => {
    const withoutYear = matchRoute('/reports/:year?', '/reports');
    assert.deepEqual(withoutYear, {
      matched: true,
      params: {},
      path: '/reports/:year?',
    });
    assert.equal(Object.hasOwn(withoutYear.params, 'year'), false);

    assert.deepEqual(matchRoute('/reports/:year?', '/reports/2026'), {
      matched: true,
      params: { year: '2026' },
      path: '/reports/:year?',
    });
  });

  it('captures wildcard remainders without requiring an extra segment', () => {
    assert.deepEqual(matchRoute('/files/*', '/files/assets/icons/logo.svg'), {
      matched: true,
      params: { $rest: 'assets/icons/logo.svg' },
      path: '/files/*',
    });

    const withoutRemainder = matchRoute('/files/*', '/files');
    assert.deepEqual(withoutRemainder, {
      matched: true,
      params: {},
      path: '/files/*',
    });
    assert.equal(Object.hasOwn(withoutRemainder.params, '$rest'), false);
  });

  it('ranks static routes ahead of dynamic, optional, and wildcard routes', () => {
    assert.ok(scorePattern('/users/new') > scorePattern('/users/:id'));
    assert.ok(scorePattern('/users/:id') > scorePattern('/users/:id?'));
    assert.ok(scorePattern('/users/:id?') > scorePattern('/users/*'));
  });

  it('finds the most specific match when several routes apply', () => {
    assert.deepEqual(
      findBestMatch(['/users/*', '/users/:id', '/users/new'], '/users/new'),
      {
        matched: true,
        params: {},
        path: '/users/new',
      },
    );

    assert.deepEqual(
      findBestMatch(['/users/*', '/users/:id'], '/users/42'),
      {
        matched: true,
        params: { id: '42' },
        path: '/users/:id',
      },
    );
  });

  it('returns null when no route matches', () => {
    assert.equal(findBestMatch(['/users/:id', '/files/*'], '/settings'), null);
  });
});

describe('memory history semantics', () => {
  it('parses and reconstructs paths with search and hash segments', () => {
    const location = parsePath('/users/42?tab=activity#recent');
    assert.deepEqual(location, {
      pathname: '/users/42',
      search: '?tab=activity',
      hash: '#recent',
    });
    assert.equal(locationToString(location), '/users/42?tab=activity#recent');
    assert.equal(locationToString(parsePath('')), '/');
  });

  it('treats everything after # as hash content, even if it contains a query-like suffix', () => {
    assert.deepEqual(parsePath('/users/42#recent?tab=activity'), {
      pathname: '/users/42',
      search: '',
      hash: '#recent?tab=activity',
    });
  });

  it('reconstructs locations from explicit pathname, search, and hash fields', () => {
    assert.equal(
      locationToString({ pathname: '/users/42', search: '?tab=activity', hash: '#recent' }),
      '/users/42?tab=activity#recent',
    );
    assert.equal(
      locationToString({ pathname: '/users/42', search: '?tab=activity', hash: '' }),
      '/users/42?tab=activity',
    );
    assert.equal(
      locationToString({ pathname: '/users/42', search: '', hash: '#recent' }),
      '/users/42#recent',
    );
  });

  it('starts from the requested initial entry', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/about?tab=team#bio'],
      initialIndex: 1,
    });

    assert.deepEqual(history.location, {
      pathname: '/about',
      search: '?tab=team',
      hash: '#bio',
    });
  });

  it('pushes, navigates backward and forward, and truncates stale forward entries', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/about', '/docs'],
      initialIndex: 1,
    });

    history.back();
    assert.equal(locationToString(history.location), '/home');

    history.forward();
    assert.equal(locationToString(history.location), '/about');

    history.push('/pricing?plan=pro');
    assert.equal(locationToString(history.location), '/pricing?plan=pro');

    history.forward();
    assert.equal(locationToString(history.location), '/pricing?plan=pro');

    history.back();
    assert.equal(locationToString(history.location), '/about');

    history.forward();
    assert.equal(locationToString(history.location), '/pricing?plan=pro');
  });

  it('replaces the current entry without disturbing adjacent navigation', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/docs'],
      initialIndex: 1,
    });

    history.replace('/guides#intro');
    assert.equal(locationToString(history.location), '/guides#intro');

    history.back();
    assert.equal(locationToString(history.location), '/home');

    history.forward();
    assert.equal(locationToString(history.location), '/guides#intro');
  });

  it('notifies subscribers on navigation and stops after unsubscribe', () => {
    const history = createMemoryHistory();
    const seen = [];

    const unsubscribe = history.subscribe((location) => {
      seen.push(locationToString(location));
    });

    history.push('/a');
    history.replace('/b?x=1');
    history.back();
    unsubscribe();
    history.forward();

    assert.deepEqual(seen, ['/a', '/b?x=1', '/']);
  });
});
