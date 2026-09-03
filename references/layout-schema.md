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

The helper carries extra node and edge fields through unchanged. Card size defaults to 220 x 140. Label width is estimated at 8 px per character. Positions are Redstrings world coordinates. `padding` has a floor of 40; smaller values are raised to 40. `mode` is echoed back in the output but does not change the algorithm: `generate` and `arrange` both build a complete composition from scratch.

Investigation, research, and relationship archetypes place each card in one of sixteen slots around the card it connects to: the eight compass directions plus shallow and steep diagonals. Each slot is pushed outward until the relationship label clears both cards, so a gap is 40 to 60 px or the label width, whichever is larger. A slot is scored on cluster size, group closeness, and the defects it would create: strings through cards, string crossings, and labels on cards. After placement the helper pulls connected cards together, repairs overlaps and label hits, re-seats any card that still owns a defect, and squeezes the cluster toward the focal card while defects stay at zero. A deterministic stagger of 20 to 50 px horizontally and 30 to 70 px vertically breaks up rows and columns. Timeline, process, and hierarchy archetypes keep their structural alignment.

`maxSharedX` and `maxSharedY` report the largest set of card origins within 12 px of one another. Freeform layouts flag values above three. `aspectRatio` is layout width divided by height. A freeform board of four or more cards is flagged when the ratio falls below 0.65 or rises above 1.85, so the board uses both axes instead of becoming a tall stack or a flat strip.

## String audit

Yarn is not a straight line between card centers. Pins sit at the top-center of each card, shifted by `pinOffset` when present, and the curve sags by the project's `relationshipSag` (0 to 200, default 50). `layout-board.mjs` uses the same geometry when it scores `edgeThroughNodes` and `edgeCrossings`. After placing any board, run:

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

`source` and `target` may be id strings or `{ "kind": "node", "id": "a" }`. Extra targets branch from the main curve's midpoint.

The script exits 1 when it finds node overlaps, strings through unrelated cards, or label collisions. Stdout still holds the full report. String crossings are counted in `stringCrossings` but do not change the exit code, so check that field yourself. Endpoint cards are never string hits, and crossings within 70 px of a shared pin are allowed.

Repair rules for any archetype:

- An edge may only touch the cards it connects.
- Two edges may not cross except at a shared pin.
- Put connected cards in neighboring cells, or on a triangle with an empty corner.
- Do not span a third card in the same row or column.
- Give a long edge an empty corridor, or move the pair together.
- Prefer horizontal or diagonal hops. Both pins sit on the top edge, so a vertical hop needs about a card height of whitespace before its label clears the upper card. The helper widens vertical hops for you; do the same when you place by hand.
- If a multi-target relationship branches across other cards, split it into local edges or fan the targets around the source.

## Compactness

Organic archetypes pack neighbors around anchors, then pull connected cards together along their edges. They do not place cards on a large ring.

Rest length between two cards is max((w1+w2)/2, (h1+h2)/2) plus padding. A neighbor is an outlier when the center-to-center distance is more than 2.5 times rest length.

Quality also reports `meanNeighborDistance`, `maxNeighborDistance`, `clusterBounds`, and `compactnessRejects`.

Reject when `distanceOutliers` is not 0, when `compactnessRejects` is not empty, or when a freeform board of four or more cards is wider or taller than 1600 px.

## Worked 16-card example

Investigation, generate mode, seed 53, padding 48. Sixteen cards and sixteen edges: people, places, evidence, and orgs around a focal victim. Cards use real sizes, 180 to 240 wide and 130 to 200 tall.

Input (ids only): focal `victim`; people `suspect`, `partner`, `witness`; places `warehouse`, `apartment`, `cafe`, `docks`; evidence `photo`, `ledger`, `print`, `message`; orgs `shipping`, `shell`, `union`, `lender`. Edges: victim-suspect, victim-partner, victim-witness, suspect-warehouse, suspect-apartment, partner-cafe, witness-docks, warehouse-photo, warehouse-ledger, apartment-print, cafe-message, docks-shipping, shipping-shell, shell-union, ledger-lender, suspect-partner.

Compactness fields printed by `scripts/test-compactness.mjs`:

```json
{
  "nodeOverlaps": 0,
  "distanceOutliers": 0,
  "meanNeighborDistance": 340.9,
  "maxNeighborDistance": 419.6,
  "compactnessRejects": [],
  "bounds": { "x": -224, "y": -172, "width": 1567, "height": 1301 }
}
```

Each tree edge is one hop, with rest length around 250 to 280 px. The extra suspect-partner edge stays under 2.5 x rest. Width and height are both under 1600. The same run reports no strings through cards, no crossings, no label collisions, and an empty `unresolved` list, and the compactness test asserts all of that. For contrast, a 2000 x 2000 ring with 900 px yarns is a failed layout.

Other seeds on the same input are not all clean. Across seeds 1 to 30, about two thirds pass every check; the rest report one or two defects. That is why the workflow says to adjust groups or the seed and rerun.
