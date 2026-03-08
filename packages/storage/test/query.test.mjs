import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyQuery } from '../src/query.ts';

const RECORDS = [
  { id: 'a', name: 'alpha', score: 10, active: true, tags: ['core', 'ui'], notes: 'first release' },
  { id: 'b', name: 'beta', score: 30, active: false, tags: ['network'], notes: 'second release' },
  { id: 'c', name: 'gamma', score: 20, active: true, tags: ['ui', 'tools'], notes: 'third milestone' },
  { id: 'd', name: 'delta', score: 20, active: true, tags: [], notes: 'final candidate' },
];

describe('storage query filter semantics', () => {
  it('returns the original array unchanged when no query is provided', () => {
    assert.equal(applyQuery(RECORDS), RECORDS);
  });

  it('supports direct equality filters', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { active: true } }).map((item) => item.id),
      ['a', 'c', 'd'],
    );
  });

  it('supports null equality plus $eq, $ne, and $lte operator combinations', () => {
    const items = [
      { id: 'a', archivedAt: null, score: 10, active: true },
      { id: 'b', archivedAt: 1_700_000_000_000, score: 20, active: false },
      { id: 'c', archivedAt: null, score: 20, active: true },
    ];

    assert.deepEqual(
      applyQuery(items, { where: { archivedAt: null } }).map((item) => item.id),
      ['a', 'c'],
    );

    assert.deepEqual(
      applyQuery(items, { where: { score: { $eq: 20, $lte: 20 }, active: { $ne: false } } }).map((item) => item.id),
      ['c'],
    );
  });

  it('supports comparison operators against scalar fields', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { score: { $gte: 20, $lt: 30 } } }).map((item) => item.id),
      ['c', 'd'],
    );
  });

  it('supports $in membership checks', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { name: { $in: ['alpha', 'gamma'] } } }).map((item) => item.id),
      ['a', 'c'],
    );
  });

  it('supports $contains for both arrays and strings', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { tags: { $contains: 'ui' } } }).map((item) => item.id),
      ['a', 'c'],
    );

    assert.deepEqual(
      applyQuery(RECORDS, { where: { notes: { $contains: 'release' } } }).map((item) => item.id),
      ['a', 'b'],
    );
  });

  it('returns no matches when $contains targets unsupported scalar fields', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { score: { $contains: '2' } } }),
      [],
    );
  });

  it('requires all where clauses to match', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { where: { active: true, score: { $gt: 15 } } }).map((item) => item.id),
      ['c', 'd'],
    );
  });
});

describe('storage query ordering and pagination semantics', () => {
  it('sorts ascending and descending by a requested field', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { orderBy: 'score', order: 'asc' }).map((item) => item.id),
      ['a', 'c', 'd', 'b'],
    );

    assert.deepEqual(
      applyQuery(RECORDS, { orderBy: 'score', order: 'desc' }).map((item) => item.id),
      ['b', 'c', 'd', 'a'],
    );
  });

  it('defaults to ascending order and treats offset 0 as no pagination', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { orderBy: 'name', offset: 0 }).map((item) => item.id),
      ['a', 'b', 'd', 'c'],
    );
  });

  it('applies filter, then sort, then offset and limit', () => {
    assert.deepEqual(
      applyQuery(RECORDS, {
        where: { active: true },
        orderBy: 'name',
        order: 'asc',
        offset: 1,
        limit: 1,
      }).map((item) => item.id),
      ['d'],
    );
  });

  it('does not mutate the input array when sorting', () => {
    const items = [...RECORDS];
    const before = items.map((item) => item.id);

    applyQuery(items, { orderBy: 'score', order: 'desc' });

    assert.deepEqual(items.map((item) => item.id), before);
  });

  it('treats limit 0 as an empty page', () => {
    assert.deepEqual(
      applyQuery(RECORDS, { orderBy: 'score', order: 'asc', limit: 0 }),
      [],
    );
  });
});
