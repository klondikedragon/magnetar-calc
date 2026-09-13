import assert from "node:assert/strict";
import test from "node:test";
import { exactInteger } from "../src/exactValues.js";
import { evaluateAutomatically } from "../src/engine.js";
import { automaticChartScale, prepareHistoryChart } from "../src/historyChart.js";

test("history chart uses a linear scale for ordinary exact values", () => {
  const chart = prepareHistoryChart([{ id: 2, value: exactInteger(12) }, { id: 1, value: exactInteger(3) }]);
  assert.equal(chart.automaticScale, "linear");
  assert.deepEqual(chart.points.map((point) => point.y), [3, 12]);
});

test("history chart selects logarithmic scale for wide positive magnitudes", () => {
  const chart = prepareHistoryChart([{ id: 2, value: exactInteger(10n ** 20n) }, { id: 1, value: exactInteger(1) }]);
  assert.equal(chart.automaticScale, "log");
  assert.equal(chart.points[0].y, 0);
  assert.equal(chart.points[1].y, 20);
});

test("history chart marks structural values instead of inventing coordinates", () => {
  const structural = evaluateAutomatically("25^25^25^3");
  const chart = prepareHistoryChart([{ id: 1, value: structural }]);
  assert.equal(chart.points[0].y, null);
  assert.match(chart.markers[0].reason, /structural/);
  assert.equal(automaticChartScale(chart.points), "linear");
});
