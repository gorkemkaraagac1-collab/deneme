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
const facade = read("js/private-tfrs16-facade.js");
const engine = read("js/tfrs16-engine.js");
const shadow = read("js/private-calculation-shadow.js");
const pagesWorkflow = read(".github/workflows/pages.yml");

const checks = [
  ["private adapter is loaded", html.includes('src="js/private-calculation-api.js')],
  ["private TFRS16 facade is loaded", html.includes('src="js/private-tfrs16-facade.js')],
  ["private adapter loads before the legacy engine", html.indexOf("private-calculation-api.js") < html.indexOf("tfrs16-engine.js")],
  ["private facade loads between adapter and legacy engine", html.indexOf("private-calculation-api.js") < html.indexOf("private-tfrs16-facade.js") && html.indexOf("private-tfrs16-facade.js") < html.indexOf("tfrs16-engine.js")],
  ["shadow comparator loads after the API-primary flag", html.indexOf("LEASEQANT_CALCULATION_API_PRIMARY") < html.indexOf("private-calculation-shadow.js")],
  ["API-primary defaults on and api=0 remains an emergency rollback", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*=\s*params\.get\("api"\)\s*!==\s*"0"/.test(html)],
  ["adapter targets the private lease calculation endpoint", /\/api\/calculations\/lease/.test(adapter)],
  ["adapter targets the bounded private batch endpoint", /\/api\/calculations\/lease\/batch/.test(adapter)],
  ["adapter exposes the expected global", /global\.LeaseQantPrivateCalculation\s*=/.test(adapter)],
  ["private facade exposes async single-contract loading", /global\.LeaseQantPrivateTfrs16Facade\s*=/.test(facade) && /async function load\(/.test(facade)],
  ["private facade exposes async batch loading", /async function loadMany\(/.test(facade) && /calculateMany\(contracts/.test(facade)],
  ["private facade projects the read-only result envelope", /function project\(result\)/.test(facade) && /schedule: value\.schedule/.test(facade)],
  ["adapter splits portfolios into backend-sized chunks", /offset \+= 20/.test(adapter)],
  ["engine gates private results behind API-primary", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*===\s*true/.test(engine)],
  ["engine checks the private cache before local fallback", /if \(isPrivateCalculationApiReady\(\)\)\s*\{[\s\S]{0,500}PRIVATE_CALCULATION_CACHE\.get/.test(engine)],
  ["engine prefers batch hydration when available", /LeaseQantPrivateCalculation\.calculateMany/.test(engine)],
  ["engine hydrates through the private facade when available", /LeaseQantPrivateTfrs16Facade/.test(engine) && /batchLoader/.test(engine)],
  ["payment-plan consumer requests the private read-only result", /async function loadPrivateReadOnlyResult\(/.test(engine) && /const privateResult = await loadPrivateReadOnlyResult\(contract\)/.test(engine)],
  ["synchronous consumers have a private-cache lookup", /function getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["control schedule prefers the warmed private result", /function controlSchedule\(contract\)\s*\{[\s\S]{0,500}getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["contract tools prefer the warmed private schedule", /function v191RenderContractTools\(\)[\s\S]{0,900}getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["report schedule source prefers private result for unchanged contracts", /function resolveContractScheduleSource\(contract\)[\s\S]{0,2200}expectedPrivateSource[\s\S]{0,900}getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["report schedule source accepts versioned private event-aware results", /eventAwareScheduleVersion === 1/.test(engine) && /privateResult\.scheduleSource === expectedPrivateSource/.test(engine) && /buildReassessedSchedule/.test(engine) && /buildModifiedSchedule/.test(engine)],
  ["modification consumer refreshes the private result after writes", /async function refreshPrivateCalculationAfterMutation\(contract\)/.test(engine) && /function initModificationEvents[\s\S]*refreshPrivateCalculationAfterMutation\(contract\)/.test(engine)],
  ["reassessment consumer refreshes the private result after writes", /async function refreshPrivateCalculationAfterMutation\(contract\)/.test(engine) && /function initReassessmentEvents[\s\S]*refreshPrivateCalculationAfterMutation\(contract\)/.test(engine)],
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
