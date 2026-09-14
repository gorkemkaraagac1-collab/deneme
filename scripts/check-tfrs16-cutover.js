#!/usr/bin/env node

/**
 * Release gate for the TFRS 16 private-calculation cutover.
 *
 * This is intentionally a source-level check.  The public engine is still
 * needed by the report, journal, modification and sublease views, so deleting
 * it before those consumers are migrated would create a silent Pages outage.
 * The gate makes the supported API-primary/rollback shape explicit and fails
 * if a future edit breaks it.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const html = read("tfrs16.html");
const adapter = read("js/private-calculation-api.js");
const engine = read("js/tfrs16-engine.js");
const shadow = read("js/private-calculation-shadow.js");
const pagesWorkflow = read(".github/workflows/pages.yml");

const checks = [
  ["private adapter is loaded", html.includes('src="js/private-calculation-api.js')],
  ["private adapter loads before the legacy engine", html.indexOf("private-calculation-api.js") < html.indexOf("tfrs16-engine.js")],
  ["shadow comparator loads after the API-primary flag", html.indexOf("LEASEQANT_CALCULATION_API_PRIMARY") < html.indexOf("private-calculation-shadow.js")],
  ["API-primary defaults on and api=0 remains an emergency rollback", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*=\s*params\.get\("api"\)\s*!==\s*"0"/.test(html)],
  ["adapter targets the private lease calculation endpoint", /\/api\/calculations\/lease/.test(adapter)],
  ["adapter exposes the expected global", /global\.LeaseQantPrivateCalculation\s*=/.test(adapter)],
  ["engine gates private results behind API-primary", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*===\s*true/.test(engine)],
  ["engine checks the private cache before local fallback", /if \(isPrivateCalculationApiReady\(\)\)\s*\{[\s\S]{0,500}PRIVATE_CALCULATION_CACHE\.get/.test(engine)],
  ["shadow comparator is present", /LEASEQANT_CALCULATION_SHADOW/.test(shadow)],
  ["Pages artifact still carries the engine while consumers are being migrated", /test -f _site\/js\/tfrs16-engine\.js/.test(pagesWorkflow)],
  ["TFRS16 page has no TMS19 script dependency", !/tms19/i.test(html)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error("TFRS16 private cutover gate FAILED:");
  failed.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

const callSites = engine
  .split(/\n/)
  .filter((line) => /\bcalculateLeaseEngine\s*\(/.test(line))
  .length;

console.log(`TFRS16 private cutover gate OK (${checks.length} checks; ${callSites} engine consumer references tracked)`);
console.log("Public engine removal remains gated until all tracked UI consumers are served by the private result envelope.");
