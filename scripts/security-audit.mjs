import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateAudits } from "./security-audit-policy.mjs";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this check with npm run audit:security");
mkdirSync(".security-audit", { recursive: true });
function audit(name, args) {
  const result = spawnSync(process.execPath, [npmCli, "audit", "--json", ...args], {
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 120_000,
  });
  // Preserve the complete public dependency report for CI review, including failure.
  writeFileSync(`.security-audit/${name}.json`, result.stdout || "{}\n");
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit (${name}) did not complete: ${result.error?.message || result.status}`);
  }
  return JSON.parse(result.stdout);
}
try {
  const production = audit("production", ["--omit=dev"]);
  const full = audit("full", []);
  const exception = JSON.parse(readFileSync("security-audit-exception.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const result = evaluateAudits({ full, production, lock, exception });
  console.log("Production vulnerabilities:", production.metadata?.vulnerabilities);
  console.log("All dependency vulnerabilities:", full.metadata?.vulnerabilities);
  if (result.excepted.length) {
    console.log(`Temporary dev exception until ${exception.expires}: ${exception.advisory}`);
    console.log(result.excepted.join(", "));
  }
  if (!result.ok) {
    console.error("Blocking audit findings:", result.blocked.join(", "));
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Security audit failed:", error.message);
  process.exitCode = 1;
}
