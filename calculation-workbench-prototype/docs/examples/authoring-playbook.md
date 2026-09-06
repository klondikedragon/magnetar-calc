# Example authoring playbook

An example is a reproducible learning notebook, not a precomputed claim. It
must earn publication before it can appear in the Examples Library.

## Publication contract

Each published example has a stable ID, concise description, searchable
keywords, a source-backed long explanation, one or more reference links, an
expression-first notebook, and a named verification fixture.

The notebook contains only expressions and History IDs. Importing always
recalculates it; saved answers never establish truth.

## Recipe

1. Start a draft record with `published: false` and identify an authoritative
   definition or primary educational source.
2. Write the smallest notebook that demonstrates one calculator capability.
   Prefer a reusable active expression over a long pre-filled result.
3. Add any missing function through the expression-extension registry and its
   catalog entry. Do not use an ad-hoc parser branch for the example.
4. Add parser, engine, and compositional tests. Where practical, add an oracle
   check against SymPy, mpmath, OEIS, or another independently maintained
   source.
5. For structural results, test the canonical form and every displayed derived
   fact. Clearly label formulas, estimates, and intervals by their evidence
   status.
6. Write the concise description, long explanation, steps, keywords, and
   references. The explanation must distinguish a definition, an exact result,
   and an estimate.
7. Set `verification.status` to `verified`, add the fixture identifier, and set
   `published: true` only after the full test suite and production build pass.

## Review checklist

- A reader can reproduce the example from expressions alone.
- References support the mathematical definition, not merely a visual result.
- The expected output reflects the calculator's actual precision and status.
- Search finds the example by names, concepts, and source URLs.
- Unresolved ideas remain drafts and are not exposed in the UI.
