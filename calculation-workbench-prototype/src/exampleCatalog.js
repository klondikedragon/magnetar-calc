import { validateNotebook } from "./notebook.js";

const fibonacciNotebook = {
  schemaVersion: 1,
  activeExpression: { expression: "@history(-1) + @history(-2)" },
  history: [
    { id: 2, expression: "1" },
    { id: 1, expression: "1" },
  ],
  nextHistoryId: 3,
};

const powerTowerNotebook = {
  schemaVersion: 1,
  activeExpression: { expression: "25^@history(-1)" },
  history: [
    { id: 1, expression: "25^25^3" },
  ],
  nextHistoryId: 2,
};

/**
 * Examples are source-backed notebooks rather than cached answers. Imports
 * always re-evaluate `notebook`; verification describes the matching fixture.
 * Keep aspirational material unpublished until it satisfies the same contract.
 */
export const exampleCatalog = [
  {
    id: "history.fibonacci-continuation",
    published: true,
    category: "History & sequences",
    name: "Fibonacci continuation",
    description: "Continue the sequence with relative History references, then press Enter for each next term.",
    keywords: ["fibonacci", "recurrence", "relative history", "previous answer", "sequence", "golden ratio"],
    notebook: fibonacciNotebook,
    verification: { fixture: "examples.fibonacci-continuation", status: "verified" },
    details: {
      overview: [
        "The first two History entries seed the standard Fibonacci recurrence. The active expression remains unchanged as History grows.",
        "Relative references are intentionally position-based: @history(-1) is the newest item, and @history(-2) is the one before it.",
      ],
      steps: ["Load the example.", "Press Enter to create the next term.", "Continue pressing Enter; the active expression adapts to the two latest entries."],
    },
    references: [
      { label: "OEIS A000045: Fibonacci numbers", url: "https://oeis.org/A000045" },
      { label: "Wolfram MathWorld: Fibonacci Number", url: "https://mathworld.wolfram.com/FibonacciNumber.html" },
    ],
  },
  {
    id: "magnitude.power-tower-25",
    published: true,
    category: "Magnitude & structure",
    name: "A power whose digit count is tractable",
    description: "Build 25^(25^3), then use it as an exponent; the value stays structural while its decimal digit count remains informative.",
    keywords: ["power tower", "exponentiation", "scientific notation", "digit count", "structural value", "large number"],
    notebook: powerTowerNotebook,
    verification: { fixture: "examples.power-tower-25", status: "verified" },
    details: {
      overview: [
        "The History seed evaluates exactly. The active expression then exceeds the exact expansion boundary, so the calculator preserves its power structure rather than inventing decimal digits.",
        "Its magnitude dossier derives a base-10 digit formula and presents a finite-precision estimate: approximately 9.0807984 × 10^21842 decimal digits.",
      ],
      steps: ["Load the example.", "Inspect the active result.", "Open Full info to compare the exact structural form, digit formula, estimate, and interval."],
    },
    references: [
      { label: "NIST DLMF §4.8: Powers and logarithms", url: "https://dlmf.nist.gov/4.8" },
      { label: "Wolfram MathWorld: Number Length", url: "https://mathworld.wolfram.com/NumberLength.html" },
    ],
  },
  {
    id: "draft.golden-ratio-companions",
    published: false,
    category: "History & sequences",
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
    category: "History & sequences",
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
    if (entry.verification.status !== "verified" || !entry.verification.fixture) throw new Error(`${entry.id} needs a verification fixture`);
    validateNotebook(entry.notebook);
  }
  return true;
}
