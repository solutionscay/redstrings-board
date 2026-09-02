# redstrings-board

Canonical Agent Skill for composing Redstrings boards.

Redstrings is a local corkboard for investigations, not Visio.
This repository is the skill, not the app.
The Redstrings website will link here.

## Install

Clone or symlink this repo into your agent skills directory.
Keep the folder name redstrings-board so it matches the skill name field.

    git clone https://github.com/solutionscay/redstrings-board ~/.cursor/skills/redstrings-board
    ln -s /path/to/redstrings-board ~/.codex/skills/redstrings-board

## Helpers

Node.js, no extra install:

    node scripts/layout-board.mjs < board.json
    node scripts/audit-strings.mjs < board.json

Tests:

    node scripts/test-layout-board.mjs
    node scripts/test-audit-strings.mjs
    node scripts/test-compactness.mjs

## License

MIT. Copyright Solutions Cay.
