/** Pin-and-sag path geometry for any Redstrings board. */

export const DEFAULT_RELATIONSHIP_SAG = 50;
export const SAMPLE_COUNT = 28;
export const PIN_NEAR = 70;

export function normalizeSag(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RELATIONSHIP_SAG;
  }
  return Math.max(0, Math.min(200, Math.round(value)));
}

export function endpointId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.id === 'string') {
    return value.id;
  }
  return '';
}

export function normalizeNode(node) {
  return {
    id: node.id,
    _w: Math.max(80, node.size?.width ?? node.width ?? node._w ?? 220),
    _h: Math.max(60, node.size?.height ?? node.height ?? node._h ?? 140),
    _x: node.position?.x ?? node._x ?? 0,
    _y: node.position?.y ?? node._y ?? 0,
    _pinOffset: Number.isFinite(node.pinOffset) ? node.pinOffset : 0,
  };
}

export function pinOf(node) {
  return {
    x: node._x + node._w / 2 + node._pinOffset * node._w,
    y: node._y,
  };
}

export function nodeRect(node, extra = 0) {
  return {
    left: node._x - extra,
    top: node._y - extra,
    right: node._x + node._w + extra,
    bottom: node._y + node._h + extra,
  };
}

function sagOffset(distance, sag, kind = 'natural') {
  const length = Math.max(0, distance);
  const legacy =
    kind === 'natural'
      ? Math.max(5, Math.min(length * 0.03, 25))
      : Math.max(3, Math.min(length * 0.02, 15));
  return legacy * (sag / DEFAULT_RELATIONSHIP_SAG);
}

export function sampleQuadratic(p0, p2, sag, kind = 'natural') {
  const distance = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const p1 = {
    x: (p0.x + p2.x) / 2,
    y: (p0.y + p2.y) / 2 + sagOffset(distance, sag, kind),
  };
  const points = [];
  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const t = index / SAMPLE_COUNT;
    const mt = 1 - t;
    points.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return { points, mid: points[Math.floor(points.length / 2)] };
}

function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, p, b) {
  return (
    p.x >= Math.min(a.x, b.x) - 0.5 &&
    p.x <= Math.max(a.x, b.x) + 0.5 &&
    p.y >= Math.min(a.y, b.y) - 0.5 &&
    p.y <= Math.max(a.y, b.y) + 0.5
  );
}

export function segmentsCross(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return (
    (Math.abs(o1) < 1e-6 && onSegment(a, c, b)) ||
    (Math.abs(o2) < 1e-6 && onSegment(a, d, b)) ||
    (Math.abs(o3) < 1e-6 && onSegment(c, a, d)) ||
    (Math.abs(o4) < 1e-6 && onSegment(c, b, d))
  );
}

function pointInRect(point, box) {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
}

function segmentHitsRect(a, b, box) {
  if (pointInRect(a, box) || pointInRect(b, box)) return true;
  const corners = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.right, y: box.bottom },
    { x: box.left, y: box.bottom },
  ];
  return corners.some((corner, index) =>
    segmentsCross(a, b, corner, corners[(index + 1) % 4])
  );
}

function boxesOverlap(a, b) {
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  );
}

function pathHitsNode(points, node, padding) {
  const box = nodeRect(node, padding);
  for (let index = 0; index < points.length - 1; index += 1) {
    if (segmentHitsRect(points[index], points[index + 1], box)) return true;
  }
  return false;
}

function extraTargetIds(edge) {
  const extras = edge.data?.extraTargets ?? edge.extraTargets ?? [];
  return extras.filter((id) => typeof id === 'string');
}


export const LABEL_CHAR_PX = 8;
export const LABEL_PAD_X = 20;
export const LABEL_HEIGHT = 28;
export const LABEL_MIN_WIDTH = 48;
export const LABEL_MAX_WIDTH = 240;
export const LABEL_GUTTER = 0;

export function labelSize(text) {
  const width = Math.max(
    LABEL_MIN_WIDTH,
    Math.min(LABEL_MAX_WIDTH, String(text ?? "relates to").length * LABEL_CHAR_PX + LABEL_PAD_X)
  );
  return { width, height: LABEL_HEIGHT };
}

export function labelBox(edge, source, target, sag) {
  const src = normalizeNode(source);
  const dst = normalizeNode(target);
  const size = labelSize(edge?.label);
  const override = edge?.data?.labelPosition ?? edge?.labelPosition;
  let mid;
  if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
    mid = { x: override.x, y: override.y };
  } else {
    mid = sampleQuadratic(pinOf(src), pinOf(dst), normalizeSag(sag)).mid;
  }
  return {
    left: mid.x - size.width / 2,
    right: mid.x + size.width / 2,
    top: mid.y - size.height / 2,
    bottom: mid.y + size.height / 2,
    width: size.width,
    height: size.height,
    mid,
  };
}

/**
 * Audit any node/edge list. Nodes may use size/position or _w/_h internals.
 * Edges may use string ids or { kind, id } endpoints, plus extraTargets.
 */
export function auditStrings(rawNodes, rawEdges, options = {}) {
  const sag = normalizeSag(options.relationshipSag);
  const padding = Number.isFinite(options.padding) ? options.padding : 6;
  const nodes = (rawNodes ?? []).map(normalizeNode);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = rawEdges ?? [];

  const paths = [];
  for (const edge of edges) {
    const sourceId = endpointId(edge.source);
    const targetId = endpointId(edge.target);
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target) continue;
    const extras = extraTargetIds(edge).filter((id) => byId.has(id));
    const main = sampleQuadratic(pinOf(source), pinOf(target), sag);
    const ends = new Set([sourceId, targetId]);
    paths.push({
      id: edge.id,
      sourceId,
      targetId,
      points: main.points,
      ends,
    });
    const anchor = edge.data?.labelPosition ?? edge.labelPosition ?? main.mid;
    for (const extraId of extras) {
      const extra = byId.get(extraId);
      const branch = sampleQuadratic(anchor, pinOf(extra), sag);
      paths.push({
        id: `${edge.id}:${extraId}`,
        sourceId,
        targetId: extraId,
        points: branch.points,
        ends: new Set([...ends, extraId]),
      });
    }
  }

  const overlaps = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (boxesOverlap(nodeRect(nodes[i]), nodeRect(nodes[j]))) {
        overlaps.push({ a: nodes[i].id, b: nodes[j].id });
      }
    }
  }

  const hits = [];
  for (const path of paths) {
    for (const node of nodes) {
      if (path.ends.has(node.id)) continue;
      if (pathHitsNode(path.points, node, padding)) {
        hits.push({
          path: path.id,
          source: path.sourceId,
          target: path.targetId,
          card: node.id,
        });
      }
    }
  }

  const crossings = [];
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const first = paths[i];
      const second = paths[j];
      const shared = [...first.ends].filter((id) => second.ends.has(id));
      let crossed = false;
      for (let a = 0; a < first.points.length - 1 && !crossed; a += 1) {
        for (let b = 0; b < second.points.length - 1; b += 1) {
          const p0 = first.points[a];
          const p1 = first.points[a + 1];
          const q0 = second.points[b];
          const q1 = second.points[b + 1];
          if (!segmentsCross(p0, p1, q0, q1)) continue;
          const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
          const nearShared = shared.some((id) => {
            const point = pinOf(byId.get(id));
            return Math.hypot(mid.x - point.x, mid.y - point.y) < PIN_NEAR;
          });
          if (nearShared) continue;
          crossings.push({ a: first.id, b: second.id });
          crossed = true;
          break;
        }
      }
    }
  }

  const labelHits = [];
  for (const edge of edges) {
    const sourceId = endpointId(edge.source);
    const targetId = endpointId(edge.target);
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target) continue;
    const box = labelBox(edge, source, target, sag);
    for (const node of nodes) {
      if (!boxesOverlap(box, nodeRect(node))) continue;
      labelHits.push({
        path: edge.id,
        label: String(edge.label ?? "relates to"),
        card: node.id,
        role: node.id === sourceId || node.id === targetId ? "endpoint" : "other",
      });
    }
  }

  const unresolved = [];
  if (overlaps.length) unresolved.push(`${overlaps.length} node overlap(s)`);
  if (hits.length) {
    unresolved.push(`${hits.length} string path(s) cross unrelated cards`);
  }
  if (labelHits.length) {
    unresolved.push(`${labelHits.length} edge label collision(s)`);
  }

  return {
    relationshipSag: sag,
    nodeOverlaps: overlaps.length,
    stringsThroughCards: hits.length,
    stringCrossings: crossings.length,
    edgeThroughNodes: hits.length,
    edgeCrossings: crossings.length,
    labelCollisions: new Set(labelHits.map((hit) => hit.path)).size,
    labelHits,
    unresolved,
    hits,
    crossings,
    overlaps,
    pathCount: paths.length,
  };
}
