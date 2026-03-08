import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeCameraProps } from '../src/cameraUtils.ts';

function approx(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

function approxVec(actual, expected, epsilon = 1e-6) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    approx(actual[i], expected[i], epsilon);
  }
}

describe('3d camera normalization', () => {
  it('preserves the legacy default look-at camera', () => {
    const camera = normalizeCameraProps();

    assert.equal(camera.projection, 'perspective');
    approxVec(camera.position, [0, -3, 2]);
    approxVec(camera.lookAt, [0, 0, 0]);
    approxVec(camera.up, [0, 0, 1]);
  });

  it('derives orbit camera positions from target, azimuth, elevation, and distance', () => {
    const camera = normalizeCameraProps({
      kind: 'orbit',
      target: [1, 2, 3],
      distance: 4,
      azimuth: 0,
      elevation: 0,
    });

    approxVec(camera.position, [5, 2, 3]);
    approxVec(camera.lookAt, [1, 2, 3]);
    approxVec(camera.up, [0, 0, 1]);
  });

  it('supports first-person cameras from yaw and pitch', () => {
    const camera = normalizeCameraProps({
      kind: 'firstPerson',
      position: [4, 5, 6],
      yaw: Math.PI / 2,
      pitch: 0,
    });

    approxVec(camera.position, [4, 5, 6]);
    approxVec(camera.lookAt, [4, 6, 6]);
    approxVec(camera.up, [0, 0, 1]);
  });

  it('supports preset orthographic views', () => {
    const camera = normalizeCameraProps({
      projection: 'orthographic',
      view: 'top',
      target: [2, 3, 4],
      distance: 10,
      size: 8,
    });

    assert.equal(camera.projection, 'orthographic');
    assert.equal(camera.size, 8);
    approxVec(camera.position, [2, 3, 14]);
    approxVec(camera.lookAt, [2, 3, 4]);
    approxVec(camera.up, [0, 1, 0]);
  });

  it('builds isometric views from presets', () => {
    const camera = normalizeCameraProps({
      view: 'isometric',
      distance: Math.sqrt(3),
    });

    approxVec(camera.position, [1, -1, 1]);
    approxVec(camera.lookAt, [0, 0, 0]);
    approxVec(camera.up, [0, 0, 1]);
  });

  it('applies roll around the forward axis', () => {
    const camera = normalizeCameraProps({
      kind: 'firstPerson',
      position: [0, 0, 0],
      direction: [1, 0, 0],
      roll: Math.PI / 2,
    });

    approxVec(camera.lookAt, [1, 0, 0]);
    approxVec(camera.up, [0, -1, 0]);
  });
});
