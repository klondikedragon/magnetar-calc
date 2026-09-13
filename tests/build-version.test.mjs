import assert from "node:assert/strict";
import test from "node:test";
import { developmentVersion, readBuildVersion } from "../scripts/build-version.mjs";

test("formats the commit date and first six hash characters", () => {
  const outputs = ["2026-09-12\n", "ABCDEF1234567890\n"];
  const version = readBuildVersion({ cwd: "C:/repo", run: () => outputs.shift() });
  assert.equal(version, "v2026-09-12-abcdef");
});

test("uses a stable development label when Git metadata is unavailable", () => {
  const version = readBuildVersion({ run: () => { throw new Error("git unavailable"); } });
  assert.equal(version, developmentVersion);
});

test("rejects malformed build metadata", () => {
  const outputs = ["not-a-date", "abc123456789"];
  assert.equal(readBuildVersion({ run: () => outputs.shift() }), developmentVersion);
});
