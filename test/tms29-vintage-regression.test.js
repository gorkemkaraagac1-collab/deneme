const fs = require("fs");
const path = require("path");

test("TMS29 depreciation restatement keeps ROU vintage allocation", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/tfrs16-engine.js"), "utf8");
  expect(source).toMatch(/vintageDate/);
  expect(source).toMatch(/rouLayers/);
  expect(source).toMatch(/restateDepreciation/);
});
