#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'audit-strings.mjs');

function run(board, extra = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      input: JSON.stringify({ ...board, ...extra }),
      encoding: 'utf8',
    });
    return { ok: true, report: JSON.parse(stdout) };
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout) : '';
    return {
      ok: false,
      report: stdout ? JSON.parse(stdout) : null,
      status: error.status,
    };
  }
}

function card(id, x, y, width = 340, height = 200) {
  return { id, position: { x, y }, size: { width, height } };
}

const adjacent = run({
  nodes: [card('a', 0, 0), card('b', 500, 0)],
  edges: [{ id: 'ab', source: 'a', target: 'b' }],
  options: { relationshipSag: 162 },
});
assert.equal(adjacent.ok, true);
assert.equal(adjacent.report.quality.stringsThroughCards, 0);
assert.equal(adjacent.report.quality.stringCrossings, 0);

const throughMiddle = run({
  nodes: [card('a', 0, 0), card('mid', 500, 0), card('c', 1000, 0)],
  edges: [{ id: 'ac', source: 'a', target: 'c' }],
  options: { relationshipSag: 162 },
});
assert.equal(throughMiddle.ok, false);
assert.equal(throughMiddle.report.quality.hits[0].card, 'mid');

const triangle = run({
  nodes: [card('a', 500, 0), card('b', 0, 600), card('c', 1000, 600)],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
    { id: 'ca', source: 'c', target: 'a' },
  ],
  options: { relationshipSag: 162 },
});
assert.equal(triangle.ok, true);
assert.equal(triangle.report.quality.stringCrossings, 0);

const diagonals = run({
  nodes: [
    card('a', 0, 0),
    card('b', 0, 240),
    card('c', 1400, 0),
    card('d', 1400, 900),
  ],
  edges: [
    { id: 'ad', source: 'a', target: 'd' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
  options: { relationshipSag: 50 },
});
assert.equal(diagonals.ok, false, 'a string crossing must fail the audit');
assert.ok(diagonals.report.quality.stringCrossings >= 1);

const extras = run({
  nodes: [
    card('hub', 0, 0),
    card('main', 800, 0),
    card('blocked', 400, 0),
    card('side', 800, 600),
  ],
  edges: [
    {
      id: 'hub-main',
      source: { kind: 'node', id: 'hub' },
      target: { kind: 'node', id: 'main' },
      data: { extraTargets: ['side'] },
    },
  ],
  options: { relationshipSag: 162 },
});
assert.equal(extras.ok, false);
assert.ok(
  extras.report.quality.hits.some(
    (hit) => hit.path === 'hub-main' && hit.card === 'blocked'
  )
);

console.log('audit-strings tests passed');
