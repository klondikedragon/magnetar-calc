import assert from "node:assert/strict";
import test from "node:test";
import { commaChildren, kangarooCacheStats, kangarooPolicy, kangarooTerm } from "../src/kangaroo.js";

const oeisPrefix = [20, 22, 46, 107, 178, 260, 262, 284, 327, 401, 415, 469, 564, 610, 616, 682, 709, 807, 885, 944, 993, 1024, 1065, 1116, 1177, 1248, 1329, 1420, 1421, 1432];

test("immortal kangaroo matches the published OEIS prefix", () => {
  assert.deepEqual(oeisPrefix.map((_, index) => kangarooTerm(index + 1)), oeisPrefix);
});

test("every supported early jump is its unique comma-child", () => {
  for (let n = 1; n < 1_000; n += 1) {
    assert.deepEqual(commaChildren(kangarooTerm(n)), [kangarooTerm(n + 1)], `term ${n}`);
  }
});

test("immortal kangaroo enforces its source-verified domain", () => {
  assert.throws(() => kangarooTerm(0), /integer n >= 1/);
  assert.throws(() => kangarooTerm(kangarooPolicy.maximumVerifiedTerm + 1), /published verified prefix/);
  assert.equal(kangarooTerm(1_000), 48_042);
  assert.equal(kangarooTerm(10_000), 476_769);
  assert.equal(kangarooTerm(kangarooPolicy.maximumVerifiedTerm), 1_039_404);
  assert.equal(kangarooCacheStats().terms, kangarooPolicy.maximumVerifiedTerm);
});
