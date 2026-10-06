import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAudits } from "./security-audit-policy.mjs";

const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
function audit(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const item of Object.values(vulnerabilities)) { counts[item.severity]++; counts.total++; }
  return { vulnerabilities, metadata: { vulnerabilities: counts } };
}
function fixture() {
  return {
    full: audit({
      braces: { severity: "high", nodes: ["node_modules/braces"], via: [{ url: advisory, severity: "high" }] },
      parent: { severity: "high", nodes: ["node_modules/parent"], via: ["braces"] },
    }),
    production: audit(),
    lock: { packages: {
      "node_modules/braces": { dev: true, version: "3.0.3" },
      "node_modules/parent": { dev: true, version: "1.0.0" },
    } },
    exception: { advisory, expires: "2026-11-05T00:00:00Z", packages: { braces: "3.0.3", parent: "1.0.0" } },
    now: new Date("2026-10-06T00:00:00Z"),
  };
}

test("allows only the recorded dev advisory and its dependency-derived parents", () => {
  const result = evaluateAudits(fixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.excepted, ["braces", "parent"]);
});
test("passes when a fixed dependency tree has no findings", () => {
  const input = fixture(); input.full = audit(); input.now = new Date("2026-12-01");
  assert.equal(evaluateAudits(input).ok, true);
});
test("blocks at the exact expiry boundary", () => {
  const input = fixture(); input.now = new Date(input.exception.expires);
  assert.equal(evaluateAudits(input).ok, false);
});
test("blocks an additional advisory even within an excepted package", () => {
  const input = fixture(); input.full.vulnerabilities.braces.via.push({ url: "https://example.com/new", severity: "low" });
  assert.equal(evaluateAudits(input).ok, false);
});
test("blocks critical findings even with the recorded advisory URL", () => {
  const input = fixture(); input.full.vulnerabilities.braces.via[0].severity = "critical";
  assert.equal(evaluateAudits(input).ok, false);
});
test("blocks an unrelated new vulnerable package", () => {
  const input = fixture();
  input.full = audit({ ...input.full.vulnerabilities,
    next: { severity: "critical", nodes: ["node_modules/next"], via: [{ url: "https://example.com/new", severity: "critical" }] },
  });
  assert.equal(evaluateAudits(input).ok, false);
  assert.ok(evaluateAudits(input).blocked.includes("full: next"));
});
test("blocks any production finding", () => {
  const input = fixture(); input.production = audit({ braces: input.full.vulnerabilities.braces });
  assert.equal(evaluateAudits(input).ok, false);
});
test("blocks a package becoming a runtime dependency", () => {
  const input = fixture(); delete input.lock.packages["node_modules/braces"].dev;
  assert.equal(evaluateAudits(input).ok, false);
});
test("requires review when an excepted version or dependency path changes", () => {
  const input = fixture(); input.lock.packages["node_modules/braces"].version = "3.0.4";
  assert.equal(evaluateAudits(input).ok, false);
  input.full.vulnerabilities.braces.nodes = ["node_modules/other/braces"];
  assert.equal(evaluateAudits(input).ok, false);
});
test("blocks a new nested path even if its version remains the same", () => {
  const input = fixture();
  const path = "node_modules/other/node_modules/braces";
  input.lock.packages[path] = { dev: true, version: "3.0.3" };
  input.full.vulnerabilities.braces.nodes.push(path);
  assert.equal(evaluateAudits(input).ok, false);
});
test("fails closed for missing, network-error, or inconsistent audit data", () => {
  for (const full of [{}, { error: { code: "ECONNRESET" } }, { ...audit(), metadata: { vulnerabilities: { total: 1 } } }]) {
    assert.equal(evaluateAudits({ ...fixture(), full }).ok, false);
  }
});
test("blocks unknown findings and cyclic cause chains", () => {
  const input = fixture(); input.full.vulnerabilities.parent.via = ["unknown"];
  assert.equal(evaluateAudits(input).ok, false);
  input.full.vulnerabilities.parent.via = ["parent"];
  assert.equal(evaluateAudits(input).ok, false);
});
