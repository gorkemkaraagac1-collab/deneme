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
const fxUi = read("js/tfrs16-fx-ui.js");
const portfolioUi = read("js/tfrs16-portfolio-ui.js");
const reportingUi = read("js/tfrs16-reporting-ui.js");
const operationsUi = read("js/tfrs16-operations-ui.js");
const pagesWorkflow = read(".github/workflows/pages.yml");

const checks = [
  ["private adapter is loaded", html.includes('src="js/private-calculation-api.js')],
  ["private TFRS16 facade is loaded", html.includes('src="js/private-tfrs16-facade.js')],
  ["private adapter loads before the legacy engine", html.indexOf("private-calculation-api.js") < html.indexOf("tfrs16-engine.js")],
  ["private facade loads between adapter and legacy engine", html.indexOf("private-calculation-api.js") < html.indexOf("private-tfrs16-facade.js") && html.indexOf("private-tfrs16-facade.js") < html.indexOf("tfrs16-engine.js")],
  ["TMS21 FX UI module is loaded after the engine", html.indexOf("tfrs16-engine.js") < html.indexOf("tfrs16-fx-ui.js") && html.includes('src="js/tfrs16-fx-ui.js')],
  ["TMS21 FX UI markup lives outside the public engine", /window\.LeaseQantTfrs16FxUi\?\.render/.test(engine) && fxUi.includes("TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ") && !engine.includes("Kur bilgisi alınıyor...")],
  ["Portfolio UI module is loaded after the engine", html.indexOf("tfrs16-engine.js") < html.indexOf("tfrs16-portfolio-ui.js") && html.includes('src="js/tfrs16-portfolio-ui.js')],
  ["Portfolio table markup lives outside the public engine", /window\.LeaseQantTfrs16PortfolioUi\?\.renderTable/.test(engine) && portfolioUi.includes("contractsTableBody") && portfolioUi.includes("row-action") && !engine.includes("class=\"row-action\"")],
  ["Portfolio UI has a private read-only bridge", /getPortfolioContracts/.test(engine) && /openDetail/.test(engine) && /formatPortfolioAmount/.test(engine)],
  ["Reporting UI module is loaded after the engine", html.indexOf("tfrs16-engine.js") < html.indexOf("tfrs16-reporting-ui.js") && html.includes('src="js/tfrs16-reporting-ui.js')],
  ["Reporting page shells live outside the public engine", reportingUi.includes("renderFinancialReporting") && reportingUi.includes("renderRiskControls") && !engine.includes("Portföy genelinde bilanço/gelir tablosu KPI'ları")],
  ["Reporting UI uses the private-result bridge", /renderFinancialReportingBody/.test(reportingUi) && /renderFinancialReportingBody:/.test(engine) && /renderRiskControlsBody:/.test(engine)],
  ["Consolidation page entry lives in the reporting UI module", /renderConsolidation/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderConsolidation/.test(engine)],
  ["Audit trail page entry lives in the reporting UI module", /renderAuditTrail/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderAuditTrail/.test(engine)],
  ["Audit trail page body lives in the reporting UI module", /function renderAuditTrailBody\(/.test(reportingUi) && /getAuditEvents/.test(reportingUi) && !/function v26RenderAuditTrailBody\([\s\S]{0,1200}getAuditEvents/.test(engine)],
  ["Governance UI reads through explicit engine bridges", /renderConsolidationBody/.test(reportingUi) && /renderAuditTrailBody/.test(reportingUi) && /renderConsolidationBody:/.test(engine) && /renderAuditTrailBody:/.test(engine)],
  ["Operations UI module is loaded after the engine", html.indexOf("tfrs16-engine.js") < html.indexOf("tfrs16-operations-ui.js") && html.includes('src="js/tfrs16-operations-ui.js')],
  ["Change management entrypoint lives outside the public engine", /renderModificationReassessment/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderModificationReassessment/.test(engine)],
  ["Special-flow entrypoints live outside the public engine", /renderSaleAndLeaseback/.test(operationsUi) && /renderSublease/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSaleAndLeaseback/.test(engine) && /LeaseQantTfrs16OperationsUi\?\.renderSublease/.test(engine)],
  ["Accounting center entrypoint lives outside the public engine", /renderAccountingCenter/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderAccountingCenter/.test(engine)],
  ["Operations UI uses explicit engine bridges", /renderModificationManagementSection/.test(operationsUi) && /renderReassessmentManagementSection/.test(operationsUi) && /renderSlbSection/.test(operationsUi) && /renderSubleaseSection/.test(operationsUi) && /renderAccountingCenter/.test(operationsUi) && /initModificationEventsById/.test(engine) && /initReassessmentEventsById/.test(engine) && /getModificationReport:/.test(engine) && /getOperationContracts:/.test(engine)],
  ["Modification/reassessment page body lives outside the public engine", /v26PendingApprovalsApplyAll/.test(operationsUi) && /v26ModReassContractSelect/.test(operationsUi) && !/function v26RenderModificationReassessmentBody\(/.test(engine) && !/renderModificationReassessmentBody:/.test(engine)],
  ["SLB page body selectors live outside the public engine", /v26SlbContractSelect/.test(operationsUi) && /slbSectionContainer/.test(operationsUi) && !/v26SlbContractSelect/.test(engine)],
  ["Sublease page body selectors live outside the public engine", /v26SubleaseContractSelect/.test(operationsUi) && /subleaseSectionContainer/.test(operationsUi) && !/v26SubleaseContractSelect/.test(engine)],
  ["Accounting page body selectors live outside the public engine", /v26AccountingContractSelect/.test(operationsUi) && /generateJournal/.test(operationsUi) && !/v26AccountingContractSelect/.test(engine)],
  ["SLB result markup lives outside the public engine", /function renderSlbResultHtml\(result\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSlbResultHtml/.test(engine) && !/TFRS 16\.100-102 — Satış ve Geri Kiralama/.test(engine)],
  ["SLB journal markup lives outside the public engine", /function renderSlbJournalHtml\(entries\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSlbJournalHtml/.test(engine) && !/BAŞLANGIÇ FİŞİ/.test(engine)],
  ["Sublease result markup lives outside the public engine", /function renderSubleaseResultHtml\(result\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSubleaseResultHtml/.test(engine) && !/TFRS 16\.B58 — Operating Alt Kiralama/.test(engine)],
  ["Payment schedule header markup lives outside the public engine", /function renderPaymentScheduleHeader\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleHeader/.test(engine) && !/ÖDEME PLANI/.test(engine)],
  ["Payment schedule filter markup lives outside the public engine", /function renderPaymentScheduleFilters\(contract\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleFilters/.test(engine) && !/id="schedulePeriodType"/.test(engine) && !/id="schedulePresentationCurrency"/.test(engine)],
  ["Payment schedule filter options use explicit engine bridges", /buildPaymentScheduleYearOptions/.test(operationsUi) && /buildPaymentScheduleMonthOptions/.test(operationsUi) && /buildPaymentScheduleCurrencyOptions/.test(operationsUi) && /buildPaymentScheduleYearOptions:/.test(engine) && /buildPaymentScheduleMonthOptions:/.test(engine) && /buildPaymentScheduleCurrencyOptions:/.test(engine)],
  ["Payment schedule table shell lives outside the public engine", /function renderPaymentScheduleTableShell\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleTableShell/.test(engine) && !/<tbody id="scheduleTableBody"><\/tbody>/.test(engine)],
  ["Payment schedule footer markup lives outside the public engine", /function renderPaymentScheduleFooterContainers\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleFooterContainers/.test(engine) && !/<div id="fxTranslationContainer"><\/div>/.test(engine)],
  ["Payment schedule row markup lives outside the public engine", /function renderPaymentScheduleRows\(/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleRows/.test(engine) && !/title="Endeksli\/artışlı ödeme"/.test(engine)],
  ["Payment schedule row formatting uses explicit engine bridges", /formatScheduleMoney/.test(operationsUi) && /getMonthName/.test(operationsUi) && /formatScheduleMoney,/.test(engine) && /getMonthName,/.test(engine)],
  ["shadow comparator loads after the API-primary flag", html.indexOf("LEASEQANT_CALCULATION_API_PRIMARY") < html.indexOf("private-calculation-shadow.js")],
  // FAZ 2 (2026-09-15): ?api=0 rollback kaldırıldı (Burhan'ın kararı — private
  // backend'e tam bağımlılık). Flag artık sabit true; URL parametresiyle
  // geçersiz kılınamaz, ve getPrivateCalculationForConsumer()'da artık local
  // fallback dalı yok — aşağıdaki check bunu doğruluyor.
  ["API-primary is hardcoded true — no more api=0 URL override", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*=\s*true\s*;/.test(html) && !/params\.get\("api"\)/.test(html)],
  ["consumer boundary has no local calculation fallback branch", !/function getPrivateCalculationForConsumer\(contract\)\s*\{[\s\S]{0,600}calculateLeaseEngineImpl\(contract\)/.test(engine)],
  ["adapter targets the private lease calculation endpoint", /\/api\/calculations\/lease/.test(adapter)],
  ["adapter targets the bounded private batch endpoint", /\/api\/calculations\/lease\/batch/.test(adapter)],
  ["adapter targets the bounded private TMS29 batch endpoint", /\/api\/calculations\/lease\/tms29\/batch/.test(adapter) && /async function calculateTms29Many\(/.test(adapter)],
  ["adapter targets the private modification preview endpoint", /\/api\/calculations\/lease\/modification/.test(adapter)],
  ["adapter targets the private reassessment preview endpoint", /\/api\/calculations\/lease\/reassessment/.test(adapter)],
  ["adapter targets the private modification apply endpoint", /\/api\/calculations\/lease\/modification\/apply/.test(adapter)],
  ["adapter targets the private reassessment apply endpoint", /\/api\/calculations\/lease\/reassessment\/apply/.test(adapter)],
  ["adapter exposes the expected global", /global\.LeaseQantPrivateCalculation\s*=/.test(adapter)],
  ["private facade exposes async single-contract loading", /global\.LeaseQantPrivateTfrs16Facade\s*=/.test(facade) && /async function load\(/.test(facade)],
  ["private facade exposes async batch loading", /async function loadMany\(/.test(facade) && /calculateMany\(contracts/.test(facade)],
  ["private facade exposes async TMS29 batch loading", /async function loadTms29Many\(/.test(facade) && /calculateTms29Many\(contracts/.test(facade)],
  ["private TMS29 portfolio result aggregation exists", /function v191ComputePrivatePortfolioTms29\(/.test(engine) && /source: "private-api"/.test(engine)],
  ["public TMS29 restatement body is removed", !/function applyTMS29Restatement\(/.test(engine)],
  ["public TMS29 write helpers are removed", !/function (?:validate|create|apply|cancel)InflationAdjustment\(/.test(engine)],
  ["public legacy TMS29 portfolio calculator is removed", !/function v191ComputePortfolioTms29\(/.test(engine)],
  ["footnotes page entry lives in the reporting UI module", /renderFootnotes/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderFootnotes/.test(engine) && !/function renderFootnotesPage\(container\)[\s\S]{0,1000}loadTms29Many/.test(engine)],
  ["footnotes UI reads private TMS29 results through explicit bridges", /loadTms29Many/.test(reportingUi) && /computePrivatePortfolioTms29/.test(reportingUi) && /getContractsSnapshot/.test(engine) && /privateCalculationCacheHas/.test(engine)],
  ["footnotes UI renders the private TMS29 envelope", /prepareFinancialReportingData/.test(reportingUi) && /renderAssetNoteHtml/.test(reportingUi) && /renderLiabilityNoteHtml/.test(reportingUi) && /renderLiquidityNoteHtml/.test(reportingUi)],
  ["TMS29 export uses the private batch facade", /async function exportTms29InflationNote\([\s\S]{0,2600}loadTms29Many/.test(engine) && !/async function exportTms29InflationNote\([\s\S]{0,2600}v191ComputePortfolioTms29\(rouRows/.test(engine)],
  ["TMS29 journal consumers use the private journal envelope", /async function buildTms29BulkJournalEntries[\s\S]{0,900}loadTms29\(/.test(engine) && !/async function buildTms29BulkJournalEntries[\s\S]{0,900}applyTMS29Restatement\(/.test(engine)],
  ["financial reporting consumers load the private TMS29 portfolio envelope", /async function v191RenderFinancialReportingPrivate[\s\S]{0,700}v191LoadPrivatePortfolioTms29/.test(engine) && /renderFinancialReportingBody/.test(reportingUi)],
  ["financial reporting exports load the private TMS29 portfolio envelope", /async function exportRouAssetMovementNote[\s\S]{0,500}v191LoadPrivatePortfolioTms29/.test(engine) && /async function exportLeaseLiabilityMovementNote[\s\S]{0,500}v191LoadPrivatePortfolioTms29/.test(engine)],
  ["no production calls remain to the legacy TMS29 portfolio calculator", !engine.split(/\n/).some(line => /v191ComputePortfolioTms29\s*\(/.test(line) && !/function\s+v191ComputePortfolioTms29\s*\(/.test(line) && !/^\s*(?:\/\/|\*)/.test(line))],
  ["private facade exposes modification preview loading", /loadModificationPreview/.test(facade)],
  ["private facade exposes reassessment preview loading", /loadReassessmentPreview/.test(facade)],
  ["private facade exposes modification apply loading", /applyModification/.test(facade)],
  ["private facade exposes reassessment apply loading", /applyReassessment/.test(facade)],
  ["private facade projects the read-only result envelope", /function project\(result\)/.test(facade) && /schedule: value\.schedule/.test(facade)],
  ["adapter splits portfolios into backend-sized chunks", /offset \+= 20/.test(adapter)],
  ["adapter normalizes every private batch result before caching", /response\.map\(normalizeCalculationResult\)/.test(adapter)],
  ["reporting accrual parses schedule dates defensively", /const eventDate = parseDate\(schedule\[i\]\?\.date\)/.test(engine) && /const rowDate = parseDate\(row\?\.date\)/.test(engine)],
  ["engine gates private results behind API-primary", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*===\s*true/.test(engine)],
  ["initial refresh waits for private cache hydration", /function refresh\(\)\s*\{[\s\S]{0,500}Array\.isArray\(contracts\)[\s\S]{0,180}PRIVATE_CALCULATION_CACHE\.size === 0/.test(engine)],
  // FAZ 2 (2026-09-15): local fallback dalı kaldırıldığı için artık
  // koşullu bir "if (isPrivateCalculationApiReady())" sarmalayıcısı yok —
  // hem getPrivateCalculationForConsumer hem calculateLeaseEngine
  // KOŞULSUZ olarak önce private cache'e bakıyor, yoksa fail-closed
  // throw ediyor. Aşağıdaki check bu deseni doğruluyor.
  ["engine reads the private cache unconditionally, with no local fallback", /PRIVATE_CALCULATION_NOT_READY/.test(engine) && !/[=(]\s*calculateLeaseEngineImpl\(contract\)/.test(engine)],
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
  ["modification preview uses the private API in API-primary mode", /loadPrivateChangePreview\("modification"/.test(engine) && /Private modifikasyon önizlemesi alınamadı/.test(engine)],
  ["reassessment preview uses the private API in API-primary mode", /loadPrivateChangePreview\("reassessment"/.test(engine) && /Private reassessment önizlemesi alınamadı/.test(engine)],
  ["modification apply uses the private API in API-primary mode", /applyPrivateChange\("modification"/.test(engine) && /Private \$\{kind\} uygulanamadı/.test(engine)],
  ["reassessment apply uses the private API in API-primary mode", /applyPrivateChange\("reassessment"/.test(engine) && /Private \$\{kind\} uygulanamadı/.test(engine)],
  ["TMS29 preview fails closed in API-primary mode", /Private TMS 29 sonucu alınamadı; yerel hesaplama kapalı/.test(engine) && /window\.LEASEQANT_CALCULATION_API_PRIMARY === true/.test(engine)],
  ["TMS29 draft creation uses the private result envelope", /inflCreateBtn[\s\S]{0,2600}loadPrivateTms29Result\(period, periodStart\)/.test(engine) && !/inflCreateBtn[\s\S]{0,1800}createInflationAdjustment\(contract/.test(engine)],
  ["TMS29 apply uses the private result and journal", /infl-apply-btn[\s\S]{0,3600}loadPrivateTms29Result\(adjustment\.period/.test(engine) && /privateResult\.journal/.test(engine)],
  ["TMS29 writes persist through the contracts API", /inflCreateBtn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine) && /infl-apply-btn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine) && /infl-cancel-btn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine)],
  ["sale-and-leaseback preview requires the private special-flow envelope", /Private satış ve geri kiralama sonucu henüz hazır değil/.test(engine) && /specialFlows\?\.saleAndLeaseback/.test(engine)],
  ["sublease preview requires the private special-flow envelope", /Private alt kiralama sonucu henüz hazır değil/.test(engine) && /specialFlows\?\.sublease/.test(engine)],
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

// FAZ 2 (2026-09-15) update: calculateLeaseEngine() is no longer "the local
// implementation" — it was rewritten above to fail closed against the
// private cache exactly like getPrivateCalculationForConsumer(), so a
// production call to calculateLeaseEngine(...) is now as safe as one to
// getPrivateCalculationForConsumer(...). The thing that must never be
// called outside its own definition is the raw, ungated implementation:
// calculateLeaseEngineImpl(). Track that instead.
const callSiteRows = engine
  .split(/\n/)
  .map((line, index) => ({ line, lineNumber: index + 1 }))
  .filter(({ line }) => /\bcalculateLeaseEngineImpl\s*\(/.test(line));
const isComment = (line) => /^\s*(?:\/\/|\*)/.test(line);
const isDefinition = (line) => /function\s+calculateLeaseEngineImpl\s*\(/.test(line);
// FAZ 1 (2026-09-15): the embedded self-test suite (runSelfTestsV18Part1/2,
// runSelfTestsV19FullTms29, runSelfTestsV19AccountMapping,
// runSelfTestsV27MultiCompany, runAcceptanceTestLease020) and the
// window.__TFRS16_TEST__ export shim were deleted from the public bundle —
// they were unreachable dead weight (no test/ directory ships in this repo
// anymore) that also handed the full calculation engine to anyone with a
// browser console. There is no more self-test code in this file, so the old
// line-range carve-out for it is gone too.
//
// FAZ 2 (2026-09-15): the ?api=0 rollback path was removed (Burhan's
// decision — full dependency on the private backend). Both
// getPrivateCalculationForConsumer() and calculateLeaseEngine() now fail
// closed unconditionally; calculateLeaseEngineImpl() is unreachable from
// either. That also fixed v26BuildConsolidationRows's direct
// calculateLeaseEngine(ct) call, which FAZ 1 had uncovered and allowlisted
// as known scope — it now goes through the same private-only gate as every
// other consumer, so the allowlist below is empty again. Kept as an empty
// Set (not deleted) so a future edit that reopens a local-fallback path
// still fails the gate immediately rather than needing this comment
// rewritten from scratch.
const KNOWN_FAZ2_CALL_SITES = new Set([]);
const isKnownFaz2Gap = (line) => KNOWN_FAZ2_CALL_SITES.has(line.trim());
const productionRows = callSiteRows.filter(({ line }) =>
  !isComment(line) && !isDefinition(line) && !isKnownFaz2Gap(line));
const commentRows = callSiteRows.filter(({ line }) => isComment(line));
const knownGapRows = callSiteRows.filter(({ line }) => isKnownFaz2Gap(line));
const callSites = callSiteRows.length;

if (productionRows.length > 0) {
  console.error("TFRS16 private cutover gate FAILED: direct production engine references remain:");
  productionRows.forEach(({ lineNumber, line }) => console.error(`- ${lineNumber}: ${line.trim()}`));
  process.exit(1);
}

console.log(
  `TFRS16 private cutover gate OK (${checks.length} checks; ${callSites} tracked references: ` +
  `${productionRows.length} production, ${commentRows.length} comments, ${knownGapRows.length} known FAZ 2 gap)`
);
if (knownGapRows.length > 0) {
  console.log(
    "NOTE: v26BuildConsolidationRows still calls calculateLeaseEngine() directly (not private-gated). " +
    "This is tracked, allowlisted FAZ 2 work — see the comment above KNOWN_FAZ2_CALL_SITES."
  );
}
console.log(
  `Production consumers are private-gated; public engine removal remains blocked until ` +
  `${productionRows.length} production references (plus the ${knownGapRows.length} known FAZ 2 gap above) ` +
  `are replaced by UI-only private result readers.`
);
