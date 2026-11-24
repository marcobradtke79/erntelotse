# Erntelotse

A free garden planner that runs in your browser: **[open Erntelotse](https://marcobradtke79.github.io/erntelotse/)**

- Draw your plot, beds, trees and shrubs to scale on a map.
- Give every area of a bed a plant and a period, and move through the year week by week.
- Get told when to sow, plant, fertilize, prune, water and harvest, adjusted to your climate and the weather forecast.
- Warnings about poor crop rotation and bad neighbours.
- A seed stock with a shopping list for the coming season.
- Your data stays on your device: no account, works offline, installable, with export and import.
- Available in English, German, French, Spanish and Portuguese.

## Development

There is no build step. Serve the repository root and open it in a browser:

```
python3 tools/serve.py --open
node tests/node.mjs
```

`CLAUDE.md` describes the code; `docs/` holds the concept, the design rules and the implementation plan.
