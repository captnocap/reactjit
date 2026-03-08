import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createPresentationDocument,
  createPresentationGroupNode,
  createPresentationSlide,
  createPresentationTextNode,
  findPresentationNode,
  getSlideStepCount,
} from '../src/document.ts';
import {
  applyPresentationPatch,
  applyPresentationPatches,
} from '../src/patches.ts';

function createFactory() {
  let counter = 0;
  return {
    now: () => '2026-03-07T18:00:00.000Z',
    idFactory: (prefix) => {
      counter += 1;
      return `${prefix}_${counter}`;
    },
  };
}

describe('presentation document foundations', () => {
  it('creates a normalized deck with a default slide and stage defaults', () => {
    const doc = createPresentationDocument(
      { title: 'Quarterly Update' },
      createFactory(),
    );

    assert.equal(doc.title, 'Quarterly Update');
    assert.equal(doc.schemaVersion, 1);
    assert.equal(doc.createdAt, '2026-03-07T18:00:00.000Z');
    assert.equal(doc.updatedAt, '2026-03-07T18:00:00.000Z');
    assert.equal(doc.settings.aspectRatio, '16:9');
    assert.deepEqual(doc.settings.stage, { width: 1600, height: 900 });
    assert.equal(doc.settings.authoringMode, 'slide');
    assert.equal(doc.slides.length, 1);
    assert.equal(doc.slides[0].title, '');
    assert.deepEqual(doc.slides[0].camera, { x: 0, y: 0, zoom: 1, rotation: 0 });
  });

  it('applies slide, asset, and nested node patches immutably', () => {
    const factory = createFactory();
    const original = createPresentationDocument({ title: 'Deck' }, factory);
    const introId = original.slides[0].id;
    const roadmap = createPresentationSlide({ title: 'Roadmap' }, factory);
    const heroGroup = createPresentationGroupNode({
      name: 'Hero',
      frame: { x: 40, y: 40, width: 880, height: 360 },
    }, factory);
    const callout = createPresentationTextNode({
      text: 'Move interaction hot paths into Lua',
      frame: { x: 32, y: 32, width: 640, height: 96 },
      fragment: { start: 1 },
    }, factory);

    const doc = applyPresentationPatches(original, [
      {
        type: 'upsertAsset',
        asset: {
          id: 'asset_logo',
          kind: 'image',
          src: 'assets/logo.png',
          title: 'Logo',
        },
      },
      { type: 'addSlide', slide: roadmap },
      { type: 'addNode', slideId: introId, node: heroGroup },
      { type: 'addNode', slideId: introId, parentId: heroGroup.id, node: callout },
      {
        type: 'updateSlide',
        slideId: introId,
        changes: {
          title: 'Overview',
          notes: 'Keep the architecture explanation tight.',
        },
      },
      { type: 'reorderSlide', slideId: roadmap.id, index: 0 },
    ], factory);

    assert.equal(original.slides.length, 1);
    assert.equal(doc.slides.length, 2);
    assert.equal(doc.slides[0].id, roadmap.id);
    assert.equal(doc.assets.asset_logo.kind, 'image');
    assert.equal(doc.slides[1].title, 'Overview');

    const insertedGroup = findPresentationNode(doc.slides[1].nodes, heroGroup.id);
    assert.ok(insertedGroup);
    assert.equal(insertedGroup.kind, 'group');
    assert.equal(insertedGroup.children.length, 1);
    assert.equal(insertedGroup.children[0].kind, 'text');
    assert.equal(insertedGroup.children[0].text, 'Move interaction hot paths into Lua');
  });

  it('counts fragments and preserves at least one slide when removing the last slide', () => {
    const factory = createFactory();
    let doc = createPresentationDocument({}, factory);
    const slideId = doc.slides[0].id;

    doc = applyPresentationPatch(doc, {
      type: 'addNode',
      slideId,
      node: createPresentationTextNode({
        text: 'Deferred reveal',
        fragment: { start: 2, end: 4 },
      }, factory),
    }, factory);

    assert.equal(getSlideStepCount(doc.slides[0]), 4);

    doc = applyPresentationPatch(doc, {
      type: 'removeSlide',
      slideId,
    }, factory);

    assert.equal(doc.slides.length, 1);
    assert.notEqual(doc.slides[0].id, slideId);
  });
});
