import test from 'node:test';
import assert from 'node:assert/strict';
import { payout, spin, SYMBOLS } from './slot.js';
import { resolveCollisions, stepVertical, EYE } from './physics.js';

test('payouts', () => {
  assert.equal(payout([4, 4, 4], 5), 250);
  assert.equal(payout([0, 0, 1], 5), 5);
  assert.equal(payout([0, 1, 2], 5), 0);
});
test('spin returns valid indices', () => {
  for (const i of spin(() => 0.999)) assert.equal(i, SYMBOLS.length - 1);
});
test('collision pushes player out of box and keeps inside room', () => {
  const p = { x: 0.9, z: 0 };
  resolveCollisions(p, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }], 0.3, { minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
  assert.ok(Math.abs(p.x - 1.3) < 1e-9 || p.x >= 1.3 - 1e-9);
  const q = { x: 50, z: -50 };
  resolveCollisions(q, [], 0.3, { minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
  assert.deepEqual(q, { x: 7.7, z: -7.7 });
});
test('jump lands back on ground', () => {
  const s = { y: EYE, vy: 0, onGround: true };
  stepVertical(s, 0.016, true);
  assert.ok(s.y > EYE);
  for (let i = 0; i < 200; i++) stepVertical(s, 0.016, false);
  assert.equal(s.y, EYE); assert.ok(s.onGround);
});
