#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'layout-board.mjs');
const nodes = [
  { id: 'a', name: 'Alpha', position: { x: 0, y: 0 }, focal: true, group: 'core' },
  { id: 'b', name: 'Beta', position: { x: 0, y: 0 }, group: 'north' },
  { id: 'c', name: 'Gamma', position: { x: 0, y: 0 }, group: 'south' },
  { id: 'd', name: 'Delta', position: { x: 0, y: 0 }, group: 'north' },
  { id: 'e', name: 'Epsilon', position: { x: 0, y: 0 }, group: 'south' },
];
const edges = [
  { id: 'ab', source: 'a', target: 'b', label: 'supports' },
  { id: 'ac', source: 'a', target: 'c', label: 'influences' },
  { id: 'bd', source: 'b', target: 'd', label: 'documents' },
  { id: 'ce', source: 'c', target: 'e', label: 'follows' },
];

function run(options, sourceNodes = nodes) {
  return runBoard(options, sourceNodes, edges);
}

function runBoard(options, sourceNodes, sourceEdges) {
  return JSON.parse(
    execFileSync(process.execPath, [script], {
      input: JSON.stringify({
        nodes: sourceNodes,
        edges: sourceEdges,
        options,
      }),
      encoding: 'utf8',
    })
  );
}

for (const archetype of ['investigation', 'hierarchy', 'timeline', 'process', 'research', 'relationship']) {
  const result = run({ archetype, seed: 17, iterations: 120 });
  assert.equal(result.layout.archetype, archetype);
  assert.equal(result.nodes.length, nodes.length);
  assert.equal(result.layout.quality.nodeOverlaps, 0, `${archetype} has node overlap`);
  assert.ok(result.layout.quality.score >= 0);
}

const first = run({ archetype: 'research', seed: 99 });
const second = run({ archetype: 'research', seed: 99 });
assert.deepEqual(first.nodes, second.nodes, 'same seed must produce same positions');

const arrangedInput = nodes.map((node) => ({ ...node, position: { x: 10, y: 10 } }));
const arranged = run({ archetype: 'relationship', mode: 'arrange', seed: 4, iterations: 120 }, arrangedInput);
assert.equal(arranged.layout.mode, 'arrange');
assert.deepEqual(arranged.nodes.map((node) => node.id), arrangedInput.map((node) => node.id));
assert.equal(arranged.nodes[0].name, arrangedInput[0].name);
assert.equal(arranged.layout.quality.nodeOverlaps, 0, 'arrange mode must repair overlapping cards');

const jungleNodes = Array.from({ length: 9 }, (_, index) => ({
  id: `jungle-${index}`,
  name: index === 4 ? 'Pirate Pop' : `Jungle card ${index}`,
  position: { x: (index % 3) * 320, y: Math.floor(index / 3) * 260 },
  size: {
    width: index === 4 ? 250 : 220,
    height: 140 + (index % 3) * 50,
  },
  focal: index === 4,
  group: index < 3 ? 'places' : index < 6 ? 'people' : 'evidence',
}));
const jungleEdges = jungleNodes
  .filter((node) => !node.focal)
  .map((node, index) => ({
    id: `jungle-edge-${index}`,
    source: 'jungle-4',
    target: node.id,
    label: `relationship ${index}`,
  }));
const organic = runBoard(
  {
    archetype: 'investigation',
    mode: 'arrange',
    seed: 97,
    iterations: 160,
  },
  jungleNodes,
  jungleEdges
);
const repeated = runBoard(
  {
    archetype: 'investigation',
    mode: 'arrange',
    seed: 97,
    iterations: 160,
  },
  jungleNodes,
  jungleEdges
);

assert.notDeepEqual(
  organic.nodes.map((node) => node.position),
  jungleNodes.map((node) => node.position),
  'arrange mode must recompose a rigid input grid'
);
assert.deepEqual(
  organic.nodes,
  repeated.nodes,
  'controlled staggering must be deterministic'
);
assert.equal(organic.layout.quality.nodeOverlaps, 0);
assert.equal(organic.layout.quality.edgeThroughNodes, 0);
assert.equal(organic.layout.quality.labelCollisions, 0);
assert.ok(
  organic.layout.quality.maxSharedX <= 3,
  'freeform cards must not retain rigid columns'
);
assert.ok(
  organic.layout.quality.maxSharedY <= 3,
  'freeform cards must not retain rigid rows'
);
assert.ok(
  !organic.layout.quality.unresolved.some((item) =>
    item.includes('shared alignment')
  )
);
assert.ok(organic.layout.quality.aspectRatio >= 0.65);
assert.ok(organic.layout.quality.aspectRatio <= 1.85);
assert.ok(
  !organic.layout.quality.unresolved.some((item) =>
    item.includes('both canvas axes')
  )
);

function rectangleClearance(a, b) {
  const aRight = a.position.x + a.size.width;
  const aBottom = a.position.y + a.size.height;
  const bRight = b.position.x + b.size.width;
  const bBottom = b.position.y + b.size.height;
  const horizontal = Math.max(
    0,
    a.position.x - bRight,
    b.position.x - aRight
  );
  const vertical = Math.max(
    0,
    a.position.y - bBottom,
    b.position.y - aBottom
  );
  return Math.hypot(horizontal, vertical);
}

for (let left = 0; left < organic.nodes.length; left++) {
  for (let right = left + 1; right < organic.nodes.length; right++) {
    assert.ok(
      rectangleClearance(organic.nodes[left], organic.nodes[right]) >= 40,
      `${organic.nodes[left].id} and ${organic.nodes[right].id} need 40px clearance`
    );
  }
}

for (const archetype of ['investigation', 'research', 'relationship']) {
  const freeform = runBoard(
    { archetype, mode: 'generate', seed: 97, iterations: 160 },
    jungleNodes,
    jungleEdges
  );
  assert.ok(freeform.layout.quality.maxSharedX <= 3);
  assert.ok(freeform.layout.quality.maxSharedY <= 3);
  assert.equal(freeform.layout.quality.nodeOverlaps, 0);
  assert.ok(freeform.layout.quality.aspectRatio >= 0.65);
  assert.ok(freeform.layout.quality.aspectRatio <= 1.85);
}

const twoCardBoard = runBoard(
  { archetype: 'relationship', seed: 41 },
  [
    {
      id: 'anchor',
      name: 'Anchor',
      position: { x: 0, y: 0 },
      size: { width: 220, height: 140 },
      focal: true,
    },
    {
      id: 'related',
      name: 'Related',
      position: { x: 0, y: 300 },
      size: { width: 220, height: 140 },
    },
  ],
  [{ id: 'pair', source: 'anchor', target: 'related', label: 'relates' }]
);
const anchor = twoCardBoard.nodes.find((node) => node.id === 'anchor');
const related = twoCardBoard.nodes.find((node) => node.id === 'related');
assert.ok(
  Math.abs(related.position.x - anchor.position.x) >
    Math.abs(related.position.y - anchor.position.y),
  'a single related card should use horizontal space instead of defaulting below'
);

const tallInput = jungleNodes.map((node, index) => ({
  ...node,
  position: { x: 0, y: index * 280 },
}));
const balanced = runBoard(
  { archetype: 'investigation', mode: 'arrange', seed: 97 },
  tallInput,
  jungleEdges
);
assert.ok(balanced.layout.quality.aspectRatio >= 0.65);
assert.ok(balanced.layout.quality.aspectRatio <= 1.85);
assert.ok(
  balanced.layout.bounds.width > tallInput[0].size.width * 3,
  'arranging a tall stack must reclaim horizontal canvas space'
);

const timeline = runBoard(
  { archetype: 'timeline', seed: 97 },
  jungleNodes,
  []
);
assert.equal(
  new Set(timeline.nodes.map((node) => node.position.y)).size,
  2,
  'timeline must retain its meaningful two-band alignment'
);

console.log('layout-board smoke tests passed');
