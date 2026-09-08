/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

describe("new contract form", () => {
  test("renders the required contract ID field consumed by the submit handler", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "tfrs16.html"), "utf8");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const field = dom.querySelector("#contractForm #contractId");

    expect(field).not.toBeNull();
    expect(field.getAttribute("name")).toBe("contractId");
    expect(field.getAttribute("type")).toBe("text");
    expect(field.hasAttribute("required")).toBe(true);
    expect(dom.querySelector('label[for="contractId"]')?.textContent).toContain("Sözleşme ID");
  });
});
