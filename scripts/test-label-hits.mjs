#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const audit = join(dirname(fileURLToPath(import.meta.url)), 'audit-strings.mjs');
const layout = join(dirname(fileURLToPath(import.meta.url)), 'layout-board.mjs');

function run(script, payload) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      input: JSON.stringify(payload),
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

const crowded = run(audit, {
  nodes: [
    { id: 'homepage', position: { x: 548, y: 360 }, size: { width: 208, height: 350 } },
    { id: 'issue-13', position: { x: 800, y: 390 }, size: { width: 208, height: 314 } },
  ],
  edges: [
    {
      id: 'e-13-homepage',
      source: 'issue-13',
      target: 'homepage',
      label: 'Phase 1 already shipped',
    },
  ],
  options: { relationshipSag: 50 },
});
assert.equal(crowded.ok, false);
assert.ok(crowded.report.quality.labelCollisions >= 1);
assert.ok(
  crowded.report.quality.labelHits.some(
    (hit) => hit.card === 'homepage' && hit.role === 'endpoint'
  )
);
assert.ok(
  crowded.report.quality.labelHits.some(
    (hit) => hit.card === 'issue-13' && hit.role === 'endpoint'
  )
);

const shortHop = run(audit, {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, size: { width: 208, height: 140 } },
    { id: 'b', position: { x: 400, y: 0 }, size: { width: 208, height: 140 } },
  ],
  edges: [{ id: 'ab', source: 'a', target: 'b', label: 'proves' }],
  options: { relationshipSag: 50 },
});
assert.equal(shortHop.ok, true);
assert.equal(shortHop.report.quality.labelCollisions, 0);

const packed = run(layout, {
  nodes: [
    {
      id: 'homepage',
      name: 'Homepage copy',
      position: { x: 548, y: 360 },
      size: { width: 208, height: 350 },
      focal: true,
    },
    {
      id: 'issue-13',
      name: 'redstrings-web#13',
      position: { x: 800, y: 390 },
      size: { width: 208, height: 314 },
    },
  ],
  edges: [
    {
      id: 'e-13-homepage',
      source: 'issue-13',
      target: 'homepage',
      label: 'Phase 1 already shipped',
    },
  ],
  options: { archetype: 'relationship', seed: 7, iterations: 80, padding: 48 },
});
assert.equal(packed.report.layout.quality.labelCollisions, 0);
assert.equal(packed.report.layout.quality.nodeOverlaps, 0);
const home = packed.report.nodes.find((node) => node.id === 'homepage');
const issue = packed.report.nodes.find((node) => node.id === 'issue-13');
const left = Math.min(home.position.x + 208, issue.position.x + 208);
const right = Math.max(home.position.x, issue.position.x);
assert.ok(right - left >= 200);

console.log('label-hit tests passed');
