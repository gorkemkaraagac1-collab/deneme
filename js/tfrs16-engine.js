    } else if (period === "custom") {
      const startLabel = periodStartExclusive ? periodStartExclusive.toLocaleDateString("tr-TR") : "";
      const endLabel = periodEndInclusive ? periodEndInclusive.toLocaleDateString("tr-TR") : "";
      title = `${startLabel} – ${endLabel} Özel Tarih Aralığı Muhasebe Fişi`;
