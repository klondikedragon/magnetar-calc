# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

## Trustworthy calculation work

Before changing the evaluator, number engines, numerical formatting, derived
number facts, worker protocol, persistence format, or their tests, read
[`docs/engineering/trustworthy-calculator.md`](docs/engineering/trustworthy-calculator.md).
The compact inspector must never overstate a value's exactness, precision, or
mathematical interpretation. New derived facts need explicit validity
conditions, evidence, and tests; the future provenance panel is the place to
make that reasoning inspectable without crowding the workbench.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- The calculator is a single full-viewport surface; remove the permanent sidebar and reclaim vertical space.
- Input modes are selected from a compact dropdown in the keypad area.
- History is the only intentionally scrollable region. Committed entries receive increasing `@history(n)` IDs.
- Keep the math engine behind a replaceable interface. The first implementation is a placeholder; future versions may add arbitrary-precision, nested-scale, logarithmic, and level-index representations.
- Display base and notation rerender stored values without recalculating them.
- The first production-oriented backend is break_eternity.js for wide-range approximate arithmetic; decimal.js is the higher-precision backend when the expression fits its exponent range.
- Engine selection is automatic, but the selected engine and result quality remain visible in the inspector.
- Calculator syntax accepts `*` or `×`, implicit multiplication such as `5pi`, and Unicode Knuth up-arrows for tower notation.
- Display precision is a maximum significant-digit budget: trailing zeros are omitted. Auto notation uses compact plain decimals when readable; explicit scientific notation omits a positive exponent plus sign.
- The active result and History both rerender from the selected notation and display precision.
- History is displayed newest-first; seeded examples follow the same ordering, so `@history(1)` appears at the bottom.
- Imported v1 notebooks may contain validated bounded History repeat blocks; materialize them to ordinary newest-first entries before dependency analysis. Exports always flatten History to ordinary entries.
- Examples are grouped by mathematical subject, not calculator mechanics: use `Sequences` and `Magnitude & growth`. An optional primary-video field appears as a compact red play icon whose tooltip names the video.
- Published sequence examples must have a source-backed definition, a stable function or recurrence, exact prefix/oracle coverage, and a graph-ready History prefix. Textual, self-referential, and ordinal candidates remain unpublished drafts until their required value model and bounded evaluation plan exist.
- Well-known constants are resolved by the active engine; Decimal.js computes π/e/τ at its configured calculation precision rather than using parser literals.
- Memory exposes a visible hoverable indicator; invalid/incomplete expressions retain the last valid preview and show a subtle inline status.
- Memory is an accumulated expression sequence: M+ appends and evaluates the current expression, MR recalls the full parenthesized expression, and the memory chip opens a detail overlay.
- Layered values expose arrow count, dense generalized arrow notation above 20 arrows, and an explicit magnitude-only precision state.
- Number Theory mode exposes `↑` (exponentiation) and `↑↑` (tetration); explicit Knuth-arrow provenance is preserved separately from BreakEternity layer depth.
- Decimal.js evaluates integer tetration when the result remains finite within its configured exponent range; overflow automatically falls through to BreakEternity.
- Deep tower output uses a single superscript cluster for the layer marker and terminal magnitude to avoid multi-level clipping in Active Result and History.
- Persist the workbench in browser local storage (expression, History, memory, display settings, and active preview). Seed samples only when no prior workspace state exists.
- Store all view preferences together under the persisted `view` state; `^^` is an ASCII alias for tetration alongside Unicode `↑↑`.
- Palette buttons are selection-aware: parentheses wrap selections, unary functions wrap selections in a call, and postfix operators apply to selections. The memory chip is width-constrained so it cannot displace MC/M+/MR.
- Positive exact-integer powers that exceed the exact expansion boundary remain structural power values. Their inspector may show only rule-backed digit and magnitude facts, with a provenance view for assumptions and sources.
- The intended public deployment is `calc.magnetar.app` on Cloudflare Workers Static Assets. The calculator should be installable as an offline PWA on iPad, with no in-app Safari installation prompt for the initial family-and-friends release.
- Material implementation plans live in `docs/plans/` and use the filename convention `YYYY-MM-DD-short-plan-theme.md`. Update their checklists as slices are completed.
- The input palette uses a 52px decorative Magnetar icon at left, rendered at 25% opacity; the memory controls and input-mode dropdown remain right-aligned, with the dropdown below the memory controls. Preserve the semantic `Input palette` label for assistive technology without restoring the visible heading.
