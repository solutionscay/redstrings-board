#!/usr/bin/env node

/**
 * Audit any Redstrings board dump (get_board, layout helper output, or a
 * { nodes, edges, options } document) using pin + quadratic sag geometry.
 */

import fs from 'node:fs';
import { auditStrings } from './string-geometry.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const options = input.options ?? {};
const sag =
  options.relationshipSag ??
  input.relationshipSag ??
  input.settings?.relationshipSag;
const padding = Number.isFinite(options.padding) ? options.padding : 6;

const result = auditStrings(input.nodes ?? [], input.edges ?? [], {
  relationshipSag: sag,
  padding,
});

const quality = {
  score: Number(
    Math.max(
      0,
      100 -
        result.nodeOverlaps * 25 -
        result.stringsThroughCards * 8 -
        (result.labelCollisions ?? 0) * 6
    ).toFixed(1)
  ),
  ...result,
};

process.stdout.write(JSON.stringify({ quality }, null, 2));
process.exit(result.unresolved.length ? 1 : 0);
