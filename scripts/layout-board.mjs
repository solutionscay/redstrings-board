#!/usr/bin/env node

import fs from 'node:fs';
import {
  auditStrings,
  endpointId,
  labelBox,
  labelSize,
  normalizeNode,
  normalizeSag,
  pathHitsNode,
  pinOf,
  sampleQuadratic,
  segmentsCross,
  LABEL_GUTTER,
  PIN_NEAR,
} from './string-geometry.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const options = input.options ?? {};
const seed = Number.isFinite(options.seed) ? options.seed : 1;
const padding = Math.max(40, options.padding ?? 48);
const iterations = Math.max(1, options.iterations ?? 80);
const mode = options.mode === 'arrange' ? 'arrange' : 'generate';
const archetype = options.archetype ?? 'relationship';
const freeformArchetypes = new Set(['investigation', 'research', 'relationship']);
const nodes = (input.nodes ?? []).map((node, index) => ({
  ...node,
  position: { ...(node.position ?? { x: 0, y: 0 }) },
  _index: index,
  _w: Math.max(80, node.size?.width ?? node.width ?? 220),
  _h: Math.max(60, node.size?.height ?? node.height ?? 140),
  _placed: false,
}));
const edges = input.edges ?? [];
const byId = new Map(nodes.map((node) => [node.id, node]));
const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
for (const edge of edges) {
  const source = endpointId(edge.source) || edge.source;
  const target = endpointId(edge.target) || edge.target;
  if (adjacency.has(source) && adjacency.has(target)) {
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  }
}

function edgesBetween(a, b) {
  return edges.filter((edge) => {
    const s = endpointId(edge.source) || edge.source;
    const t = endpointId(edge.target) || edge.target;
    return (s === a.id && t === b.id) || (s === b.id && t === a.id);
  });
}

function stableUnit(key) {
  let value = seed >>> 0;
  for (const character of String(key)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value / 0x100000000;
}

function setPosition(node, x, y) {
  node.position = { x: Math.round(x), y: Math.round(y) };
}

function point(node) {
  return { x: node.position.x + node._w / 2, y: node.position.y + node._h / 2 };
}

function pin(node) {
  return { x: node.position.x + node._w / 2, y: node.position.y };
}

function box(node, extra = padding) {
  return {
    left: node.position.x - extra,
    top: node.position.y - extra,
    right: node.position.x + node._w + extra,
    bottom: node.position.y + node._h + extra,
  };
}

function overlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0 && y > 0 ? { x, y } : null;
}

function sideRest(a, b) {
  return Math.max((a._w + b._w) / 2, (a._h + b._h) / 2) + padding;
}

function neighborLimit(a, b) {
  return 2.5 * sideRest(a, b);
}

// Eight compass slots plus shallow and steep diagonals. The extra angles
// matter because pins sit on the top edge: a 45 degree string often grazes
// the corner of whatever card sits directly above or below the anchor.
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [1, -0.5],
  [-1, -0.5],
  [1, 0.5],
  [-1, 0.5],
  [0.5, -1],
  [-0.5, -1],
  [0.5, 1],
  [-0.5, 1],
];

function collides(node, extra = padding / 2) {
  const mine = box(node, extra);
  return nodes.some((other) => other !== node && other._placed && overlap(mine, box(other, extra)));
}

function candidatePosition(parent, child, dirIndex, scale = 1) {
  const [dx, dy] = DIRS[dirIndex];
  const gapX = ((parent._w + child._w) / 2 + padding) * scale;
  const downHop = (parent._h + padding) * scale;
  const upHop = (child._h + padding) * scale;
  const horizontalMagnitude = 20 + stableUnit(`${child.id}:horizontal`) * 30;
  const verticalMagnitude = 30 + stableUnit(`${child.id}:vertical`) * 40;
  const origin = pin(parent);
  const signH = dirIndex % 2 === 0 ? -1 : 1;
  const signV = Math.floor(dirIndex / 2) % 2 === 0 ? -1 : 1;
  let x = origin.x - child._w / 2 + dx * gapX;
  let y;
  if (dy < 0) y = origin.y - upHop * Math.abs(dy);
  else if (dy > 0) y = origin.y + downHop * dy;
  else y = origin.y;
  if (dy === 0) {
    y = parent.position.y + (parent._h - child._h) / 2 + signV * verticalMagnitude;
  } else if (dx === 0) {
    x += signH * horizontalMagnitude;
  } else {
    x += signH * horizontalMagnitude * 0.35;
    y += signV * verticalMagnitude * 0.35;
  }
  return growForLabel(parent, child, { x, y }, dx, dy);
}

// Pins sit on the top edge, so a label can land inside an endpoint card even
// when the whitespace gap is respected. Push the child outward along the slot
// direction until every label between the pair clears both cards.
function growForLabel(parent, child, pos, dx, dy) {
  const pair = edgesBetween(parent, child);
  if (!pair.length || (dx === 0 && dy === 0)) return pos;
  const saved = { ...child.position };
  const norm = Math.hypot(dx, dy);
  const ux = dx / norm;
  const uy = dy / norm;
  let { x, y } = pos;
  for (let step = 0; step < 24; step += 1) {
    setPosition(child, x, y);
    const clear = pair.every((edge) => {
      const label = edgeLabelBox(edge, parent, child);
      return !overlap(label, nodeBox(parent)) && !overlap(label, nodeBox(child));
    });
    if (clear) break;
    x += ux * 12;
    y += uy * 12;
  }
  child.position = saved;
  return { x, y };
}

function edgeEnds(edge) {
  return {
    a: byId.get(endpointId(edge.source) || edge.source),
    b: byId.get(endpointId(edge.target) || edge.target),
  };
}

function pathsCross(p, q) {
  const shared = [p.a, p.b].filter((node) => node === q.a || node === q.b);
  for (let i = 0; i < p.points.length - 1; i += 1) {
    for (let j = 0; j < q.points.length - 1; j += 1) {
      if (!segmentsCross(p.points[i], p.points[i + 1], q.points[j], q.points[j + 1])) continue;
      const mid = {
        x: (p.points[i].x + p.points[i + 1].x) / 2,
        y: (p.points[i].y + p.points[i + 1].y) / 2,
      };
      const nearShared = shared.some((node) => {
        const pinPoint = pinOf(normalizeNode(node));
        return Math.hypot(mid.x - pinPoint.x, mid.y - pinPoint.y) < PIN_NEAR;
      });
      if (!nearShared) return true;
    }
  }
  return false;
}

// Count the defects that involve one card at its current position: its
// strings through other cards, its labels on any card, its strings crossing
// other strings, and other cards' strings through it. Only placed cards count.
function localDefects(node) {
  const sag = normalizeSag(options.relationshipSag);
  const live = (other) => other === node || other._placed;
  const paths = [];
  for (const edge of edges) {
    const { a, b } = edgeEnds(edge);
    if (!a || !b || a === b || !live(a) || !live(b)) continue;
    paths.push({
      a,
      b,
      edge,
      points: sampleQuadratic(pinOf(normalizeNode(a)), pinOf(normalizeNode(b)), sag).points,
    });
  }
  const mine = paths.filter((path) => path.a === node || path.b === node);
  const theirs = paths.filter((path) => path.a !== node && path.b !== node);
  const nodeNorm = normalizeNode(node);
  let defects = 0;
  for (const path of mine) {
    for (const other of nodes) {
      if (!live(other) || other === path.a || other === path.b) continue;
      if (pathHitsNode(path.points, normalizeNode(other), 6)) defects += 1;
    }
    const label = edgeLabelBox(path.edge, path.a, path.b);
    for (const other of nodes) {
      if (live(other) && overlap(label, nodeBox(other))) defects += 1;
    }
    for (const other of theirs) {
      if (pathsCross(path, other)) defects += 1;
    }
  }
  for (const other of theirs) {
    if (pathHitsNode(other.points, nodeNorm, 6)) defects += 1;
  }
  return defects;
}

function stringPenaltyAt(child, pos) {
  const saved = { ...child.position };
  setPosition(child, pos.x, pos.y);
  const defects = localDefects(child);
  child.position = saved;
  return defects * 40000;
}

function tryPlaceNear(parent, child, dirIndex, scale = 1) {
  const { x, y } = candidatePosition(parent, child, dirIndex, scale);
  setPosition(child, x, y);
  if (collides(child)) return false;
  child._placed = true;
  return true;
}

function boundsWith(child, position) {
  let minX = position.x;
  let minY = position.y;
  let maxX = position.x + child._w;
  let maxY = position.y + child._h;
  for (const node of nodes) {
    if (!node._placed) continue;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node._w);
    maxY = Math.max(maxY, node.position.y + node._h);
  }
  return { width: maxX - minX, height: maxY - minY };
}

function evaluateSlots(parent, child, ring = 0) {
  const scales = [1 + ring * 0.32, 1.14 + ring * 0.32, 1.28 + ring * 0.32];
  const kin = nodes.filter(
    (node) => node._placed && node !== child && child.group && node.group === child.group
  );
  const extraNeighbors = [...(adjacency.get(child.id) ?? [])]
    .map((id) => byId.get(id))
    .filter((node) => node && node._placed && node !== parent && node !== child);
  let best = null;
  for (let scaleIndex = 0; scaleIndex < scales.length; scaleIndex += 1) {
    const scale = scales[scaleIndex];
    for (let dir = 0; dir < DIRS.length; dir += 1) {
      const pos = candidatePosition(parent, child, dir, scale);
      const saved = { ...child.position };
      setPosition(child, pos.x, pos.y);
      const blocked = collides(child);
      child.position = saved;
      if (blocked) continue;
      const hard = stringPenaltyAt(child, pos);
      const bounds = boundsWith(child, pos);
      const span = bounds.width + bounds.height;
      const spread = Math.max(bounds.width, bounds.height);
      const center = { x: pos.x + child._w / 2, y: pos.y + child._h / 2 };
      let neighborPenalty = 0;
      for (const other of extraNeighbors) {
        const dist = Math.hypot(center.x - point(other).x, center.y - point(other).y);
        const rest = sideRest(child, other);
        if (dist > rest * 2.5) neighborPenalty += 140000 + (dist - rest * 2.5) * 90;
        else neighborPenalty += Math.abs(dist - rest) * 8;
      }
      let groupPenalty = 0;
      if (kin.length) {
        const nearest = Math.min(
          ...kin.map((node) => Math.hypot(center.x - point(node).x, center.y - point(node).y))
        );
        groupPenalty = nearest * 4;
      }
      const score =
        span * 220 +
        spread * 90 +
        scaleIndex * 14000 +
        dir * 2 +
        groupPenalty +
        neighborPenalty +
        hard;
      if (!best || score < best.score) best = { pos, score, hard };
    }
    if (best && best.hard === 0) break;
  }
  return best;
}

function placeAround(parent, child, used, preferHorizontal = false) {
  const ring = Math.floor(used / DIRS.length);
  if (preferHorizontal) {
    for (const dir of [0, 1]) {
      const pos = candidatePosition(parent, child, dir, 1);
      setPosition(child, pos.x, pos.y);
      if (!collides(child) && stringPenaltyAt(child, pos) === 0) {
        child._placed = true;
        return true;
      }
    }
  }
  const best = evaluateSlots(parent, child, ring);
  if (!best) return searchNear(parent, child, ring);
  setPosition(child, best.pos.x, best.pos.y);
  child._placed = true;
  return true;
}

// Move a card that blocks someone else's string to a clean slot around one of
// its own neighbors.
function reseatBlocker(blocker) {
  const anchors = [...(adjacency.get(blocker.id) ?? [])]
    .map((id) => byId.get(id))
    .filter((node) => node && node._placed);
  return anchors.some((anchor) => reseat(anchor, blocker));
}

// Move one endpoint of a bad string to the best clean slot around the other.
function reseat(anchor, movable) {
  if (movable.focal) return false;
  const saved = { ...movable.position };
  movable._placed = false;
  let best = null;
  for (let ring = 0; ring < 3 && !best; ring += 1) {
    const candidate = evaluateSlots(anchor, movable, ring);
    if (candidate && candidate.hard === 0) best = candidate;
  }
  movable._placed = true;
  if (best) {
    setPosition(movable, best.pos.x, best.pos.y);
    return true;
  }
  movable.position = saved;
  return false;
}

// Re-seat one endpoint of every remaining bad string, crossing, or label hit.
function finalPass() {
  for (let pass = 0; pass < 12; pass += 1) {
    const audit = auditStrings(nodes, edges, { relationshipSag: options.relationshipSag, padding: 6 });
    const byEdgeId = new Map(edges.map((edge) => [edge.id, edge]));
    const pairs = [];
    const pushPath = (pathId) => {
      const edge = byEdgeId.get(String(pathId).split(':')[0]);
      if (!edge) return;
      const { a, b } = edgeEnds(edge);
      if (a && b) pairs.push([a, b]);
    };
    const blockers = [];
    for (const hit of audit.hits) {
      pushPath(hit.path);
      const blocker = byId.get(hit.card);
      if (blocker) blockers.push(blocker);
    }
    for (const crossing of audit.crossings) {
      pushPath(crossing.a);
      pushPath(crossing.b);
    }
    for (const hit of audit.labelHits) pushPath(hit.path);
    if (!pairs.length) break;
    let moved = false;
    for (const [a, b] of pairs) {
      const first = (adjacency.get(a.id)?.size ?? 0) <= (adjacency.get(b.id)?.size ?? 0) ? a : b;
      const second = first === a ? b : a;
      if (reseat(second, first) || reseat(first, second)) {
        moved = true;
        break;
      }
    }
    if (!moved) {
      for (const blocker of blockers) {
        if (reseatBlocker(blocker)) {
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
    repairOverlaps();
  }
}

// Pull every card toward the focal card while its local defects do not grow.
function squeeze() {
  const focal = pickFocal();
  if (!focal) return;
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    const target = point(focal);
    const order = nodes
      .filter((node) => node !== focal)
      .sort((a, b) => {
        const da = Math.hypot(point(a).x - target.x, point(a).y - target.y);
        const db = Math.hypot(point(b).x - target.x, point(b).y - target.y);
        return db - da || a._index - b._index;
      });
    for (const node of order) {
      const allowed = localDefects(node);
      for (let step = 0; step < 12; step += 1) {
        const center = point(node);
        const dx = target.x - center.x;
        const dy = target.y - center.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) break;
        const old = { ...node.position };
        setPosition(node, node.position.x + (dx / dist) * 12, node.position.y + (dy / dist) * 12);
        if (collides(node, padding / 2) || localDefects(node) > allowed) {
          node.position = old;
          break;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function searchNear(parent, child, ring = 0) {
  const startDir = Math.floor(stableUnit(`${parent.id}:${child.id}:dir`) * DIRS.length);
  const scales = [1 + ring * 0.4, 1.18 + ring * 0.4, 1.36 + ring * 0.4];
  for (const scale of scales) {
    for (let offset = 0; offset < DIRS.length; offset += 1) {
      if (tryPlaceNear(parent, child, (startDir + offset) % DIRS.length, scale)) {
        return true;
      }
    }
  }
  const origin = point(parent);
  const rest = sideRest(parent, child) * (1 + ring * 0.45);
  for (let step = 0; step < 16; step += 1) {
    const angle = (step / 8) * Math.PI * 2 - Math.PI / 2 + ring * 0.2;
    const radius = rest * (1 + Math.floor(step / 8) * 0.3);
    setPosition(
      child,
      origin.x - child._w / 2 + Math.cos(angle) * radius,
      origin.y - child._h / 2 + Math.sin(angle) * radius
    );
    if (!collides(child)) {
      child._placed = true;
      return true;
    }
  }
  return false;
}

function pickFocal() {
  const flagged = nodes.filter((node) => node.focal);
  if (flagged.length) return flagged[0];
  return [...nodes].sort(
    (a, b) =>
      (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0) ||
      (b.data?.tags?.length ?? 0) - (a.data?.tags?.length ?? 0) ||
      a._index - b._index
  )[0];
}

function layoutAligned() {
  if (archetype === 'timeline' || archetype === 'process') {
    const ordered = [...nodes].sort(
      (a, b) =>
        String(a.date ?? a.data?.date ?? a.name ?? '').localeCompare(
          String(b.date ?? b.data?.date ?? b.name ?? '')
        ) || a._index - b._index
    );
    const band = Math.max(...nodes.map((node) => node._h)) + padding;
    ordered.forEach((node, index) => {
      setPosition(node, index * (node._w + padding), (index % 2) * band);
      node._placed = true;
    });
    return;
  }
  if (archetype === 'hierarchy') {
    const focal = pickFocal();
    const focalId = focal?.id;
    const depth = new Map([[focalId, 0]]);
    const queue = focalId ? [focalId] : [];
    while (queue.length) {
      const current = queue.shift();
      for (const next of adjacency.get(current) ?? []) {
        if (!depth.has(next)) {
          depth.set(next, depth.get(current) + 1);
          queue.push(next);
        }
      }
    }
    const layers = new Map();
    nodes.forEach((node) => {
      const d = depth.get(node.id) ?? 0;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d).push(node);
    });
    [...layers.entries()].forEach(([d, layer]) => {
      const widths = layer.map((node) => node._w + padding);
      const total = widths.reduce((sum, w) => sum + w, 0);
      let cursor = -total / 2;
      layer.forEach((node, index) => {
        setPosition(node, cursor, d * (node._h + padding));
        cursor += widths[index];
        node._placed = true;
      });
    });
  }
}

function layoutCompact() {
  if (!nodes.length) return;
  const focal = pickFocal();
  setPosition(focal, 0, 0);
  focal._placed = true;
  const childCount = new Map(nodes.map((node) => [node.id, 0]));
  const queue = [focal.id];
  const seen = new Set([focal.id]);
  while (queue.length) {
    const currentId = queue.shift();
    const parent = byId.get(currentId);
    const neighbors = [...(adjacency.get(currentId) ?? [])].sort((a, b) => {
      const na = byId.get(a);
      const nb = byId.get(b);
      return String(na.group ?? '').localeCompare(String(nb.group ?? '')) || na._index - nb._index;
    });
    for (const nextId of neighbors) {
      if (seen.has(nextId)) continue;
      seen.add(nextId);
      const child = byId.get(nextId);
      const used = childCount.get(currentId);
      const preferHorizontal = Boolean(parent.focal) && used === 0;
      placeAround(parent, child, used, preferHorizontal);
      if (!child._placed) {
        setPosition(child, parent.position.x + parent._w + padding, parent.position.y);
        child._placed = true;
      }
      childCount.set(currentId, used + 1);
      queue.push(nextId);
    }
  }
  for (const node of nodes) {
    if (node._placed) continue;
    const kin =
      nodes.find((other) => other._placed && other.group && other.group === node.group) ?? focal;
    if (!searchNear(kin, node)) {
      setPosition(node, kin.position.x + kin._w + padding, kin.position.y);
      node._placed = true;
    }
  }
}

function layoutInitial() {
  if (!nodes.length) return;
  if (!freeformArchetypes.has(archetype)) {
    layoutAligned();
    return;
  }
  layoutCompact();
}

function repairOverlaps() {
  let repairs = 0;
  for (let pass = 0; pass < iterations; pass += 1) {
    let changed = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const hit = overlap(box(a, padding / 2), box(b, padding / 2));
        if (!hit) continue;
        const ac = point(a);
        const bc = point(b);
        const aShare = a.focal && !b.focal ? 0 : b.focal && !a.focal ? 1 : 0.5;
        const bShare = 1 - aShare;
        if (hit.x < hit.y) {
          const direction = ac.x <= bc.x ? -1 : 1;
          const amount = hit.x + 2;
          a.position.x += direction * amount * aShare;
          b.position.x -= direction * amount * bShare;
        } else {
          const direction = ac.y <= bc.y ? -1 : 1;
          const amount = hit.y + 2;
          a.position.y += direction * amount * aShare;
          b.position.y -= direction * amount * bShare;
        }
        changed = true;
        repairs += 1;
      }
    }
    if (!changed) break;
  }
  return repairs;
}

function aabbGap(a, b) {
  const pa = point(a);
  const pb = point(b);
  const gx = Math.abs(pb.x - pa.x) - (a._w + b._w) / 2;
  const gy = Math.abs(pb.y - pa.y) - (a._h + b._h) / 2;
  if (gx >= 0 && gy >= 0) return Math.hypot(gx, gy);
  if (gx >= 0) return gx;
  if (gy >= 0) return gy;
  return Math.min(gx, gy);
}

function attractNeighbors() {
  for (let pass = 0; pass < iterations; pass += 1) {
    let moved = false;
    for (const edge of edges) {
      const a = byId.get(endpointId(edge.source) || edge.source);
      const b = byId.get(endpointId(edge.target) || edge.target);
      if (!a || !b) continue;
      const pa = point(a);
      const pb = point(b);
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const rest = sideRest(a, b);
      const gap = aabbGap(a, b);
      const size = labelSize(edge.label);
      const dx = point(b).x - point(a).x;
      const dy = point(b).y - point(a).y;
      const labelNeed = Math.abs(dx) >= Math.abs(dy) ? size.width + LABEL_GUTTER : size.height + LABEL_GUTTER;
      if (gap >= 0 && gap <= Math.max(padding * 1.45, labelNeed)) continue;
      if (dist <= rest * 1.55 || dist === 0) continue;
      const pull = Math.min(48, (dist - rest * 1.2) * 0.3);
      const ux = (pb.x - pa.x) / dist;
      const uy = (pb.y - pa.y) / dist;
      const aShare = a.focal && !b.focal ? 0 : b.focal && !a.focal ? 1 : 0.5;
      const aPos = { ...a.position };
      const bPos = { ...b.position };
      a.position.x += ux * pull * aShare;
      a.position.y += uy * pull * aShare;
      b.position.x -= ux * pull * (1 - aShare);
      b.position.y -= uy * pull * (1 - aShare);
      if (collides(a, padding / 2) || collides(b, padding / 2)) {
        a.position = aPos;
        b.position = bPos;
        continue;
      }
      moved = true;
    }
    if (!moved) break;
    repairOverlaps();
  }
}

function relocateOutliers() {
  for (const edge of edges) {
    const a = byId.get(endpointId(edge.source) || edge.source);
    const b = byId.get(endpointId(edge.target) || edge.target);
    if (!a || !b) continue;
    const dist = Math.hypot(point(a).x - point(b).x, point(a).y - point(b).y);
    if (dist <= neighborLimit(a, b)) continue;
    const movable = a.focal && !b.focal ? b : b.focal && !a.focal ? a : (adjacency.get(a.id)?.size ?? 0) <= (adjacency.get(b.id)?.size ?? 0) ? a : b;
    const anchor = movable === a ? b : a;
    const saved = { ...movable.position };
    let best = null;
    for (let scaleIndex = 0; scaleIndex < 3; scaleIndex += 1) {
      const scale = 1 + scaleIndex * 0.16;
      for (let dir = 0; dir < DIRS.length; dir += 1) {
        const pos = candidatePosition(anchor, movable, dir, scale);
        movable.position = { x: pos.x, y: pos.y };
        if (collides(movable, padding / 2)) continue;
        const next = Math.hypot(point(movable).x - point(anchor).x, point(movable).y - point(anchor).y);
        if (next > neighborLimit(movable, anchor)) continue;
        const bounds = boundsWith(movable, pos);
        const score = bounds.width + bounds.height + scaleIndex * 80 + dir;
        if (!best || score < best.score) best = { pos, score };
      }
      if (best) break;
    }
    if (best) setPosition(movable, best.pos.x, best.pos.y);
    else movable.position = saved;
  }
  repairOverlaps();
}

function nudge(node, dx, dy) {
  const old = { ...node.position };
  node.position.x += dx;
  node.position.y += dy;
  if (collides(node, padding / 2)) {
    node.position = old;
    return false;
  }
  return true;
}

function moveTo(node, x, y) {
  const old = { ...node.position };
  setPosition(node, x, y);
  if (collides(node, padding / 2)) {
    node.position = old;
    return false;
  }
  return true;
}

function rotateChild(source, target, radians, grow = 1) {
  const origin = pin(source);
  const current = pin(target);
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const dist = Math.hypot(dx, dy) * grow;
  const angle = Math.atan2(dy, dx) + radians;
  const x = origin.x + Math.cos(angle) * dist - target._w / 2;
  const y = origin.y + Math.sin(angle) * dist;
  return moveTo(target, x, y);
}

function clearStringHits() {
  for (let pass = 0; pass < 8; pass += 1) {
    const audit = auditStrings(nodes, edges, {
      relationshipSag: options.relationshipSag,
      padding: 6,
    });
    if (!audit.hits.length) break;
    let moved = false;
    for (const hit of audit.hits) {
      const blocker = byId.get(hit.card);
      const source = byId.get(hit.source);
      const target = byId.get(hit.target);
      if (!blocker || !source || !target) continue;
      const a = pin(source);
      const b = pin(target);
      const c = point(blocker);
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const elen = Math.hypot(ex, ey) || 1;
      const nx = -ey / elen;
      const ny = ex / elen;
      const side = (c.x - a.x) * nx + (c.y - a.y) * ny >= 0 ? 1 : -1;
      if (nudge(blocker, nx * side * 24, ny * side * 24)) moved = true;
      else if (rotateChild(source, target, -side * 0.22, 1.04)) moved = true;
      else if (rotateChild(source, target, -side * 0.38, 1.08)) moved = true;
      else if (nudge(blocker, nx * side * 40, ny * side * 40)) moved = true;
      else if (reseat(source, target) || reseat(target, source)) moved = true;
      else if (reseatBlocker(blocker)) moved = true;
    }
    if (!moved) break;
    repairOverlaps();
  }
}

function nodeBox(node) {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + node._w,
    bottom: node.position.y + node._h,
  };
}

function edgeLabelBox(edge, source, target) {
  return labelBox(edge, source, target, options.relationshipSag);
}

function openLabelGutters() {
  const step = 16;
  const maxSteps = 20;
  for (let pass = 0; pass < 10; pass += 1) {
    let moved = false;
    for (const edge of edges) {
      const a = byId.get(endpointId(edge.source) || edge.source);
      const b = byId.get(endpointId(edge.target) || edge.target);
      if (!a || !b) continue;
      const hitsEndpoint = () => {
        const label = edgeLabelBox(edge, a, b);
        return overlap(label, nodeBox(a)) || overlap(label, nodeBox(b));
      };
      if (!hitsEndpoint()) continue;
      const pa = point(a);
      const pb = point(b);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const dir = horizontal ? (dx >= 0 ? 1 : -1) : dy >= 0 ? 1 : -1;
      const aShare = a.focal && !b.focal ? 0 : b.focal && !a.focal ? 1 : 0.5;
      const savedA = { ...a.position };
      const savedB = { ...b.position };
      const shares = a.focal ? [[0, 1]] : b.focal ? [[1, 0]] : [[aShare, 1 - aShare], [0, 1], [1, 0]];
      let cleared = false;
      for (const [sa, sb] of shares) {
        for (const size of [step, step / 2, step / 4]) {
          a.position = { ...savedA };
          b.position = { ...savedB };
          for (let count = 0; count < maxSteps && !cleared; count += 1) {
            const beforeA = { ...a.position };
            const beforeB = { ...b.position };
            if (horizontal) {
              a.position.x -= dir * size * sa;
              b.position.x += dir * size * sb;
            } else {
              a.position.y -= dir * size * sa;
              b.position.y += dir * size * sb;
            }
            if (collides(a, padding / 2) || collides(b, padding / 2)) {
              a.position = beforeA;
              b.position = beforeB;
              break;
            }
            if (!hitsEndpoint()) cleared = true;
          }
          if (cleared) break;
        }
        if (cleared) break;
      }
      if (!cleared) {
        a.position = savedA;
        b.position = savedB;
        continue;
      }
      moved = true;
    }
    if (!moved) break;
    repairOverlaps();
  }
}

function clearLabelCollisions() {
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (const edge of edges) {
      const source = byId.get(endpointId(edge.source) || edge.source);
      const target = byId.get(endpointId(edge.target) || edge.target);
      if (!source || !target) continue;
      const label = edgeLabelBox(edge, source, target);
      for (const node of nodes) {
        if (node.id === source.id || node.id === target.id) continue;
        if (!overlap(label, nodeBox(node))) continue;
        const a = point(source);
        const b = point(target);
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const elen = Math.hypot(ex, ey) || 1;
        const nx = -ey / elen;
        const ny = ex / elen;
        const c = point(node);
        const side = (c.x - a.x) * nx + (c.y - a.y) * ny >= 0 ? 1 : -1;
        if (nudge(node, nx * side * 20, ny * side * 20)) moved = true;
        else if (rotateChild(source, target, -side * 0.16, 1.03)) moved = true;
        else if (reseat(source, target) || reseat(target, source)) moved = true;
      }
    }
    if (!moved) break;
    repairOverlaps();
  }
}

function maximumAligned(axis, tolerance = 12) {
  const coordinates = nodes.map((node) => node.position[axis]).sort((a, b) => a - b);
  let maximum = coordinates.length ? 1 : 0;
  let start = 0;
  for (let end = 0; end < coordinates.length; end += 1) {
    while (coordinates[end] - coordinates[start] > tolerance) start += 1;
    maximum = Math.max(maximum, end - start + 1);
  }
  return maximum;
}

function metrics() {
  let nodeOverlaps = 0;
  let maxOverlap = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const hit = overlap(box(nodes[i], 0), box(nodes[j], 0));
      if (hit) {
        nodeOverlaps += 1;
        maxOverlap = Math.max(maxOverlap, hit.x * hit.y);
      }
    }
  }
  const validEdges = edges
    .map((edge) => ({
      edge,
      source: byId.get(endpointId(edge.source) || edge.source),
      target: byId.get(endpointId(edge.target) || edge.target),
    }))
    .filter((item) => item.source && item.target);
  let labelCollisions = 0;
  const neighborDistances = [];
  let distanceOutliers = 0;
  for (const first of validEdges) {
    const a = point(first.source);
    const b = point(first.target);
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    neighborDistances.push(dist);
    if (dist > neighborLimit(first.source, first.target)) distanceOutliers += 1;
    const label = edgeLabelBox(first.edge, first.source, first.target);
    if (nodes.some((node) => overlap(label, nodeBox(node)))) {
      labelCollisions += 1;
    }
  }
  const stringAudit = auditStrings(nodes, edges, {
    relationshipSag: options.relationshipSag,
    padding: 6,
  });
  const maxSharedX = maximumAligned('x');
  const maxSharedY = maximumAligned('y');
  const excessiveAlignment = freeformArchetypes.has(archetype)
    ? Math.max(0, maxSharedX - 3) + Math.max(0, maxSharedY - 3)
    : 0;
  const minX = nodes.length ? Math.min(...nodes.map((node) => node.position.x)) - padding : 0;
  const minY = nodes.length ? Math.min(...nodes.map((node) => node.position.y)) - padding : 0;
  const maxX = nodes.length ? Math.max(...nodes.map((node) => node.position.x + node._w)) + padding : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((node) => node.position.y + node._h)) + padding : 0;
  const bounds = {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
  const aspectRatio = bounds.height ? Number((bounds.width / bounds.height).toFixed(2)) : 1;
  const directionalImbalance =
    freeformArchetypes.has(archetype) && nodes.length >= 4 && (aspectRatio < 0.65 || aspectRatio > 1.85);
  const meanNeighborDistance = neighborDistances.length
    ? Number(
        (neighborDistances.reduce((sum, value) => sum + value, 0) / neighborDistances.length).toFixed(1)
      )
    : 0;
  const maxNeighborDistance = neighborDistances.length ? Number(Math.max(...neighborDistances).toFixed(1)) : 0;
  const clusterArea = Math.max(1, bounds.width * bounds.height);
  const cardArea = nodes.reduce((sum, node) => sum + node._w * node._h, 0);
  const compactnessRejects = [];
  if (distanceOutliers) compactnessRejects.push(`${distanceOutliers} neighbor distance outlier(s)`);
  if (freeformArchetypes.has(archetype) && nodes.length >= 4 && (bounds.width > 1600 || bounds.height > 1600)) {
    compactnessRejects.push('board bounding box exceeds one desktop viewport');
  }
  const unresolved = [];
  if (nodeOverlaps) unresolved.push(`${nodeOverlaps} node overlap(s)`);
  if (stringAudit.edgeThroughNodes) unresolved.push(`${stringAudit.edgeThroughNodes} string path(s) cross unrelated cards`);
  if (stringAudit.stringCrossings) unresolved.push(`${stringAudit.stringCrossings} string crossing(s)`);
  if (labelCollisions) unresolved.push(`${labelCollisions} edge label collision(s)`);
  if (excessiveAlignment) unresolved.push('freeform cards retain excessive shared alignment');
  if (directionalImbalance) unresolved.push('freeform layout does not use both canvas axes');
  unresolved.push(...compactnessRejects);
  const score = Math.max(
    0,
    100 -
      nodeOverlaps * 25 -
      stringAudit.edgeThroughNodes * 8 -
      stringAudit.stringCrossings * 4 -
      labelCollisions * 6 -
      distanceOutliers * 8 -
      excessiveAlignment * 3 -
      compactnessRejects.length * 10 -
      (directionalImbalance ? 8 : 0)
  );
  return {
    score: Number(score.toFixed(1)),
    nodeOverlaps,
    maxOverlap,
    edgeCrossings: stringAudit.stringCrossings,
    edgeThroughNodes: stringAudit.stringsThroughCards,
    stringsThroughCards: stringAudit.stringsThroughCards,
    stringCrossings: stringAudit.stringCrossings,
    labelCollisions,
    labelHits: stringAudit.labelHits ?? [],
    distanceOutliers,
    meanNeighborDistance,
    maxNeighborDistance,
    clusterBounds: bounds,
    compactnessRejects,
    maxSharedX,
    maxSharedY,
    aspectRatio,
    cardArea,
    clusterArea,
    unresolved,
    bounds,
  };
}

layoutInitial();
const repairs = repairOverlaps();
if (freeformArchetypes.has(archetype)) {
  attractNeighbors();
  relocateOutliers();
  clearStringHits();
  openLabelGutters();
  clearStringHits();
  clearLabelCollisions();
  finalPass();
  squeeze();
  finalPass();
}
nodes.forEach((node) => setPosition(node, node.position.x, node.position.y));
const quality = metrics();
const outputNodes = nodes.map(({ _index, _w, _h, _placed, ...node }) => node);
const groups = [...new Set(nodes.map((node) => node.group).filter(Boolean))];
const focalNodeIds = nodes.filter((node) => node.focal).map((node) => node.id);
process.stdout.write(
  JSON.stringify(
    {
      nodes: outputNodes,
      edges: input.edges ?? [],
      layout: {
        archetype,
        mode,
        seed,
        repairs,
        groups,
        focalNodeIds,
        bounds: quality.bounds,
        quality,
      },
    },
    null,
    2
  )
);
