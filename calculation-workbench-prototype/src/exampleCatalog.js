import { validateNotebook } from "./notebook.js";

function recurrenceNotebook(seeds, expression) {
  const firstGeneratedId = seeds.length + 1;
  return {
    schemaVersion: 1,
    activeExpression: { expression },
    history: [
      { repeat: { expression, count: 100 - seeds.length, startId: firstGeneratedId } },
      ...seeds.slice().reverse().map((seed, index) => ({ id: seeds.length - index, expression: String(seed) })),
    ],
    nextHistoryId: 101,
  };
}

function directSequenceNotebook(expression, count = 100) {
  return {
    schemaVersion: 1,
    activeExpression: { expression },
    history: [{ repeat: { expression, count, startId: 1 } }],
    nextHistoryId: count + 1,
  };
}

const fibonacciNotebook = recurrenceNotebook([1, 1], "@history(-1) + @history(-2)");

const powerTowerNotebook = {
  schemaVersion: 1,
  activeExpression: { expression: "25^@history(-1)" },
  history: [
    { id: 1, expression: "25^25^3" },
  ],
  nextHistoryId: 2,
};

const yellowstoneNotebook = {
  schemaVersion: 1,
  activeExpression: { expression: "yellowstone(@n)" },
  history: [{ repeat: { expression: "yellowstone(@n)", count: 1000, startId: 1 } }],
  nextHistoryId: 1001,
};

const lucasNotebook = recurrenceNotebook([2, 1], "@history(-1) + @history(-2)");
const pellNotebook = recurrenceNotebook([0, 1], "2 @history(-1) + @history(-2)");
const tribonacciNotebook = recurrenceNotebook([0, 0, 1], "@history(-1) + @history(-2) + @history(-3)");
const padovanNotebook = recurrenceNotebook([1, 1, 1], "@history(-2) + @history(-3)");
const recamanNotebook = directSequenceNotebook("recaman(@n - 1)");
const sternNotebook = directSequenceNotebook("stern(@n - 1)");

/**
 * Examples are source-backed notebooks rather than cached answers. Imports
 * always re-evaluate `notebook`; verification describes the matching fixture.
 * Keep aspirational material unpublished until it satisfies the same contract.
 */
export const exampleCatalog = [
  {
    id: "history.fibonacci-continuation",
    published: true,
    category: "Sequences",
    name: "Fibonacci continuation",
    description: "The archetypal two-term recurrence, whose neighboring-term ratios converge to the golden ratio.",
    keywords: ["fibonacci", "recurrence", "relative history", "previous answer", "sequence", "golden ratio"],
    notebook: fibonacciNotebook,
    verification: { fixture: "examples.fibonacci-continuation", status: "verified" },
    details: {
      overview: [
        "Beginning 1, 1, each term is the sum of its two predecessors. Its growth is governed by the golden ratio, φ = (1 + √5) / 2.",
        "Fibonacci numbers occur throughout combinatorics, including counts of binary strings with no adjacent ones and tilings by squares and dominoes.",
      ],
      steps: ["Observe the initial terms.", "Extend the recurrence.", "Compare successive-term ratios with φ."],
    },
    references: [
      { label: "OEIS A000045: Fibonacci numbers", url: "https://oeis.org/A000045" },
      { label: "Wolfram MathWorld: Fibonacci Number", url: "https://mathworld.wolfram.com/FibonacciNumber.html" },
    ],
  },
  {
    id: "magnitude.power-tower-25",
    published: true,
    category: "Magnitude & growth",
    name: "A power whose digit count is tractable",
    description: "A finite power construction whose decimal expansion is infeasible but whose scale remains mathematically accessible.",
    keywords: ["power tower", "exponentiation", "scientific notation", "digit count", "structural value", "large number"],
    notebook: powerTowerNotebook,
    verification: { fixture: "examples.power-tower-25", status: "verified" },
    details: {
      overview: [
        "Exponentiation makes an ordinary base acquire an extraordinary scale remarkably quickly: the exponent itself is already a large exact power.",
        "The number has approximately 9.0807984 × 10^21842 decimal digits. Its power form makes that estimate derivable without pretending to list the digits.",
      ],
      steps: ["Compare the nested exponent with the outer power.", "Inspect the digit-count formula.", "Contrast an exact construction with an estimated decimal scale."],
    },
    references: [
      { label: "NIST DLMF §4.8: Powers and logarithms", url: "https://dlmf.nist.gov/4.8" },
      { label: "Wolfram MathWorld: Number Length", url: "https://mathworld.wolfram.com/NumberLength.html" },
    ],
  },
  {
    id: "sequences.yellowstone-permutation",
    published: true,
    category: "Sequences",
    name: "The Yellowstone permutation",
    description: "A greedy permutation governed by a local tension between shared factors and coprimality.",
    keywords: ["yellowstone", "numberphile", "permutation", "gcd", "relatively prime", "a098550", "sequence position", "history"],
    notebook: yellowstoneNotebook,
    verification: { fixture: "examples.yellowstone-permutation", status: "verified" },
    details: {
      overview: [
        "The Yellowstone permutation starts 1, 2, 3. Each later term is the smallest unused positive integer sharing a nontrivial common factor with the term two positions before it while remaining coprime to the immediately preceding term.",
        "Despite its local rule, the permutation develops striking global patterns, including alternating behavior around primes and even numbers.",
      ],
      steps: ["Study the initial terms and their factorizations.", "Locate the first irregular jump.", "Plot a longer prefix to see its emergent structure."],
    },
    references: [
      { label: "OEIS A098550: Yellowstone permutation", url: "https://oeis.org/A098550" },
      { label: "Sloane et al.: The Yellowstone Permutation", url: "https://arxiv.org/abs/1501.01669" },
      { label: "Numberphile: The Yellowstone Permutation", url: "https://www.youtube.com/watch?v=DUaqiM1bGX4" },
    ],
    video: { title: "The Yellowstone Permutation — Numberphile", url: "https://www.youtube.com/watch?v=DUaqiM1bGX4" },
  },
  {
    id: "sequences.recaman-walk",
    published: true,
    category: "Sequences",
    name: "Recamán's sequence: a reluctant walk",
    description: "A greedy walk that traces striking arcs while its simple local rule leaves deep global questions open.",
    keywords: ["recaman", "numberphile", "greedy", "walk", "a005132", "sequence", "graph"],
    notebook: recamanNotebook,
    verification: { fixture: "examples.recaman-walk", status: "verified" },
    details: {
      overview: [
        "Beginning at 0, step n attempts to subtract n. If that would be nonpositive or revisit a previous value, the sequence adds n instead.",
        "The resulting path combines a rigid step-size rule with unexpectedly intricate long-range behavior. It is not a permutation: repeated values eventually occur.",
      ],
      steps: ["Examine the alternating upward and downward moves.", "Locate the first repeated values.", "Plot the first hundred terms to see the walk's irregular geometry."],
    },
    references: [
      { label: "OEIS A005132: Recamán's sequence", url: "https://oeis.org/A005132" },
      { label: "Numberphile: The Slightly Spooky Recamán Sequence", url: "https://www.numberphile.com/videos/slightly-spooky-recaman-sequence" },
    ],
    video: { title: "The Slightly Spooky Recamán Sequence — Numberphile", url: "https://www.youtube.com/watch?v=FGC5TdIiT9U" },
  },
  {
    id: "sequences.stern-diatomic",
    published: true,
    category: "Sequences",
    name: "Stern's diatomic sequence",
    description: "A binary recurrence whose neighboring-term ratios enumerate every nonnegative reduced rational exactly once.",
    keywords: ["stern", "diatomic", "stern-brocot", "calkin-wilf", "numberphile", "a002487", "binary", "fractions"],
    notebook: sternNotebook,
    verification: { fixture: "examples.stern-diatomic", status: "verified" },
    details: {
      overview: [
        "Stern's sequence starts 0, 1 and splits by binary parity: a(2n) = a(n), while a(2n + 1) = a(n) + a(n + 1).",
        "Its neighboring ratios a(n)/a(n + 1) run through every nonnegative rational in lowest terms exactly once, linking a jagged integer sequence to the Stern–Brocot and Calkin–Wilf fraction trees.",
      ],
      steps: ["Group terms by powers-of-two rows.", "Compare the recurrence with binary digits of the index.", "Inspect neighboring ratios as reduced fractions."],
    },
    references: [
      { label: "OEIS A002487: Stern's diatomic sequence", url: "https://oeis.org/A002487" },
      { label: "Numberphile: Amazing Graphs III", url: "https://www.numberphile.com/videos/amazing-graphs-3" },
    ],
    video: { title: "Amazing Graphs III — Numberphile", url: "https://www.youtube.com/watch?v=j0o-pMIR8uk" },
  },
  {
    id: "sequences.lucas-companion",
    published: true,
    category: "Sequences",
    name: "Lucas numbers: Fibonacci’s companion",
    description: "The same recurrence as Fibonacci, with different seeds and the same golden-ratio growth.",
    keywords: ["lucas", "fibonacci", "golden ratio", "recurrence", "a000032"],
    notebook: lucasNotebook,
    verification: { fixture: "examples.lucas-companion", status: "verified" },
    details: {
      overview: [
        "Lucas numbers begin 2, 1 and obey the Fibonacci recurrence. Changing only the initial values produces 2, 1, 3, 4, 7, 11, ….",
        "They are tightly linked to Fibonacci numbers—Lₙ = Fₙ₋₁ + Fₙ₊₁—and their ratios approach the same golden ratio.",
      ],
      steps: ["Compare the seeds with Fibonacci.", "Extend the recurrence.", "Verify the shared long-run growth rate."],
    },
    references: [{ label: "OEIS A000032: Lucas numbers", url: "https://oeis.org/A000032" }],
  },
  {
    id: "sequences.pell-silver-ratio",
    published: true,
    category: "Sequences",
    name: "Pell numbers and the silver ratio",
    description: "A recurrence whose successive-term ratios converge to the silver ratio 1 + √2.",
    keywords: ["pell", "silver ratio", "metallic means", "recurrence", "a000129"],
    notebook: pellNotebook,
    verification: { fixture: "examples.pell-silver-ratio", status: "verified" },
    details: {
      overview: [
        "Starting with 0, 1, the Pell numbers satisfy Pₙ = 2Pₙ₋₁ + Pₙ₋₂. The sequence begins 0, 1, 2, 5, 12, 29, ….",
        "Their neighboring-term ratios approach 1 + √2, the silver ratio—the next metallic mean after the golden ratio.",
      ],
      steps: ["Compare the coefficient 2 with Fibonacci’s coefficient 1.", "Extend the recurrence.", "Observe the approach to the silver ratio."],
    },
    references: [{ label: "OEIS A000129: Pell numbers", url: "https://oeis.org/A000129" }],
  },
  {
    id: "sequences.tribonacci",
    published: true,
    category: "Sequences",
    name: "Tribonacci: a three-term recurrence",
    description: "A Fibonacci generalization in which each term sums the preceding three.",
    keywords: ["tribonacci", "n-bonacci", "recurrence", "a000073"],
    notebook: tribonacciNotebook,
    verification: { fixture: "examples.tribonacci", status: "verified" },
    details: {
      overview: [
        "The standard Tribonacci sequence begins 0, 0, 1 and adds the preceding three terms: 0, 0, 1, 1, 2, 4, 7, 13, ….",
        "Its growth is governed by the Tribonacci constant, the real root of x³ = x² + x + 1, illustrating how a recurrence’s order changes its limiting scale.",
      ],
      steps: ["Compare three-term memory with Fibonacci’s two terms.", "Extend the sequence.", "Compare its rate of growth with Fibonacci."],
    },
    references: [{ label: "OEIS A000073: Tribonacci numbers", url: "https://oeis.org/A000073" }],
  },
  {
    id: "sequences.padovan-plastic",
    published: true,
    category: "Sequences",
    name: "Padovan numbers and the plastic constant",
    description: "A delayed recurrence whose growth is controlled by the plastic constant.",
    keywords: ["padovan", "plastic constant", "recurrence", "a000931"],
    notebook: padovanNotebook,
    verification: { fixture: "examples.padovan-plastic", status: "verified" },
    details: {
      overview: [
        "With seeds 1, 1, 1, this Padovan variant obeys Pₙ = Pₙ₋₂ + Pₙ₋₃, producing 1, 1, 1, 2, 2, 3, 4, 5, ….",
        "The recurrence skips its immediate predecessor. Its long-run ratio is governed by the plastic constant, the real solution of x³ = x + 1.",
      ],
      steps: ["Compare the delayed dependency with Tribonacci.", "Extend the recurrence.", "Relate the observed growth to x³ = x + 1."],
    },
    references: [{ label: "OEIS A000931: Padovan sequence", url: "https://oeis.org/A000931" }],
  },
  {
    id: "draft.golden-ratio-companions",
    published: false,
    category: "Sequences",
    name: "Golden-ratio companion sequences",
    description: "Research lead for Lucas, Pell, and related recurrences.",
    keywords: ["golden ratio", "lucas", "pell", "recurrence", "n-bonacci"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs a curated teaching notebook and source review."], steps: [] },
    references: [],
  },
  {
    id: "draft.n-bonacci-families",
    published: false,
    category: "Sequences",
    name: "n-bonacci families",
    description: "Research lead for tribonacci and higher-order recurrences.",
    keywords: ["tribonacci", "tetranacci", "n-bonacci", "recurrence"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs engine support and oracle fixtures."], steps: [] },
    references: [],
  },
  {
    id: "draft.basement-numbers",
    published: false,
    category: "Number theory",
    name: "Basement-number constructions",
    description: "Research lead; terminology and definitions require source disambiguation.",
    keywords: ["basement numbers", "number theory", "large numbers"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: a precise definition and independent verification are required first."], steps: [] },
    references: [],
  },
  {
    id: "draft.look-and-say",
    published: false,
    category: "Sequences",
    name: "Conway's look-and-say sequence",
    description: "A digit-string sequence whose long-term structure is governed by Conway's audioactive decomposition.",
    keywords: ["look and say", "conway", "numberphile", "digit strings", "audioactive"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs a text-valued sequence representation and tests for the finite string rules."], steps: [] },
    references: [{ label: "Numberphile: Look-and-Say Numbers", url: "https://www.numberphile.com/videos/look-and-say-numbers-feat-john-conway" }],
  },
  {
    id: "draft.self-referential-sequences",
    published: false,
    category: "Sequences",
    name: "Golomb, Kolakoski, and Gijswijt sequences",
    description: "Self-referential sequences whose efficient, bounded generation needs specialized cache invariants.",
    keywords: ["golomb", "kolakoski", "gijswijt", "numberphile", "self referential"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs separate definitions, bounded caches, and oracle prefixes for each sequence."], steps: [] },
    references: [{ label: "Numberphile: Six Sequences", url: "https://www.numberphile.com/videos/six-sequences" }],
  },
  {
    id: "draft.goodstein-sequence",
    published: false,
    category: "Ordinal & hierarchy",
    name: "The Goodstein sequence",
    description: "A finite-integer process whose termination is explained using transfinite ordinal descent.",
    keywords: ["goodstein", "ordinal", "numberphile", "hereditary base", "termination"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs hereditary-base notation, ordinal semantics, and structural termination provenance."], steps: [] },
    references: [{ label: "Numberphile: The Goodstein Sequence", url: "https://www.numberphile.com/videos/the-goodstein-sequence" }],
  },
  {
    id: "draft.prime-pyramid",
    published: false,
    category: "Prime patterns",
    name: "Prime Pyramid",
    description: "A triangular construction whose local arithmetic produces surprising prime patterns.",
    keywords: ["prime pyramid", "3blue1brown", "numberphile", "triangle", "primes"],
    notebook: fibonacciNotebook,
    verification: { fixture: null, status: "draft" },
    details: { overview: ["Not published: needs a triangular-array value model and source-backed row semantics before charting."], steps: [] },
    references: [{ label: "Numberphile: Prime Pyramid", url: "https://www.numberphile.com/videos/prime-pyramid" }],
  },
];

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase();
}

export function parseExampleSearch(query) {
  return (String(query ?? "").match(/"[^"\n]*"|[^\s"]+/g) ?? [])
    .map((term) => normalize(term.replace(/^"|"$/g, "").trim()))
    .filter(Boolean);
}

export const publishedExamples = exampleCatalog.filter((entry) => entry.published);
export const exampleCategories = ["All", ...new Set(publishedExamples.map((entry) => entry.category))];

export function filterExampleCatalog(query, category = "All") {
  const terms = parseExampleSearch(query);
  return publishedExamples.filter((entry) => {
    if (category !== "All" && entry.category !== category) return false;
    const searchable = normalize([
      entry.id, entry.category, entry.name, entry.description, ...entry.keywords,
      ...entry.references.flatMap((reference) => Object.values(reference)),
      ...Object.values(entry.video ?? {}),
      ...entry.details.overview, ...entry.details.steps,
    ].join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}

export function sortExampleCatalog(entries, sortBy = "category", direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...entries].sort((left, right) => {
    const primary = normalize(left[sortBy]).localeCompare(normalize(right[sortBy]));
    if (primary) return primary * factor;
    return normalize(left.name).localeCompare(normalize(right.name)) * factor;
  });
}

export function validatePublishedExamples() {
  const ids = exampleCatalog.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Example ids must be unique");
  for (const entry of publishedExamples) {
    if (!entry.name || !entry.description || !entry.category) throw new Error(`${entry.id} is missing display metadata`);
    if (!entry.references.length) throw new Error(`${entry.id} needs a reference`);
    if (entry.video && (!entry.video.title || !entry.video.url)) throw new Error(`${entry.id} has an invalid video`);
    if (entry.verification.status !== "verified" || !entry.verification.fixture) throw new Error(`${entry.id} needs a verification fixture`);
    validateNotebook(entry.notebook);
  }
  return true;
}
