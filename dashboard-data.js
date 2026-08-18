const TFRS16_STORAGE_KEY = "gk_tfrs16_contracts";

const defaultContracts = [
  {
    id: "LEASE-001",
    company: "GK Holding",
    supplier: "ABC Gayrimenkul",
    startDate: "2024-01-01",
    endDate: "2028-12-31",
    monthlyPayment: 250000,
    discountRate: 0.18,
    status: "active",
    renewalDate: "2027-12-31"
  },
  {
    id: "LEASE-002",
    company: "GK Holding",
    supplier: "XYZ Plaza",
    startDate: "2025-01-01",
    endDate: "2030-12-31",
    monthlyPayment: 180000,
    discountRate: 0.17,
    status: "active",
    renewalDate: "2026-11-30"
  },
  {
    id: "LEASE-003",
    company: "GK Holding",
    supplier: "Delta Logistics",
    startDate: "2023-07-01",
    endDate: "2027-06-30",
    monthlyPayment: 120000,
    discountRate: 0.19,
    status: "active",
    renewalDate: "2027-03-31"
  }
];

function getContracts() {

  const stored = localStorage.getItem(TFRS16_STORAGE_KEY);

  if (!stored) {
    return defaultContracts;
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("TFRS 16 verisi okunamadı:", error);
    return defaultContracts;
  }
}


function calculatePV(payment, annualRate, months) {

  const monthlyRate = annualRate / 12;

  if (monthlyRate === 0) {
    return payment * months;
  }

  return payment *
    (1 - Math.pow(1 + monthlyRate, -months))
    / monthlyRate;
}


function calculateContract(contract) {

  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;

  const leaseLiability = calculatePV(
    contract.monthlyPayment,
    contract.discountRate,
    months
  );

  const rouAsset = leaseLiability;

  const annualDepreciation =
    rouAsset / Math.max(months / 12, 1);

  return {

    ...contract,

    months,

    leaseLiability,

    rouAsset,

    annualDepreciation,

    monthlyDepreciation:
      annualDepreciation / 12

  };

}


function buildTFRS16Summary() {

  const contracts = getContracts()
    .map(calculateContract);

  const activeContracts =
    contracts.filter(c => c.status === "active");


  const leaseLiability =
    activeContracts.reduce(
      (sum, c) => sum + c.leaseLiability,
      0
    );


  const rouAssets =
    activeContracts.reduce(
      (sum, c) => sum + c.rouAsset,
      0
    );


  const monthlyPayments =
    activeContracts.reduce(
      (sum, c) => sum + c.monthlyPayment,
      0
    );


  const next12Months =
    monthlyPayments * 12;


  const today = new Date();

  const renewals90Days =
    activeContracts.filter(c => {

      const renewal =
        new Date(c.renewalDate);

      const diff =
        (renewal - today) /
        (1000 * 60 * 60 * 24);

      return diff >= 0 && diff <= 90;

    }).length;


  return {

    contracts:
      activeContracts.length,

    leaseLiability,

    rouAssets,

    next12Months,

    renewals90Days,

    modifications: 0

  };

}


window.CFO_DATA = {

  period: "Ağustos 2026",

  company: "GK Holding",

  financial: {

    revenue: 428.5,

    ebitda: 76.2,

    ebitdaMargin: 17.8,

    cash: 92.0,

    freeCashFlow: 34.0,

    netProfit: 41.7

  },

  workingCapital: {

    dso: 68,

    dpo: 52,

    inventoryDays: 58,

    cashConversionCycle: 74

  },

  close: {

    progress: 82,

    completed: 41,

    total: 50,

    target: "D+5"

  },

  tfrs16: buildTFRS16Summary(),

  risks: {

    critical: 1,

    warning: 2

  }

};
