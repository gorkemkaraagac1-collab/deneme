require("dotenv").config();

const https = require("https");

const apiKey = process.env.TUIK_API_KEY;

const body = new URLSearchParams({
  client_id: "nsi-ws-consumer",
  grant_type: "client_credentials",
  api_key: apiKey
}).toString();

const req = https.request(
  "https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  },
  res => {
    let response = "";

    res.setEncoding("utf8");

    res.on("data", chunk => {
      response += chunk;
    });

    res.on("end", () => {
      console.log("HTTP STATUS:", res.statusCode);
      console.log("RESPONSE:", response.substring(0, 1000));
    });
  }
);

req.on("error", error => {
  console.error("REQUEST ERROR:", error.message);
});

req.write(body);
req.end();
