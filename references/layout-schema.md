# Layout helper schema

`layout-board.mjs` reads one JSON document from stdin:

```json
{
  "nodes": [
    {
      "id": "person-1",
      "name": "Ada",
      "type": "person",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 220, "height": 140 },
      "group": "core",
      "focal": true
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "person-1", "target": "artifact-1", "label": "authored" }
  ],
  "options": {
    "archetype": "investigation",
    "mode": "generate",
    "seed": 42,
    "iterations": 80,
    "padding": 48
  }
}
```

The result contains the original nodes and edges with updated positions, plus:

```json
{
  "layout": {
    "archetype": "investigation",
    "seed": 42,
    "bounds": { "x": 0, "y": 0, "width": 1200, "height": 800 },
    "quality": {
      "score": 98.4,
      "nodeOverlaps": 0,
      "edgeCrossings": 1,
      "edgeThroughNodes": 0,
      "labelCollisions": 0,
      "distanceOutliers": 0,
      "meanNeighborDistance": 247.8,
      "maxNeighborDistance": 336.3,
      "compactnessRejects": [],
      "maxSharedX": 2,
      "maxSharedY": 2,
      "aspectRatio": 1.5,
      "unresolved": []
    }
  }
}
```

The helper accepts extra node and edge fields and carries them through unchanged. Dimensions default to 220 × 140, labels are approximated at 8 pixels per character, and positions are in Redstrings world coordinates.

Both `generate` and explicit `arrange` mode produce a complete composition. Investigation, research, and relationship archetypes apply deterministic 20–50 pixel horizontal and 30–70 pixel vertical staggering. Timeline, process, and hierarchy archetypes retain structural alignment. `maxSharedX` and `maxSharedY` report the largest set of card origins within 12 pixels of one another; freeform layouts flag values above three. `aspectRatio` is layout width divided by height. Freeform boards with at least four cards flag ratios below 0.65 or above 1.85 so agents use horizontal and vertical space instead of producing a tall stack or flat strip.

## String audit

Yarn is not a straight center-to-center line. Pins sit at the top-center of each card (`pinOffset` shifts that point). The curve sags with project `relationshipSag` (0–200, default 50). `layout-board.mjs` uses the same geometry when it scores `edgeThroughNodes` / `edgeCrossings`. After placing any board, also run:

```sh
node scripts/audit-strings.mjs
```

Stdin is a board dump. A `get_board` payload works as-is. So does:

```json
{
  "nodes": [{ "id": "a", "position": { "x": 0, "y": 0 }, "size": { "width": 220, "height": 140 }, "pinOffset": 0 }],
  "edges": [{ "id": "ab", "source": "a", "target": "b", "data": { "extraTargets": ["c"] } }],
  "options": { "relationshipSag": 50, "padding": 6 }
}
```

`source` / `target` may be id strings or `{ "kind": "node", "id": "a" }`. Extra targets are sampled from the main curve midpoint.

Exit 0 only when there are no node overlaps, no string-through-unrelated-card hits, and no string crossings. Exit 1 otherwise; stdout still contains the report. Endpoint cards and crossings within 70px of a shared pin are allowed.

Repair rules (any archetype):

- An edge may only touch the cards it connects.
- Two edges may not cross except at a shared pin.
- Put connected cards in neighboring cells, or on a triangle with an empty corner.
- Do not span a third card in the same row or column.
- Give a long-distance edge an empty corridor, or move the pair together.
- If a multi-target relationship branches across other cards, split it into local edges or gather the targets into a fan around the source.

## Compactness

Organic archetypes pack neighbors around anchors, then attract along edges. They do not place cards on a large ring.

Rest length between two cards is max((w1+w2)/2, (h1+h2)/2) plus padding. A neighbor is an outlier when center-to-center distance is more than 2.5 times rest length.

Quality also reports meanNeighborDistance, maxNeighborDistance, clusterBounds, and compactnessRejects.

Reject when distanceOutliers is not 0, compactnessRejects is not empty, or a freeform board of 4+ cards is wider than 1600px or taller than 1600px.

## Worked 16-card example

Investigation generate, seed 53, padding 48. Sixteen cards, sixteen edges (people, places, evidence, orgs around a focal victim). Helpers use actual sizes (180-240 wide, 130-200 tall).

Stdout quality from `scripts/test-compactness.mjs`:

```json
{
  "nodeOverlaps": 0,
  "distanceOutliers": 0,
  "meanNeighborDistance": 247.8,
  "maxNeighborDistance": 336.3,
  "compactnessRejects": [],
  "bounds": { "x": -150, "y": -869, "width": 987, "height": 1390 }
}
```

Each tree edge is one hop (rest length around 250-280px). The extra people edge (suspect-partner) stays under 2.5 x rest. Width and height are each under 1600. A 2000 x 2000 ring with 900px yarns is a failed layout.

`layout-board.mjs` always prints this JSON to stdout, even if `unresolved` is not empty.


Input (ids only): focal `victim`; people `suspect`, `partner`, `witness`; places `warehouse`, `apartment`, `cafe`, `docks`; evidence `photo`, `ledger`, `print`, `message`; orgs `shipping`, `shell`, `union`, `lender`. Edges: victim-suspect, victim-partner, victim-witness, suspect-warehouse, suspect-apartment, partner-cafe, witness-docks, warehouse-photo, warehouse-ledger, apartment-print, cafe-message, docks-shipping, shipping-shell, shell-union, ledger-lender, suspect-partner.
