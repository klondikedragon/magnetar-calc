const unary = (id, signature, name, category, description, keywords = [], url) => ({
  id,
  signature,
  name,
  category,
  description,
  keywords,
  url,
  insertion: { empty: `${signature.slice(0, signature.indexOf("("))}($cursor)`, selected: `${signature.slice(0, signature.indexOf("("))}($selection$cursor)` },
});

const steinhausSearchKeywords = [
  "numberphile",
  "brady haran",
  "youtube",
  "math video",
  "googology",
  "large number",
  "large numbers",
  "hyperoperation",
  "nested polygons",
  "polygonal notation",
];

/**
 * Stable catalog records are deliberately presentation-independent.  Keep ids
 * when descriptions or display names change so future saved searches/favorites
 * can safely refer to an entry.
 */
const catalogEntries = [
  { id: "constant-pi", signature: "pi", name: "Pi", category: "Constants", description: "The ratio of a circle’s circumference to its diameter.", keywords: ["circle", "archimedes"], insertion: { empty: "pi$cursor", selected: "pi$cursor" } },
  { id: "constant-e", signature: "e", name: "Euler’s number", category: "Constants", description: "The base of natural logarithms and continuous growth.", keywords: ["exponential", "natural log"], insertion: { empty: "e$cursor", selected: "e$cursor" } },
  { id: "constant-tau", signature: "tau", name: "Tau", category: "Constants", description: "One full turn in radians: 2π.", keywords: ["circle", "two pi"], insertion: { empty: "tau$cursor", selected: "tau$cursor" } },
  { id: "constant-phi", signature: "phi", name: "Golden ratio", category: "Constants", description: "(1 + √5) / 2, the limiting ratio of Fibonacci terms.", keywords: ["golden ratio", "fibonacci"], insertion: { empty: "phi$cursor", selected: "phi$cursor" } },
  { id: "history-previous", signature: "@history(-1)", name: "Previous answer", category: "History", description: "The latest result in History. Relative references adapt as History grows.", keywords: ["ans", "previous", "relative"], insertion: { empty: "@history(-1)$cursor", selected: "@history(-1)$cursor" } },
  { id: "history-position", signature: "@n", name: "Sequence position", category: "History", description: "The next entry’s one-based position from the start of History.", keywords: ["sequence", "index", "nth"], insertion: { empty: "@n$cursor", selected: "@n$cursor" } },
  unary("arithmetic-sqrt", "sqrt(x)", "Square root", "Arithmetic", "The non-negative square root of x.", ["root", "radical"]),
  unary("arithmetic-abs", "abs(x)", "Absolute value", "Arithmetic", "The distance of x from zero.", ["magnitude", "modulus"]),
  { id: "arithmetic-min", signature: "min(a, b, …)", name: "Minimum", category: "Arithmetic", description: "The smallest of two or more values.", keywords: ["least", "lower"], insertion: { empty: "min($cursor, )", selected: "min($selection, $cursor)" } },
  { id: "arithmetic-max", signature: "max(a, b, …)", name: "Maximum", category: "Arithmetic", description: "The largest of two or more values.", keywords: ["greatest", "upper"], insertion: { empty: "max($cursor, )", selected: "max($selection, $cursor)" } },
  { id: "arithmetic-power", signature: "x ^ y", name: "Power", category: "Arithmetic", description: "Raise x to the yth power.", keywords: ["exponent", "exponentiation"], insertion: { empty: "^$cursor", selected: "($selection)^$cursor" } },
  { id: "arithmetic-square", signature: "x²", name: "Square", category: "Arithmetic", description: "Raise x to the second power.", keywords: ["power", "squared"], insertion: { empty: "^2$cursor", selected: "($selection)^2$cursor" } },
  { id: "arithmetic-factorial", signature: "x!", name: "Factorial", category: "Arithmetic", description: "The product of positive integers through x.", keywords: ["permutation", "combinatorics"], insertion: { empty: "!$cursor", selected: "($selection)!$cursor" } },
  { id: "arithmetic-nth-root", signature: "x^(1/n)", name: "Nth root", category: "Arithmetic", description: "The nth root of x, expressed with a reciprocal exponent.", keywords: ["root", "radical"], insertion: { empty: "^(1/$cursor)", selected: "($selection)^(1/$cursor)" } },
  { id: "arithmetic-modulo", signature: "a mod b", name: "Modulo", category: "Arithmetic", description: "The remainder after dividing a by b.", keywords: ["remainder", "modulus", "%"], insertion: { empty: " mod $cursor", selected: "($selection) mod $cursor" } },
  unary("scientific-floor", "floor(x)", "Floor", "Scientific core", "The greatest integer less than or equal to x.", ["round down", "integer"]),
  unary("scientific-ceil", "ceil(x)", "Ceiling", "Scientific core", "The least integer greater than or equal to x.", ["round up", "integer"]),
  unary("scientific-trunc", "trunc(x)", "Truncate", "Scientific core", "Remove the fractional part of x toward zero.", ["integer", "round"]),
  { id: "scientific-round", signature: "round(x, places?)", name: "Round decimal places", category: "Scientific core", description: "Round x to a requested number of decimal places; negative places round tens, hundreds, and beyond.", keywords: ["rounding", "decimal places"], insertion: { empty: "round($cursor, )", selected: "round($selection, $cursor)" } },
  { id: "scientific-round-significant", signature: "roundSig(x, digits)", name: "Round significant digits", category: "Scientific core", description: "Round x to a requested number of significant digits.", keywords: ["rounding", "significant figures", "sig figs"], insertion: { empty: "roundSig($cursor, )", selected: "roundSig($selection, $cursor)" } },
  { id: "scientific-round-to", signature: "roundTo(x, step)", name: "Round to increment", category: "Scientific core", description: "Round x to the nearest multiple of an arbitrary positive increment.", keywords: ["rounding", "nearest", "increment"], insertion: { empty: "roundTo($cursor, )", selected: "roundTo($selection, $cursor)" } },
  unary("scientific-cube-root", "cbrt(x)", "Cube root", "Scientific core", "The real cube root of x.", ["root", "radical"]),
  { id: "exponential-ten", signature: "10^x", name: "Ten to a power", category: "Exponential & logs", description: "Raise ten to x.", keywords: ["scientific notation", "power of ten"], insertion: { empty: "10^$cursor", selected: "10^($selection)$cursor" } },
  { id: "exponential-e", signature: "e^x", name: "Exponential", category: "Exponential & logs", description: "Raise Euler’s number to x.", keywords: ["growth", "natural"], insertion: { empty: "e^$cursor", selected: "e^($selection)$cursor" } },
  unary("exponential-exp", "exp(x)", "Natural exponential", "Exponential & logs", "Raise Euler’s number to x.", ["euler", "growth"]),
  unary("logarithm-natural", "ln(x)", "Natural logarithm", "Exponential & logs", "The logarithm of x with base e.", ["log", "euler"]),
  unary("logarithm-base-ten", "log(x)", "Common logarithm", "Exponential & logs", "The logarithm of x with base 10.", ["logarithm", "base ten"]),
  unary("logarithm-base-two", "log2(x)", "Binary logarithm", "Exponential & logs", "The logarithm of x with base 2.", ["logarithm", "binary"]),
  unary("trigonometry-sin", "sin(x)", "Sine", "Trigonometry", "The sine of x, in radians.", ["trig", "radians"]),
  unary("trigonometry-cos", "cos(x)", "Cosine", "Trigonometry", "The cosine of x, in radians.", ["trig", "radians"]),
  unary("trigonometry-tan", "tan(x)", "Tangent", "Trigonometry", "The tangent of x, in radians.", ["trig", "radians"]),
  unary("trigonometry-asin", "asin(x)", "Inverse sine", "Trigonometry", "The principal inverse sine of x, in radians.", ["arcsine", "trig"]),
  unary("trigonometry-acos", "acos(x)", "Inverse cosine", "Trigonometry", "The principal inverse cosine of x, in radians.", ["arccosine", "trig"]),
  unary("trigonometry-atan", "atan(x)", "Inverse tangent", "Trigonometry", "The principal inverse tangent of x, in radians.", ["arctangent", "trig"]),
  { id: "trigonometry-atan2", signature: "atan2(y, x)", name: "Two-argument arctangent", category: "Trigonometry", description: "The angle of the point (x, y), preserving its quadrant.", keywords: ["arctangent", "angle", "quadrant"], insertion: { empty: "atan2($cursor, )", selected: "atan2($selection, $cursor)" } },
  unary("trigonometry-sinh", "sinh(x)", "Hyperbolic sine", "Trigonometry", "The hyperbolic sine of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-cosh", "cosh(x)", "Hyperbolic cosine", "Trigonometry", "The hyperbolic cosine of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-tanh", "tanh(x)", "Hyperbolic tangent", "Trigonometry", "The hyperbolic tangent of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-asinh", "asinh(x)", "Inverse hyperbolic sine", "Trigonometry", "The inverse hyperbolic sine of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-acosh", "acosh(x)", "Inverse hyperbolic cosine", "Trigonometry", "The inverse hyperbolic cosine of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-atanh", "atanh(x)", "Inverse hyperbolic tangent", "Trigonometry", "The inverse hyperbolic tangent of x.", ["hyperbolic", "trig"]),
  unary("trigonometry-radians", "rad(x)", "Degrees to radians", "Trigonometry", "Convert an angle from degrees to radians.", ["degrees", "angle conversion"]),
  unary("trigonometry-degrees", "deg(x)", "Radians to degrees", "Trigonometry", "Convert an angle from radians to degrees.", ["radians", "angle conversion"]),
  unary("sequence-fibonacci", "fib(n)", "Fibonacci number", "Sequences", "The nth Fibonacci number, where each term is the sum of the two previous terms.", ["fibonacci", "golden ratio", "recurrence"]),
  unary("sequence-lucas", "lucas(n)", "Lucas number", "Sequences", "The nth Lucas number, Fibonacci’s companion sequence beginning 2, 1.", ["fibonacci", "recurrence"]),
  unary("sequence-nth-prime", "prime(n)", "Nth prime", "Sequences", "The nth prime number in a practical finite range.", ["prime", "number theory"]),
  unary("sequence-prime-count", "primepi(n)", "Prime-counting function", "Sequences", "The number of primes less than or equal to n.", ["prime", "pi(n)", "number theory"]),
  unary("sequence-partition", "partition(n)", "Partition number", "Sequences", "The number of ways to write n as a sum of positive integers.", ["integer partitions", "combinatorics"]),
  unary("sequence-catalan", "catalan(n)", "Catalan number", "Sequences", "Counts many recursively nested combinatorial structures.", ["combinatorics", "parentheses"]),
  unary("sequence-bell", "bell(n)", "Bell number", "Sequences", "The number of partitions of a set with n elements.", ["set partitions", "combinatorics"]),
  unary("sequence-triangular", "triangular(n)", "Triangular number", "Sequences", "The sum 1 + 2 + … + n.", ["polygonal", "sum"]),
  unary("sequence-harmonic", "harmonic(n)", "Harmonic number", "Sequences", "The sum 1 + 1/2 + … + 1/n.", ["series", "reciprocal"]),
  unary("sequence-jacobsthal", "jacobsthal(n)", "Jacobsthal number", "Sequences", "J(n) = J(n−1) + 2J(n−2).", ["recurrence"]),
  { id: "sequence-yellowstone", signature: "yellowstone(n)", name: "Yellowstone permutation", category: "Sequences", description: "The nth term of the Yellowstone permutation: each new term is the smallest unused number sharing a factor with the term two places back and coprime to the preceding term. In-memory generation currently supports n ≤ 10,000.", keywords: ["yellowstone", "numberphile", "geyser", "permutation", "oeis", "a098550", "gcd", "relatively prime"], links: [{ provider: "oeis", label: "OEIS A098550: Yellowstone permutation", url: "https://oeis.org/A098550" }, { provider: "youtube", label: "The Yellowstone Permutation — Numberphile", url: "https://www.youtube.com/watch?v=DUaqiM1bGX4" }], insertion: { empty: "yellowstone($cursor)", selected: "yellowstone($selection$cursor)" } },
  { id: "combinatorics-stirling-second", signature: "stirling2(n, k)", name: "Stirling number of the second kind", category: "Combinatorics", description: "Partitions n labeled objects into k nonempty unlabeled sets.", keywords: ["set partitions", "combinatorics"], insertion: { empty: "stirling2($cursor, )", selected: "stirling2($selection, $cursor)" } },
  { id: "combinatorics-binomial", signature: "binomial(n, r)", name: "Binomial coefficient", category: "Combinatorics", description: "The number of ways to choose r items from n.", keywords: ["ncr", "choose", "combinations"], insertion: { empty: "binomial($cursor, )", selected: "binomial($selection, $cursor)" } },
  { id: "steinhaus-triangle", signature: "sm_triangle(n)", name: "Steinhaus triangle", category: "Steinhaus–Moser", description: "A number inside a triangle: n raised to its own power. Small constructions reduce exactly; larger ones remain structural.", keywords: ["triangle", "mega", "moser", "large numbers", "polygon"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_triangle($cursor)", selected: "sm_triangle($selection$cursor)" } },
  { id: "steinhaus-square", signature: "sm_square(n)", name: "Steinhaus square", category: "Steinhaus–Moser", description: "n nested triangle operations. This is not ordinary squaring.", keywords: ["square", "iterate", "triangle", "mega", "moser"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_square($cursor)", selected: "sm_square($selection$cursor)" } },
  { id: "steinhaus-pentagon", signature: "sm_pentagon(n)", name: "Steinhaus pentagon", category: "Steinhaus–Moser", description: "n nested square operations. The historical circle operation is equivalent to this pentagon form.", keywords: ["pentagon", "circle", "mega", "moser", "polygon"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_pentagon($cursor)", selected: "sm_pentagon($selection$cursor)" } },
  { id: "steinhaus-circle", signature: "sm_circle(n)", name: "Steinhaus circle", category: "Steinhaus–Moser", description: "Historical notation for the pentagon operation; sm_circle(2) is Mega.", keywords: ["circle", "pentagon", "mega", "moser"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_circle($cursor)", selected: "sm_circle($selection$cursor)" } },
  { id: "steinhaus-polygon", signature: "sm_polygon(n, sides)", name: "Steinhaus polygon", category: "Steinhaus–Moser", description: "A number inside a polygon with the requested number of sides, starting at 3 for a triangle.", keywords: ["polygon", "hexagon", "pentagon", "mega", "moser"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_polygon($cursor, )", selected: "sm_polygon($selection, $cursor)" } },
  { id: "steinhaus-canonical", signature: "sm(n, nesting, sides)", name: "Nested Steinhaus–Moser form", category: "Steinhaus–Moser", description: "Canonical form M(n, nesting, sides) for an explicitly nested polygon construction.", keywords: ["canonical", "nested", "polygon", "mega", "moser"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm($cursor, , )", selected: "sm($selection, , $cursor)" } },
  { id: "steinhaus-megagon", signature: "sm_megagon(n)", name: "Mega-gon", category: "Steinhaus–Moser", description: "A number inside a polygon with Mega sides. sm_megagon(2) is Moser’s number.", keywords: ["megagon", "mega", "moser", "polygon"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "sm_megagon($cursor)", selected: "sm_megagon($selection$cursor)" } },
  { id: "steinhaus-mega", signature: "mega", name: "Mega", category: "Steinhaus–Moser", description: "2 inside Steinhaus’s historical circle, equivalently a pentagon around 2.", keywords: ["circle", "pentagon", "steinhaus", "moser"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "mega$cursor", selected: "mega$cursor" } },
  { id: "steinhaus-megiston", signature: "megiston", name: "Megiston", category: "Steinhaus–Moser", description: "10 inside Steinhaus’s historical circle, equivalently a pentagon around 10.", keywords: ["circle", "pentagon", "steinhaus", "mega"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "megiston$cursor", selected: "megiston$cursor" } },
  { id: "steinhaus-moser", signature: "moser", name: "Moser’s number", category: "Steinhaus–Moser", description: "2 inside a Mega-gon: a polygon whose number of sides is Mega.", keywords: ["moser", "mega", "megagon", "large numbers"], links: [{ provider: "youtube", label: "The Hyper Moser (and other Mega Numbers)", url: "https://www.youtube.com/watch?v=Jw_ZPdnHGzg" }], insertion: { empty: "moser$cursor", selected: "moser$cursor" } },
  unary("hierarchy-fgh1", "fgh1(n)", "Wainer F₁", "Fast-growing hierarchy", "F₁(n) = 2n.", ["wainer", "ordinal", "fast growing"]),
  unary("hierarchy-fgh2", "fgh2(n)", "Wainer F₂", "Fast-growing hierarchy", "F₂(n) = n · 2ⁿ.", ["wainer", "ordinal", "fast growing"]),
  unary("hierarchy-fgh3", "fgh3(n)", "Wainer F₃", "Fast-growing hierarchy", "Iterates F₂, n times, starting at n.", ["wainer", "ordinal", "fast growing"]),
  { id: "hyperoperation-knuth-up", signature: "a ↑ b", name: "Knuth up-arrow", category: "Hyperoperations", description: "Exponentiation: a raised to the bth power.", keywords: ["power", "exponentiation", "knuth"], insertion: { empty: " ↑ $cursor", selected: "($selection) ↑ $cursor" } },
  { id: "hyperoperation-knuth-double", signature: "a ↑↑ b", name: "Knuth double up-arrow", category: "Hyperoperations", description: "Tetration: a power tower of height b.", keywords: ["tetration", "power tower", "knuth"], insertion: { empty: " ↑↑ $cursor", selected: "($selection) ↑↑ $cursor" } },
];

export const functionCatalog = catalogEntries.map((entry) => {
  const links = entry.links ?? [];
  return {
    ...entry,
    url: entry.url ?? links[0]?.url,
    keywords: [...new Set([...(entry.keywords ?? []), ...(entry.category === "Steinhaus–Moser" ? steinhausSearchKeywords : [])])],
  };
});

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase();
}

export const functionCategories = ["All", ...new Set(functionCatalog.map((entry) => entry.category))];

export function parseFunctionSearch(query) {
  return (String(query ?? "").match(/"[^"\n]*"|[^\s"]+/g) ?? [])
    .map((term) => normalize(term.replace(/^"|"$/g, "").trim()))
    .filter(Boolean);
}

export function filterFunctionCatalog(query, category = "All") {
  const terms = parseFunctionSearch(query);
  return functionCatalog.filter((entry) => {
    if (category !== "All" && entry.category !== category) return false;
    const searchable = normalize([entry.id, entry.signature, entry.name, entry.category, entry.description, entry.url, ...(entry.links ?? []).flatMap((link) => Object.values(link)), ...entry.keywords].filter(Boolean).join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}

export function functionInsertion(entry, selectedText = "") {
  const template = selectedText && entry.insertion.selected ? entry.insertion.selected : entry.insertion.empty;
  const withSelection = template.replace("$selection", selectedText);
  const caret = withSelection.indexOf("$cursor");
  return { text: withSelection.replace("$cursor", ""), caret: caret < 0 ? withSelection.length : caret };
}
