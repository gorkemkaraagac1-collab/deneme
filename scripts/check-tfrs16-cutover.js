#!/usr/bin/env node

/**
 * Release gate for the TFRS 16 private-calculation cutover.
 *
 * This is intentionally a source-level check.  The public UI runtime is still
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
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const html = read("tfrs16.html");
const adapter = read("js/private-calculation-api.js");
const facade = read("js/private-tfrs16-facade.js");
const engine = read("js/tfrs16-ui.js");
const privateCacheUi = read("js/tfrs16-private-cache-ui.js");
const reportingDateCache = read("js/tfrs16-reporting-date-cache.js");
const coordinator = read("js/tfrs16-ui-coordinator.js");
const privateResultBridge = read("js/tfrs16-private-result-bridge.js");
const detailUi = read("js/tfrs16-detail-ui.js");
const detailEventsUi = read("js/tfrs16-detail-events-ui.js");
const shadow = read("js/private-calculation-shadow.js");
const fxUi = read("js/tfrs16-fx-ui.js");
const portfolioUi = read("js/tfrs16-portfolio-ui.js");
const reportingUi = read("js/tfrs16-reporting-ui.js");
const operationsUi = read("js/tfrs16-operations-ui.js");
const pagesWorkflow = read(".github/workflows/pages.yml");
const publicRuntimeSource = [
  html,
  ...fs.readdirSync(path.join(root, "js"))
    .filter(file => file.endsWith(".js"))
    .map(file => read(path.join("js", file)))
].join("\n");

const checks = [
  ["legacy public engine asset is removed", !exists("js/tfrs16-engine.js")],
  ["TFRS16 page loads the UI runtime asset", html.includes('src="js/tfrs16-ui.js') && !html.includes("tfrs16-engine.js")],
  ["private adapter is loaded", html.includes('src="js/private-calculation-api.js')],
  ["private TFRS16 facade is loaded", html.includes('src="js/private-tfrs16-facade.js')],
  ["private adapter loads before the TFRS16 UI runtime", html.indexOf("private-calculation-api.js") < html.indexOf("tfrs16-ui.js")],
  ["private facade loads between adapter and TFRS16 UI runtime", html.indexOf("private-calculation-api.js") < html.indexOf("private-tfrs16-facade.js") && html.indexOf("private-tfrs16-facade.js") < html.indexOf("tfrs16-ui.js")],
  ["private result bridge exists", exists("js/tfrs16-private-result-bridge.js") && /LeaseQantTfrs16PrivateResultBridge/.test(privateResultBridge)],
  ["private result bridge loads before the TFRS16 UI runtime", html.indexOf("tfrs16-private-result-bridge.js") < html.indexOf("tfrs16-ui.js") && html.includes('src="js/tfrs16-private-result-bridge.js')],
  ["private result bridge exposes all compatibility readers", /function calculate\(/.test(privateResultBridge) && /function calculateEngine\(/.test(privateResultBridge) && /function getEscalatedPayments\(/.test(privateResultBridge)],
  ["compatibility calculation wrappers delegate to the private result bridge", /LeaseQantTfrs16PrivateResultBridge/.test(engine) && /bridge\.calculate\(contract\)/.test(engine) && /bridge\.calculateEngine\(contract\)/.test(engine) && /bridge\.getEscalatedPayments\(contract\)/.test(engine)],
  ["private calculation consumer is exported for the result bridge", /getPrivateCalculationForConsumer,/.test(engine)],
  ["TFRS16 UI coordinator exists", exists("js/tfrs16-ui-coordinator.js")],
  ["TFRS16 private cache UI module exists", exists("js/tfrs16-private-cache-ui.js") && /LeaseQantTfrs16PrivateCacheUi/.test(privateCacheUi)],
  ["TFRS16 private cache UI module loads before the runtime", html.indexOf("tfrs16-private-cache-ui.js") < html.indexOf("tfrs16-ui.js") && html.includes('src="js/tfrs16-private-cache-ui.js')],
  ["reporting-date cache exists and loads before the runtime", exists("js/tfrs16-reporting-date-cache.js") && html.indexOf("tfrs16-reporting-date-cache.js") < html.indexOf("tfrs16-ui.js")],
  ["reporting-date cache delegates to the private facade", /LeaseQantPrivateTfrs16Facade/.test(reportingDateCache) && /loadReportingDate/.test(reportingDateCache)],
  ["TFRS16 UI coordinator loads after the runtime", html.indexOf("tfrs16-ui.js") < html.indexOf("tfrs16-ui-coordinator.js") && html.includes("src=\"js/tfrs16-ui-coordinator.js")],
  ["TFRS16 detail UI module exists", exists("js/tfrs16-detail-ui.js") && /LeaseQantTfrs16DetailUi/.test(detailUi)],
  ["TFRS16 detail UI module loads before the runtime", html.indexOf("tfrs16-detail-ui.js") < html.indexOf("tfrs16-ui.js") && html.includes('src="js/tfrs16-detail-ui.js')],
  ["TFRS16 detail events UI module exists", exists("js/tfrs16-detail-events-ui.js") && /LeaseQantTfrs16DetailEvents/.test(detailEventsUi)],
  ["TFRS16 detail events UI module loads before the runtime", html.indexOf("tfrs16-detail-events-ui.js") < html.indexOf("tfrs16-ui.js") && html.includes('src="js/tfrs16-detail-events-ui.js')],
  ["detail event wiring uses the external UI module", /LeaseQantTfrs16DetailEvents\?\.bind/.test(engine) && /initModificationEvents/.test(detailEventsUi) && /bindContractDetailTabs/.test(detailEventsUi) && !/setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]{0,2200}initModificationEvents\(contract/.test(engine)],
  ["UI runtime exposes the coordinator boot hook", /window\.__GK_TFRS16_UI_BOOT__\s*=\s*__gkTfrs16Boot/.test(engine)],
  ["UI coordinator guards duplicate startup", /__GK_TFRS16_UI_COORDINATOR_RAN__/.test(coordinator) && /DOMContentLoaded/.test(coordinator)],
  ["TMS21 FX UI module is loaded after the UI runtime", html.indexOf("tfrs16-ui.js") < html.indexOf("tfrs16-fx-ui.js") && html.includes('src="js/tfrs16-fx-ui.js')],
  ["TMS21 FX UI markup lives outside the public UI runtime", /window\.LeaseQantTfrs16FxUi\?\.render/.test(engine) && fxUi.includes("TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ") && !engine.includes("Kur bilgisi alınıyor...")],
  ["TMS21 FX loading fallback lives outside the public UI runtime", /function mount\(container, contract\)/.test(fxUi) && /LeaseQantTfrs16FxUi\?\.mount/.test(engine) && !/TMS 21 arayüzü yüklenemedi/.test(engine)],
  ["Portfolio UI module is loaded after the UI runtime", html.indexOf("tfrs16-ui.js") < html.indexOf("tfrs16-portfolio-ui.js") && html.includes('src="js/tfrs16-portfolio-ui.js')],
  ["Portfolio table markup lives outside the public UI runtime", /window\.LeaseQantTfrs16PortfolioUi\?\.renderTable/.test(engine) && portfolioUi.includes("contractsTableBody") && portfolioUi.includes("row-action") && !engine.includes("class=\"row-action\"")],
  ["Portfolio UI has a private read-only bridge", /getPortfolioContracts/.test(engine) && /openDetail/.test(engine) && /formatPortfolioAmount/.test(engine)],
  ["Reporting UI module is loaded after the UI runtime", html.indexOf("tfrs16-ui.js") < html.indexOf("tfrs16-reporting-ui.js") && html.includes('src="js/tfrs16-reporting-ui.js')],
  ["Reporting page shells live outside the public UI runtime", reportingUi.includes("renderFinancialReporting") && reportingUi.includes("renderRiskControls") && !engine.includes("Portföy genelinde bilanço/gelir tablosu KPI'ları")],
  ["Reporting UI uses the private-result bridge", /renderFinancialReportingBody/.test(reportingUi) && /renderFinancialReportingBody:/.test(engine) && /renderRiskControlsBody:/.test(engine)],
  ["Consolidation page entry lives in the reporting UI module", /renderConsolidation/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderConsolidation/.test(engine)],
  ["Audit trail page entry lives in the reporting UI module", /renderAuditTrail/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderAuditTrail/.test(engine)],
  ["Audit trail page body lives in the reporting UI module", /function renderAuditTrailBody\(/.test(reportingUi) && /getAuditEvents/.test(reportingUi) && !/function v26RenderAuditTrailBody\([\s\S]{0,1200}getAuditEvents/.test(engine)],
  ["Contract audit tab markup lives outside the public UI runtime", /function renderContractAuditTab\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderContractAuditTab/.test(engine) && !/id="exportContractAuditTrailButton"/.test(engine) && !/class="gk-audit-table"/.test(engine)],
  ["Contract audit export wiring lives outside the public UI runtime", /function bindContractAuditTab\(/.test(reportingUi) && (/LeaseQantTfrs16ReportingUi\?\.bindContractAuditTab/.test(engine) || /bindContractAuditTab/.test(detailEventsUi)) && !/exportAuditTrail\(contract\.id, document\.getElementById\("auditPresentationCurrency"\)/.test(engine)],
  ["Contract summary markup lives outside the public UI runtime", /function renderContractSummaryTab\(/.test(reportingUi) && (/LeaseQantTfrs16ReportingUi\?\.renderContractSummaryTab/.test(engine) || /renderContractSummaryTab/.test(detailUi)) && !/class="detail-grid"/.test(engine)],
  ["Contract summary formatting uses explicit engine bridges", /formatPresentationCurrency/.test(reportingUi) && /resolvePaymentFrequencyLabel/.test(reportingUi) && /formatPresentationCurrency,/.test(engine) && /resolvePaymentFrequencyLabel,/.test(engine)],
  ["Contract detail tab navigation markup lives outside the public UI runtime", /function renderContractDetailTabs\(/.test(reportingUi) && (/LeaseQantTfrs16ReportingUi\?\.renderContractDetailTabs/.test(engine) || /renderContractDetailTabs/.test(detailUi)) && !/data-detail-tab-target="audit"/.test(engine)],
  ["Contract detail tab navigation remains namespaced", /renderContractDetailTabs,/.test(reportingUi) && /gk-detail-tabs/.test(reportingUi) && /bindContractDetailTabs/.test(reportingUi) && (/bindContractDetailTabs/.test(engine) || /bindContractDetailTabs/.test(detailEventsUi))],
  ["Contract detail tab panel shells live outside the public UI runtime", /function renderContractDetailPanels\(/.test(reportingUi) && (/LeaseQantTfrs16ReportingUi\?\.renderContractDetailPanels/.test(engine) || /renderContractDetailPanels/.test(detailUi)) && !/data-detail-tab="summary"/.test(engine)],
  ["Contract detail status banners live outside the public UI runtime", /function renderContractDetailStatus\(/.test(reportingUi) && (/LeaseQantTfrs16ReportingUi\?\.renderContractDetailStatus/.test(engine) || /renderContractDetailStatus/.test(detailUi)) && !/Hesaplama kaynağı: Private API/.test(engine) && !/Bu sözleşmenin private hesaplama sonucu henüz hazır değil/.test(engine)],
  ["TMS29 saved adjustment rows live outside the public UI runtime", /function renderInflationAdjustmentRows\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderInflationAdjustmentRows/.test(engine) && !/class="infl-apply-btn"/.test(engine)],
  ["TMS29 preview row lives outside the public UI runtime", /function renderInflationPreviewRow\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderInflationPreviewRow/.test(engine) && !/ÖNİZLEME/.test(engine)],
  ["TMS29 preview summary lives outside the public UI runtime", /function renderInflationPreviewSummary\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderInflationPreviewSummary/.test(engine) && !/Nominal ROU:/.test(engine)],
  ["TMS29 preview status messages live outside the public UI runtime", /function renderInflationPreviewMessage\(/.test(reportingUi) && /function renderInflationPreviewError\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderInflationPreviewMessage/.test(engine) && !/Private TMS 29 sonucu alınamadı; yerel hesaplama kapalı\. \$\{escapeHtml/.test(engine)],
  ["TMS29 action alerts use the reporting UI bridge", /function showInflationActionAlert\(/.test(reportingUi) && /showInflationActionAlert/.test(engine) && /showInflationAdjustmentAlert/.test(engine)],
  ["TMS29 adjustment panel shell lives outside the public UI runtime", /function renderInflationAdjustmentShell\(/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderInflationAdjustmentShell/.test(engine) && !/id="inflReportingPeriod"/.test(engine) && !/id="inflPreviewBtn"/.test(engine)],
  ["Contract detail tab panel shells remain namespaced", /renderContractDetailPanels,/.test(reportingUi) && /gk-detail-tab/.test(reportingUi) && /slbSectionContainer/.test(reportingUi) && /subleaseSectionContainer/.test(reportingUi)],
  ["Contract detail tab DOM state lives outside the public UI runtime", /function applyContractDetailTab\(/.test(reportingUi) && /function bindContractDetailTabs\(/.test(reportingUi) && (/bindContractDetailTabs/.test(engine) || /bindContractDetailTabs/.test(detailEventsUi)) && !/function gkApplyDetailTab\(/.test(engine) && !/querySelectorAll\("#detailContent \.gk-detail-tab-btn"\)/.test(engine)],
  ["Governance UI reads through explicit engine bridges", /renderConsolidationBody/.test(reportingUi) && /renderAuditTrailBody/.test(reportingUi) && /renderConsolidationBody:/.test(engine) && /renderAuditTrailBody:/.test(engine)],
  ["Operations UI module is loaded after the UI runtime", html.indexOf("tfrs16-ui.js") < html.indexOf("tfrs16-operations-ui.js") && html.includes('src="js/tfrs16-operations-ui.js')],
  ["Change management entrypoint lives outside the public UI runtime", /renderModificationReassessment/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderModificationReassessment/.test(engine)],
  ["Special-flow entrypoints live outside the public UI runtime", /renderSaleAndLeaseback/.test(operationsUi) && /renderSublease/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSaleAndLeaseback/.test(engine) && /LeaseQantTfrs16OperationsUi\?\.renderSublease/.test(engine)],
  ["Accounting center entrypoint lives outside the public UI runtime", /renderAccountingCenter/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderAccountingCenter/.test(engine)],
  ["Operations UI uses explicit engine bridges", /renderModificationManagementSection/.test(operationsUi) && /renderReassessmentManagementSection/.test(operationsUi) && /renderSlbSection/.test(operationsUi) && /renderSubleaseSection/.test(operationsUi) && /renderAccountingCenter/.test(operationsUi) && /initModificationEventsById/.test(engine) && /initReassessmentEventsById/.test(engine) && /getModificationReport:/.test(engine) && /getOperationContracts:/.test(engine)],
  ["Modification/reassessment page body lives outside the public UI runtime", /v26PendingApprovalsApplyAll/.test(operationsUi) && /v26ModReassContractSelect/.test(operationsUi) && !/function v26RenderModificationReassessmentBody\(/.test(engine) && !/renderModificationReassessmentBody:/.test(engine)],
  ["SLB page body selectors live outside the public UI runtime", /v26SlbContractSelect/.test(operationsUi) && /slbSectionContainer/.test(operationsUi) && !/v26SlbContractSelect/.test(engine)],
  ["Sublease page body selectors live outside the public UI runtime", /v26SubleaseContractSelect/.test(operationsUi) && /subleaseSectionContainer/.test(operationsUi) && !/v26SubleaseContractSelect/.test(engine)],
  ["Accounting page body selectors live outside the public UI runtime", /v26AccountingContractSelect/.test(operationsUi) && /generateJournal/.test(operationsUi) && !/v26AccountingContractSelect/.test(engine)],
  ["SLB result markup lives outside the public UI runtime", /function renderSlbResultHtml\(result\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSlbResultHtml/.test(engine) && !/TFRS 16\.100-102 — Satış ve Geri Kiralama/.test(engine)],
  ["SLB form markup lives outside the public UI runtime", /function renderSlbForm\(contract\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSlbForm/.test(engine) && !/id=\"slbCarryingAmount\"/.test(engine)],
  ["SLB journal markup lives outside the public UI runtime", /function renderSlbJournalHtml\(entries\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSlbJournalHtml/.test(engine) && !/BAŞLANGIÇ FİŞİ/.test(engine)],
  ["Sublease result markup lives outside the public UI runtime", /function renderSubleaseResultHtml\(result\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSubleaseResultHtml/.test(engine) && !/TFRS 16\.B58 — Operating Alt Kiralama/.test(engine)],
  ["Sublease form markup lives outside the public UI runtime", /function renderSubleaseForm\(contract\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderSubleaseForm/.test(engine) && !/id=\"subleaseMonthlyPayment\"/.test(engine)],
  ["Payment schedule header markup lives outside the public UI runtime", /function renderPaymentScheduleHeader\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleHeader/.test(engine) && !/ÖDEME PLANI/.test(engine)],
  ["Payment schedule filter markup lives outside the public UI runtime", /function renderPaymentScheduleFilters\(contract\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleFilters/.test(engine) && !/id="schedulePeriodType"/.test(engine) && !/id="schedulePresentationCurrency"/.test(engine)],
  ["Payment schedule filter options use explicit engine bridges", /buildPaymentScheduleYearOptions/.test(operationsUi) && /buildPaymentScheduleMonthOptions/.test(operationsUi) && /buildPaymentScheduleCurrencyOptions/.test(operationsUi) && /buildPaymentScheduleYearOptions:/.test(engine) && /buildPaymentScheduleMonthOptions:/.test(engine) && /buildPaymentScheduleCurrencyOptions:/.test(engine)],
  ["Payment schedule table shell lives outside the public UI runtime", /function renderPaymentScheduleTableShell\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleTableShell/.test(engine) && !/<tbody id="scheduleTableBody"><\/tbody>/.test(engine)],
  ["Payment schedule footer markup lives outside the public UI runtime", /function renderPaymentScheduleFooterContainers\(\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleFooterContainers/.test(engine) && !/<div id="fxTranslationContainer"><\/div>/.test(engine)],
  ["Payment schedule section composition lives outside the public UI runtime", /function renderPaymentScheduleSection\(contract\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleSection/.test(engine) && !/function renderPaymentScheduleSection\(contract\)\s*\{[^}]*<div/.test(engine)],
  ["Payment schedule row markup lives outside the public UI runtime", /function renderPaymentScheduleRows\(/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleRows/.test(engine) && !/title="Endeksli\/artışlı ödeme"/.test(engine)],
  ["Payment schedule row formatting uses explicit engine bridges", /formatScheduleMoney/.test(operationsUi) && /getMonthName/.test(operationsUi) && /formatScheduleMoney,/.test(engine) && /getMonthName,/.test(engine)],
  ["Payment schedule state rendering lives outside the public UI runtime", /function renderPaymentScheduleState\(/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.renderPaymentScheduleState/.test(engine) && !/document\.getElementById\("scheduleEmptyState"\)/.test(engine)],
  ["Payment schedule private and FX status messages use the UI bridge", /emptyMessage: "Private hesaplama sonucu hazır olduğunda ödeme planı görüntülenecek\."/.test(engine) && /fxMessage/.test(engine) && /renderPaymentScheduleState/.test(operationsUi)],
  ["Payment schedule event wiring lives outside the public UI runtime", /function bindPaymentScheduleEvents\(contract, handlers = \{\}\)/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.bindPaymentScheduleEvents/.test(engine) && !/function initPaymentScheduleEvents\(contract\)[\s\S]{0,1800}addEventListener/.test(engine)],
  ["Payment schedule event bridge covers export and reporting refreshes", /exportSchedule\?\.\(contract\)/.test(operationsUi) && /renderFxTranslation\?\.\(contract\)/.test(operationsUi) && /exportSchedule: exportPaymentSchedule/.test(engine)],
  ["Payment schedule export presentation lives outside the public UI runtime", /function exportPaymentScheduleFile\(/.test(operationsUi) && /LeaseQantTfrs16OperationsUi\?\.exportPaymentScheduleFile/.test(engine) && !/async function exportPaymentSchedule\([\s\S]{0,5200}XLSX\.utils\.book_new/.test(engine) && !/async function exportPaymentSchedule\([\s\S]{0,5200}link\.download\s*=/.test(engine)],
  ["Payment schedule export keeps XLSX and CSV fallback in the UI module", /XLSX\.utils\.book_new/.test(operationsUi) && /link\.download\s*=/.test(operationsUi) && /exportPaymentScheduleFile,/.test(operationsUi)],
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
  ["adapter targets the private single TMS29 endpoint", /\/api\/calculations\/lease\/tms29/.test(adapter) && /async function calculateTms29\(/.test(adapter)],
  ["adapter targets the private modification preview endpoint", /\/api\/calculations\/lease\/modification/.test(adapter)],
  ["adapter targets the private reassessment preview endpoint", /\/api\/calculations\/lease\/reassessment/.test(adapter)],
  ["adapter targets the private modification apply endpoint", /\/api\/calculations\/lease\/modification\/apply/.test(adapter)],
  ["adapter targets the private reassessment apply endpoint", /\/api\/calculations\/lease\/reassessment\/apply/.test(adapter)],
  ["adapter targets the private reporting-date endpoint", /\/api\/calculations\/lease\/reporting-date/.test(adapter) && /async function calculateReportingDate\(/.test(adapter)],
  ["adapter targets the private TMS21 endpoint", /\/api\/calculations\/lease\/tms21/.test(adapter) && /async function calculateTms21\(/.test(adapter)],
  ["adapter targets the private journal endpoint", /\/api\/calculations\/lease\/journal/.test(adapter) && /async function calculateJournal\(/.test(adapter)],
  ["adapter targets the private early-payment endpoint", /\/api\/calculations\/lease\/early-payment/.test(adapter) && /async function calculateEarlyPayment\(/.test(adapter)],
  ["adapter targets the private sale-and-leaseback endpoint", /\/api\/calculations\/lease\/sale-and-leaseback/.test(adapter) && /async function calculateSaleAndLeaseback\(/.test(adapter)],
  ["TMS21 runtime delegates unconditionally to the private facade", /async function buildTms21FxTranslation\(contract, scheduleSource, options = \{\}\)[\s\S]{0,1200}privateFacade\.loadTms21/.test(engine)],
  ["public TMS21 translation math is removed after private cutover", (() => {
    const match = engine.match(/async function buildTms21FxTranslation\([\s\S]*?\n  \}/);
    return Boolean(match && !/loadV23Rates|buildReportingDateAccrual|translationSchedule|fxGainLoss/.test(match[0]));
  })()],
  ["early-payment runtime delegates to the private facade", /async function applyEarlyPayment\(contractId, amount, date\)[\s\S]{0,1000}facade\.loadEarlyPayment/.test(engine)],
  ["public early-payment runtime contains no schedule reconstruction", (() => {
    const match = engine.match(/async function applyEarlyPayment\([\s\S]*?\n  \}/);
    return Boolean(match && !/periodicRate|revisedSchedule|openingBalance/.test(match[0]));
  })()],
  ["adapter exposes the expected global", /global\.LeaseQantPrivateCalculation\s*=/.test(adapter)],
  ["private facade exposes async single-contract loading", /global\.LeaseQantPrivateTfrs16Facade\s*=/.test(facade) && /async function load\(/.test(facade)],
  ["private facade exposes async batch loading", /async function loadMany\(/.test(facade) && /calculateMany\(contracts/.test(facade)],
  ["private facade exposes async TMS29 batch loading", /async function loadTms29Many\(/.test(facade) && /calculateTms29Many\(contracts/.test(facade)],
  ["private facade exposes async single TMS29 loading", /async function loadTms29\(/.test(facade) && /calculateTms29\(contract/.test(facade)],
  ["private facade exposes async journal loading", /async function loadJournal\(/.test(facade) && /calculateJournal\(contract/.test(facade)],
  ["single journal runtime delegates to the private journal loader", /async function generatePrivateSelectedJournal\(/.test(engine) && /facade\.loadJournal\(contract/.test(engine) && /privateJournalPrimary/.test(engine)],
  ["private TMS29 portfolio result aggregation exists", /function v191ComputePrivatePortfolioTms29\(/.test(engine) && /source: "private-api"/.test(engine)],
  ["public TMS29 restatement body is removed", !/function applyTMS29Restatement\(/.test(engine)],
  ["public TMS29 write helpers are removed", !/function (?:validate|create|apply|cancel)InflationAdjustment\(/.test(engine)],
  ["public legacy TMS29 portfolio calculator is removed", !/function v191ComputePortfolioTms29\(/.test(engine)],
  ["public TMS29 journal generator is removed", !/function generateInflationAdjustmentJournal\(/.test(engine) && !/generateInflationAdjustmentJournal\s*=/.test(engine)],
  ["legacy public discount-rate math helpers are removed", !/function (?:resolveDiscountRateConvention|resolveContractMonthlyRate)\s*\(/.test(engine)],
  ["legacy public payment-date builder is removed", !/function buildLeasePaymentDates\s*\(/.test(engine) && !/function monthsFromCommencement\s*\(/.test(engine)],
  ["legacy inception liability split helpers are removed", !/function (?:calculateCurrentLiability|calculateNonCurrentLiability)\s*\(/.test(engine)],
  ["removed lease-math helpers have no runtime call-sites", !/\b(?:resolveDiscountRateConvention|resolveContractMonthlyRate|buildLeasePaymentDates|monthsFromCommencement|calculateCurrentLiability|calculateNonCurrentLiability)\s*\(/.test(publicRuntimeSource)],
  ["removed lease-math helpers are absent from HTML handlers", !/\b(?:resolveDiscountRateConvention|resolveContractMonthlyRate|buildLeasePaymentDates|monthsFromCommencement|calculateCurrentLiability|calculateNonCurrentLiability)\s*\(/.test(html)],
  ["public runtime contains no retired api=0 fallback wording", !/\?api=0|public engine is available|local engine as the source/.test(engine)],
  ["footnotes page entry lives in the reporting UI module", /renderFootnotes/.test(reportingUi) && /LeaseQantTfrs16ReportingUi\?\.renderFootnotes/.test(engine) && !/function renderFootnotesPage\(container\)[\s\S]{0,1000}loadTms29Many/.test(engine)],
  ["footnotes UI reads private TMS29 results through explicit bridges", /loadTms29Many/.test(reportingUi) && /computePrivatePortfolioTms29/.test(reportingUi) && /getContractsSnapshot/.test(engine) && /privateCalculationCacheHas/.test(engine)],
  ["footnotes UI renders the private TMS29 envelope", /prepareFinancialReportingData/.test(reportingUi) && /renderAssetNoteHtml/.test(reportingUi) && /renderLiabilityNoteHtml/.test(reportingUi) && /renderLiquidityNoteHtml/.test(reportingUi)],
  ["TMS29 export uses the private batch facade", /async function exportTms29InflationNote\([\s\S]{0,2600}loadTms29Many/.test(engine) && !/async function exportTms29InflationNote\([\s\S]{0,2600}v191ComputePortfolioTms29\(rouRows/.test(engine)],
  ["TMS29 journal consumers use the private journal envelope", /async function buildTms29BulkJournalEntries[\s\S]{0,900}loadTms29\(/.test(engine) && !/async function buildTms29BulkJournalEntries[\s\S]{0,900}applyTMS29Restatement\(/.test(engine)],
  ["TMS29 single and batch consumers use private facade loaders", /loadTms29\(/.test(engine) && /loadTms29Many\(/.test(engine) && /loadTms29Many\(/.test(reportingUi)],
  ["financial reporting consumers load the private TMS29 portfolio envelope", /async function v191RenderFinancialReportingPrivate[\s\S]{0,700}v191LoadPrivatePortfolioTms29/.test(engine) && /renderFinancialReportingBody/.test(reportingUi)],
  ["financial reporting exports load the private TMS29 portfolio envelope", /async function exportRouAssetMovementNote[\s\S]{0,500}v191LoadPrivatePortfolioTms29/.test(engine) && /async function exportLeaseLiabilityMovementNote[\s\S]{0,500}v191LoadPrivatePortfolioTms29/.test(engine)],
  ["no production calls remain to the legacy TMS29 portfolio calculator", !engine.split(/\n/).some(line => /v191ComputePortfolioTms29\s*\(/.test(line) && !/function\s+v191ComputePortfolioTms29\s*\(/.test(line) && !/^\s*(?:\/\/|\*)/.test(line))],
  ["private facade exposes modification preview loading", /loadModificationPreview/.test(facade)],
  ["private facade exposes reassessment preview loading", /loadReassessmentPreview/.test(facade)],
  ["private facade exposes modification apply loading", /applyModification/.test(facade)],
  ["private facade exposes reassessment apply loading", /applyReassessment/.test(facade)],
  ["private facade exposes reporting-date loading", /loadReportingDate/.test(facade)],
  ["private facade exposes TMS21 loading", /loadTms21/.test(facade)],
  ["private facade exposes early-payment loading", /loadEarlyPayment/.test(facade)],
  ["private facade exposes sale-and-leaseback loading", /loadSaleAndLeaseback/.test(facade)],
  ["sale-and-leaseback runtime reads the dedicated private result", /async function runAndRenderSlb\([\s\S]{0,7000}facade\.loadSaleAndLeaseback\(input\)/.test(engine)],
  ["public sale-and-leaseback annuity helper is removed", !/function slbAnnuityPayment\(/.test(engine)],
  ["modification and reassessment previews use the private facade", /loadPrivateChangePreview\("modification"/.test(engine) && /loadPrivateChangePreview\("reassessment"/.test(engine)],
  ["modification and reassessment applies use the private facade", /applyPrivateChange\("modification"/.test(engine) && /applyPrivateChange\("reassessment"/.test(engine)],
  ["public modification calculators are absent", !/function calculateModification\(/.test(engine) && !/function calculateReassessment\(/.test(engine)],
  ["private facade projects the read-only result envelope", /function project\(result\)/.test(facade) && /schedule: value\.schedule/.test(facade)],
  ["adapter splits portfolios into backend-sized chunks", /offset \+= 20/.test(adapter)],
  ["adapter normalizes every private batch result before caching", /response\.map\(normalizeCalculationResult\)/.test(adapter)],
  ["reporting accrual parses schedule dates defensively", /const eventDate = parseDate\(schedule\[i\]\?\.date\)/.test(engine) && /const rowDate = parseDate\(row\?\.date\)/.test(engine)],
  ["engine gates private results behind API-primary", /window\.LEASEQANT_CALCULATION_API_PRIMARY\s*===\s*true/.test(engine)],
  ["initial refresh waits for private cache hydration", /function refresh\(\)\s*\{[\s\S]{0,500}Array\.isArray\(contracts\)[\s\S]{0,180}PRIVATE_CALCULATION_CACHE\.size === 0/.test(engine)],
  ["initial hydration warms private month-end reporting-date results", /const requestedKpiDate = getDashboardReportingDate\(new Date\(\)\)[\s\S]{0,260}ensurePrivateReportingDateCache\(contracts, requestedKpiDate\)/.test(engine)],
  ["API-primary classification reads the private reporting-date envelope", /function calculateLiabilitySplitAsOf\([\s\S]{0,1800}getPrivateReportingDateResult\(contract, reportingDate\)/.test(engine) && /PRIVATE_REPORTING_DATE_NOT_READY/.test(engine)],
  ["financial reporting warms its selected reporting date", /async function v191RenderFinancialReportingPrivate\([\s\S]{0,700}ensurePrivateReportingDateCache\(contracts, effectivePeriodEnd\)/.test(engine)],
  // FAZ 2 (2026-09-15): local fallback dalı kaldırıldığı için artık
  // koşullu bir "if (isPrivateCalculationApiReady())" sarmalayıcısı yok —
  // hem getPrivateCalculationForConsumer hem calculateLeaseEngine
  // KOŞULSUZ olarak önce private cache'e bakıyor, yoksa fail-closed
  // throw ediyor. Aşağıdaki check bu deseni doğruluyor.
  ["engine reads the private cache unconditionally, with no local fallback", /PRIVATE_CALCULATION_NOT_READY/.test(engine) && !/[=(]\s*calculateLeaseEngineImpl\(contract\)/.test(engine)],
  ["private cache module prefers batch hydration when available", /calculateMany/.test(privateCacheUi)],
  ["private cache module hydrates through the private facade when available", /LeaseQantPrivateTfrs16Facade/.test(privateCacheUi) && /batchLoader/.test(privateCacheUi)],
  ["payment-plan consumer requests the private read-only result", /function loadPrivateReadOnlyResult\(/.test(engine) && /loadReadOnly/.test(privateCacheUi) && /const privateResult = await loadPrivateReadOnlyResult\(contract\)/.test(engine)],
  ["synchronous consumers have a private-cache lookup", /function getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["control schedule resolves through the private-only source", /function controlSchedule\(contract\)\s*\{[\s\S]{0,500}resolveContractScheduleSource\(contract\)/.test(engine)],
  ["contract tools prefer the warmed private schedule", /function v191RenderContractTools\(\)[\s\S]{0,900}getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["report schedule source prefers private result for unchanged contracts", /function resolveContractScheduleSource\(contract\)[\s\S]{0,2200}expectedPrivateSource[\s\S]{0,900}getPrivateCachedCalculationResult\(contract\)/.test(engine)],
  ["report schedule source accepts versioned private event-aware results", /eventAwareScheduleVersion === 1/.test(engine) && /privateResult\.scheduleSource === expectedPrivateSource/.test(engine) && /function resolveContractScheduleSource\(contract\)[\s\S]{0,2600}source: appliedEvent \? \"ERROR\"/.test(engine)],
  ["report schedule source has no browser fallback", !/function resolveContractScheduleSource\(contract\)[\s\S]{0,2600}buildReassessedSchedule\(contract/.test(engine) && !/function resolveContractScheduleSource\(contract\)[\s\S]{0,2600}buildModifiedSchedule\(contract/.test(engine)],
  ["classification consumer uses the private schedule source", /function calculateReassessmentClassification\(contract, reportingDate\)[\s\S]{0,1800}resolveContractScheduleSource\(contract\)/.test(engine) && !/function calculateReassessmentClassification\(contract, reportingDate\)[\s\S]{0,1800}buildReassessedSchedule\(contract/.test(engine)],
  ["unused browser schedule builders are removed", !/function buildReassessedSchedule\s*\(/.test(engine) && !/function buildModifiedSchedule\s*\(/.test(engine)],
  ["applied change journals read persisted private measurements", /function resolveAppliedModificationMeasurement\(contract, modification\) \{\s*return modification;/.test(engine) && /function resolveAppliedReassessmentMeasurement\(contract, reassessment\) \{\s*return reassessment;/.test(engine)],
  ["local applied change-chain calculators are removed", !/function buildScheduleFromChangeChain\s*\(/.test(engine) && !/function buildModificationFuturePayments\s*\(/.test(engine) && !/function calculateModifiedLeaseLiability\s*\(/.test(engine) && !/function calculateReassessmentLiability\s*\(/.test(engine) && !/function calculateReassessmentROUAdjustment\s*\(/.test(engine)],
  ["modification consumer refreshes the private result after writes", /async function refreshPrivateCalculationAfterMutation\(contract\)/.test(engine) && /function initModificationEvents[\s\S]*refreshPrivateCalculationAfterMutation\(contract\)/.test(engine)],
  ["reassessment consumer refreshes the private result after writes", /async function refreshPrivateCalculationAfterMutation\(contract\)/.test(engine) && /function initReassessmentEvents[\s\S]*refreshPrivateCalculationAfterMutation\(contract\)/.test(engine)],
  ["modification preview uses the private API in API-primary mode", /loadPrivateChangePreview\("modification"/.test(engine) && /Private modifikasyon önizlemesi alınamadı/.test(engine)],
  ["reassessment preview uses the private API in API-primary mode", /loadPrivateChangePreview\("reassessment"/.test(engine) && /Private reassessment önizlemesi alınamadı/.test(engine)],
  ["modification apply uses the private API in API-primary mode", /applyPrivateChange\("modification"/.test(engine) && /Private \$\{kind\} uygulanamadı/.test(engine)],
  ["reassessment apply uses the private API in API-primary mode", /applyPrivateChange\("reassessment"/.test(engine) && /Private \$\{kind\} uygulanamadı/.test(engine)],
  ["TMS29 preview fails closed in API-primary mode", (/Private TMS 29 sonucu alınamadı; yerel hesaplama kapalı/.test(engine) || /function renderInflationPreviewError\(/.test(reportingUi)) && /window\.LEASEQANT_CALCULATION_API_PRIMARY === true/.test(engine)],
  ["TMS29 draft creation uses the private result envelope", /inflCreateBtn[\s\S]{0,2600}loadPrivateTms29Result\(period, periodStart\)/.test(engine) && !/inflCreateBtn[\s\S]{0,1800}createInflationAdjustment\(contract/.test(engine)],
  // FAZ UI ayrıştırması (2026-09-16): infl-apply-btn olay bağlama artık
  // reporting-ui.js'deki bindInflationAdjustmentEvents'te, asıl private
  // API + journal çağrısı (applyAdjustment) engine.js'de — iki dosyaya
  // bölündüğü için eski tek-dosya yakınlık kontrolü yerine her ikisinin
  // de varlığını ayrı ayrı doğruluyoruz.
  ["TMS29 apply uses the private result and journal", /infl-apply-btn/.test(reportingUi) && /loadPrivateTms29Result\(adjustment\.period/.test(engine) && /privateResult\.journal/.test(engine)],
  ["TMS29 writes persist through the contracts API", /inflCreateBtn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine) && /infl-apply-btn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine) && /infl-cancel-btn[\s\S]{0,5200}persistContractToApi\(contract, true\)/.test(engine)],
  ["sale-and-leaseback preview reads the dedicated private result", /Private satış ve geri kiralama sonucu henüz hazır değil/.test(engine) && /facade\.loadSaleAndLeaseback\(input\)/.test(engine)],
  ["sublease preview requires the private special-flow envelope", /Private alt kiralama sonucu henüz hazır değil/.test(engine) && /specialFlows\?\.sublease/.test(engine)],
  ["shadow comparator is present", /LEASEQANT_CALCULATION_SHADOW/.test(shadow)],
  ["Pages artifact carries the UI runtime", /test -f _site\/js\/tfrs16-ui\.js/.test(pagesWorkflow)],
  ["TFRS16 page has no TMS19 script dependency", !/tms19/i.test(html)],
  // FAZ 9: the shipped browser bundle must not retain test-only engine
  // handles or raw calculation implementation markers.
  ["public runtime has no test engine handle", !/__TFRS16_TEST__/.test(publicRuntimeSource)],
  ["public runtime has no raw engine implementation markers", !/applyTMS29Restatement|calculateLeaseEngineImpl|runSelfTestsV19/.test(publicRuntimeSource)],
  ["private adapter sends auth and cookies to the API", /Authorization/.test(adapter) && /credentials:\s*["']include["']/.test(adapter)],
  ["private adapter has no browser calculation fallback", !/calculateLeaseEngineImpl|calculateLeaseEngine\s*\(/.test(adapter)],
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
  `TFRS16 private cutover gate OK (${checks.length} source assertions; ${callSites} tracked references: ` +
  `${productionRows.length} production, ${commentRows.length} comments, ${knownGapRows.length} known FAZ 2 gap)`
);
if (knownGapRows.length > 0) {
  console.log(
    "NOTE: v26BuildConsolidationRows still calls calculateLeaseEngine() directly (not private-gated). " +
    "This is tracked, allowlisted FAZ 2 work — see the comment above KNOWN_FAZ2_CALL_SITES."
  );
}
console.log(
  `Production consumers are private-gated; public UI runtime removal remains blocked until ` +
  `${productionRows.length} production references (plus the ${knownGapRows.length} known FAZ 2 gap above) ` +
  `are replaced by UI-only private result readers.`
);
