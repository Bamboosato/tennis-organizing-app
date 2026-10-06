// Follow dependency-derived findings to their advisory; package names alone
// must never exempt a new vulnerability in the same dependency.
function validAudit(report) {
  if (!report || report.error || !report.vulnerabilities ||
      !report.metadata?.vulnerabilities) return false;
  const totals = report.metadata.vulnerabilities;
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const item of Object.values(report.vulnerabilities)) {
    if (!item || !Object.hasOwn(counts, item.severity) ||
        !Array.isArray(item.via) || !Array.isArray(item.nodes)) return false;
    counts[item.severity]++;
  }
  return Object.entries(counts).every(([key, value]) => totals[key] === value) &&
    totals.total === Object.keys(report.vulnerabilities).length;
}

export function evaluateAudits({ full, production, lock, exception, now = new Date() }) {
  if (!validAudit(full) || !validAudit(production)) {
    return { ok: false, blocked: ["Invalid or unavailable npm audit response"], excepted: [] };
  }
  const blocked = Object.keys(production.vulnerabilities).map(name => `production: ${name}`);
  const excepted = [];
  const expiration = Date.parse(exception?.expires);
  const exceptionActive = Number.isFinite(expiration) && now.getTime() < expiration &&
    exception?.packages && typeof exception.packages === "object";
  function allowed(name, seen = new Set()) {
    const item = full.vulnerabilities[name];
    if (!exceptionActive || !item || seen.has(name) ||
        !Object.hasOwn(exception.packages, name) ||
        item.severity === "critical" || item.nodes.length === 0 || item.via.length === 0) return false;
    // A previously dev-only package becoming a runtime dependency must block.
    if (!item.nodes.every(path => path === `node_modules/${name}` &&
        lock.packages?.[path]?.dev === true &&
        lock.packages[path].version === exception.packages[name])) return false;
    const visited = new Set(seen).add(name);
    return item.via.every(cause => typeof cause === "string"
      ? allowed(cause, visited)
      : cause && cause.url === exception.advisory && cause.severity !== "critical");
  }
  for (const name of Object.keys(full.vulnerabilities)) {
    if (allowed(name)) excepted.push(name);
    else blocked.push(`full: ${name}`);
  }
  return { ok: blocked.length === 0, blocked, excepted };
}
