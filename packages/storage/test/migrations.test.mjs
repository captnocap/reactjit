import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createMigratingAdapter,
  getLatestVersion,
  migrateRecord,
  stampVersion,
} from '../src/migrations.ts';

function createAdapter({ getValue = null, listValue = [] } = {}) {
  const calls = [];

  return {
    calls,
    adapter: {
      async get(collection, id) {
        calls.push(['get', collection, id]);
        return getValue;
      },
      async set(collection, id, data) {
        calls.push(['set', collection, id, data]);
      },
      async delete(collection, id) {
        calls.push(['delete', collection, id]);
        return true;
      },
      async list(collection, query) {
        calls.push(['list', collection, query]);
        return listValue;
      },
    },
  };
}

describe('storage migration version semantics', () => {
  it('finds the highest numeric migration version', () => {
    assert.equal(getLatestVersion({ 1: (d) => d, 3: (d) => d, nope: (d) => d }), 3);
    assert.equal(getLatestVersion({}), 0);
  });

  it('applies sequential migrations only when auto-migrate is enabled', () => {
    const migrations = {
      1: (data) => ({ ...data, name: data.username, _version: 1 }),
      2: (data) => ({ ...data, email: `${data.name}@example.com` }),
    };

    assert.deepEqual(
      migrateRecord({ id: 'u1', username: 'alice' }, migrations, true),
      {
        id: 'u1',
        username: 'alice',
        name: 'alice',
        email: 'alice@example.com',
        _version: 2,
      },
    );

    const original = { id: 'u1', username: 'alice' };
    assert.equal(migrateRecord(original, migrations, false), original);
    assert.deepEqual(
      migrateRecord({ id: 'u1', username: 'alice', _version: 2 }, migrations, true),
      { id: 'u1', username: 'alice', _version: 2 },
    );
  });

  it('stamps writes with the latest schema version and leaves empty migrations untouched', () => {
    const migrations = {
      2: (data) => ({ ...data, active: true }),
      4: (data) => data,
    };

    assert.deepEqual(stampVersion({ id: 'u1' }, migrations), { id: 'u1', _version: 4 });

    const original = { id: 'u1' };
    assert.equal(stampVersion(original, {}), original);
  });
});

describe('storage migrating adapter contract', () => {
  it('returns the original adapter when no migrations exist', () => {
    const { adapter } = createAdapter();
    assert.equal(createMigratingAdapter(adapter, {}, true), adapter);
  });

  it('migrates stale records on get and writes them back once', async () => {
    const migrations = {
      1: (data) => ({ ...data, active: true }),
    };
    const { adapter, calls } = createAdapter({ getValue: { id: 'u1', name: 'alice' } });
    const wrapped = createMigratingAdapter(adapter, migrations, true);

    const result = await wrapped.get('users', 'u1');

    assert.deepEqual(result, { id: 'u1', name: 'alice', active: true, _version: 1 });
    assert.deepEqual(calls, [
      ['get', 'users', 'u1'],
      ['set', 'users', 'u1', { id: 'u1', name: 'alice', active: true, _version: 1 }],
    ]);
  });

  it('stamps records on set and skips read-side write-back when auto-migrate is disabled', async () => {
    const migrations = {
      2: (data) => ({ ...data, active: true }),
    };
    const { adapter, calls } = createAdapter({ getValue: { id: 'u1', name: 'alice' } });
    const wrapped = createMigratingAdapter(adapter, migrations, false);

    await wrapped.set('users', 'u1', { id: 'u1', name: 'alice' });
    const result = await wrapped.get('users', 'u1');

    assert.deepEqual(result, { id: 'u1', name: 'alice' });
    assert.deepEqual(calls, [
      ['set', 'users', 'u1', { id: 'u1', name: 'alice', _version: 2 }],
      ['get', 'users', 'u1'],
    ]);
  });

  it('migrates list results and writes back only outdated items', async () => {
    const migrations = {
      1: (data) => ({ ...data, active: true }),
      2: (data) => ({ ...data, slug: data.name.toLowerCase() }),
    };
    const listValue = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob', active: true, slug: 'bob', _version: 2 },
    ];
    const { adapter, calls } = createAdapter({ listValue });
    const wrapped = createMigratingAdapter(adapter, migrations, true);

    const result = await wrapped.list('users', { limit: 10 });

    assert.deepEqual(result, [
      { id: 'u1', name: 'Alice', active: true, slug: 'alice', _version: 2 },
      { id: 'u2', name: 'Bob', active: true, slug: 'bob', _version: 2 },
    ]);
    assert.deepEqual(calls, [
      ['list', 'users', { limit: 10 }],
      ['set', 'users', 'u1', { id: 'u1', name: 'Alice', active: true, slug: 'alice', _version: 2 }],
    ]);
  });
});
