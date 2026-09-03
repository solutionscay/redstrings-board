#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'layout-board.mjs');

const nodes = [
  { id: 'victim', name: 'Victim', focal: true, group: 'people', position: { x: 0, y: 0 }, size: { width: 240, height: 160 } },
  { id: 'suspect', name: 'Suspect', group: 'people', position: { x: 0, y: 0 }, size: { width: 220, height: 140 } },
  { id: 'partner', name: 'Partner', group: 'people', position: { x: 0, y: 0 }, size: { width: 220, height: 150 } },
  { id: 'witness', name: 'Witness', group: 'people', position: { x: 0, y: 0 }, size: { width: 200, height: 140 } },
  { id: 'warehouse', name: 'Warehouse', group: 'places', position: { x: 0, y: 0 }, size: { width: 230, height: 160 } },
  { id: 'apartment', name: 'Apartment', group: 'places', position: { x: 0, y: 0 }, size: { width: 220, height: 140 } },
  { id: 'cafe', name: 'Cafe', group: 'places', position: { x: 0, y: 0 }, size: { width: 200, height: 130 } },
  { id: 'docks', name: 'Docks', group: 'places', position: { x: 0, y: 0 }, size: { width: 220, height: 150 } },
  { id: 'photo', name: 'Photo', group: 'evidence', position: { x: 0, y: 0 }, size: { width: 180, height: 200 } },
  { id: 'ledger', name: 'Ledger', group: 'evidence', position: { x: 0, y: 0 }, size: { width: 200, height: 160 } },
  { id: 'print', name: 'Print', group: 'evidence', position: { x: 0, y: 0 }, size: { width: 190, height: 140 } },
  { id: 'message', name: 'Message', group: 'evidence', position: { x: 0, y: 0 }, size: { width: 210, height: 130 } },
  { id: 'shipping', name: 'Shipping Co', group: 'orgs', position: { x: 0, y: 0 }, size: { width: 220, height: 140 } },
  { id: 'shell', name: 'Shell LLC', group: 'orgs', position: { x: 0, y: 0 }, size: { width: 220, height: 140 } },
  { id: 'union', name: 'Union', group: 'orgs', position: { x: 0, y: 0 }, size: { width: 200, height: 140 } },
  { id: 'lender', name: 'Lender', group: 'orgs', position: { x: 0, y: 0 }, size: { width: 220, height: 150 } },
];

const edges = [
  { id: 'e01', source: 'victim', target: 'suspect', label: 'accused' },
  { id: 'e02', source: 'victim', target: 'partner', label: 'knew' },
  { id: 'e03', source: 'victim', target: 'witness', label: 'saw' },
  { id: 'e04', source: 'suspect', target: 'warehouse', label: 'visited' },
  { id: 'e05', source: 'suspect', target: 'apartment', label: 'rented' },
  { id: 'e06', source: 'partner', target: 'cafe', label: 'met at' },
  { id: 'e07', source: 'witness', target: 'docks', label: 'worked' },
  { id: 'e08', source: 'warehouse', target: 'photo', label: 'shows' },
  { id: 'e09', source: 'warehouse', target: 'ledger', label: 'records' },
  { id: 'e10', source: 'apartment', target: 'print', label: 'found' },
  { id: 'e11', source: 'cafe', target: 'message', label: 'left' },
  { id: 'e12', source: 'docks', target: 'shipping', label: 'loads' },
  { id: 'e13', source: 'shipping', target: 'shell', label: 'owns' },
  { id: 'e14', source: 'shell', target: 'union', label: 'contracts' },
  { id: 'e15', source: 'ledger', target: 'lender', label: 'pays' },
  { id: 'e16', source: 'suspect', target: 'partner', label: 'dated' },
];

const result = JSON.parse(
  execFileSync(process.execPath, [script], {
    input: JSON.stringify({
      nodes,
      edges,
      options: {
        archetype: 'investigation',
        mode: 'generate',
        seed: 53,
        padding: 48,
      },
    }),
    encoding: 'utf8',
  })
);

const quality = result.layout.quality;
assert.equal(result.nodes.length, 16);
assert.equal(result.edges.length, 16);
assert.equal(quality.nodeOverlaps, 0, 'compact cluster must not overlap cards');
assert.equal(quality.distanceOutliers, 0, 'neighbor distance must stay within 2.5 rest lengths');
assert.ok(quality.bounds.width < 1600, `width ${quality.bounds.width} must be < 1600`);
assert.ok(quality.bounds.height < 1600, `height ${quality.bounds.height} must be < 1600`);
assert.ok(
  quality.maxNeighborDistance < 900,
  `maxNeighborDistance ${quality.maxNeighborDistance} must be < 900`
);
assert.deepEqual(quality.compactnessRejects, [], 'compactnessRejects must be empty');
assert.equal(quality.edgeThroughNodes, 0, 'no string may cross an unrelated card');
assert.equal(quality.stringCrossings, 0, 'no strings may cross');
assert.equal(quality.labelCollisions, 0, 'no label may sit on a card');
assert.deepEqual(quality.unresolved, [], 'worked example must pass the full gate');

console.log('compactness tests passed');
console.log(
  JSON.stringify(
    {
      bounds: quality.bounds,
      meanNeighborDistance: quality.meanNeighborDistance,
      maxNeighborDistance: quality.maxNeighborDistance,
      compactnessRejects: quality.compactnessRejects,
      score: quality.score,
    },
    null,
    2
  )
);
