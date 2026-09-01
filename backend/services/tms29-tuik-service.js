const https = require("https");

const TUİK_API_URL =
  "https://data.tuik.gov.tr/Bulten/DownloadIstatistikselTablo?p=TuFE";

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json,text/plain,*/*"
        }
      },
      res => {
        let data = "";

        res.setEncoding("utf8");

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );

    req.on("error", reject);
  });
}

async function fetchTuikIndices() {
  const response = await httpsGet(TUİK_API_URL);

  if (response.statusCode !== 200) {
    throw new Error(`TÜİK API HTTP ${response.statusCode}`);
  }

  const body = response.body.trim();

  if (!body) {
    throw new Error("TÜİK API boş veri döndürdü.");
  }

  let data;

  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      "TÜİK endpoint JSON yerine farklı bir içerik döndürdü."
    );
  }

  return data;
}

module.exports = {
  fetchTuikIndices
};
