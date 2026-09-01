const request = require("supertest");

describe("Authentication Security", () => {

  test("Login endpoint credentials olmadan 400 dönmeli", async () => {
    const app = require("../backend/app");

    const response = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(response.status).toBe(400);
  });

  test("Geçersiz token ile /me 401 dönmeli", async () => {
    const app = require("../backend/app");

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  test("Authorization header olmadan /me 401 dönmeli", async () => {
    const app = require("../backend/app");

    const response = await request(app)
      .get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  test("Hatalı Authorization scheme ile /me 401 dönmeli", async () => {
    const app = require("../backend/app");

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Basic invalid-token");

    expect(response.status).toBe(401);
  });

});
