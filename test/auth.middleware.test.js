const jwt = require("jsonwebtoken");

describe("Authentication Middleware", () => {

  let requireAuth;
  let verifyUserTokenMock;

  beforeEach(() => {

    jest.resetModules();

    verifyUserTokenMock = jest.fn();

    jest.doMock("../backend/utils/jwt", () => ({
      verifyUserToken: verifyUserTokenMock
    }));

    requireAuth =
      require("../backend/middleware/auth")
        .requireAuth;
  });


  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });


  function createResponse() {

    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

  }


  test("Authorization header yoksa 401 döner", () => {

    const req = {
      headers: {}
    };

    const res = createResponse();

    const next = jest.fn();

    requireAuth(
      req,
      res,
      next
    );

    expect(
      res.status
    ).toHaveBeenCalledWith(401);

    expect(
      next
    ).not.toHaveBeenCalled();

  });


  test("Authorization header Bearer değilse 401 döner", () => {

    const req = {
      headers: {
        authorization:
          "Basic abc123"
      }
    };

    const res = createResponse();

    const next = jest.fn();

    requireAuth(
      req,
      res,
      next
    );

    expect(
      res.status
    ).toHaveBeenCalledWith(401);

    expect(
      next
    ).not.toHaveBeenCalled();

  });


  test("Bearer token eksikse 401 döner", () => {

    const req = {
      headers: {
        authorization:
          "Bearer"
      }
    };

    const res = createResponse();

    const next = jest.fn();

    requireAuth(
      req,
      res,
      next
    );

    expect(
      res.status
    ).toHaveBeenCalledWith(401);

    expect(
      next
    ).not.toHaveBeenCalled();

  });


  test("Geçersiz token 401 döner", () => {

    verifyUserTokenMock.mockImplementation(
      () => {
        throw new Error(
          "Invalid token"
        );
      }
    );

    const req = {
      headers: {
        authorization:
          "Bearer invalid-token"
      }
    };

    const res = createResponse();

    const next = jest.fn();

    requireAuth(
      req,
      res,
      next
    );

    expect(
      verifyUserTokenMock
    ).toHaveBeenCalledWith(
      "invalid-token"
    );

    expect(
      res.status
    ).toHaveBeenCalledWith(401);

    expect(
      next
    ).not.toHaveBeenCalled();

  });


  test("Geçerli token req.user oluşturur", () => {

    verifyUserTokenMock.mockReturnValue({

      sub: "USER-001",

      username:
        "testuser",

      role:
        "ADMIN",

      companyIds: [
        "COMPANY-A",
        "COMPANY-B"
      ]

    });


    const req = {

      headers: {

        authorization:
          "Bearer valid-token"

      }

    };


    const res =
      createResponse();

    const next =
      jest.fn();


    requireAuth(
      req,
      res,
      next
    );


    expect(
      verifyUserTokenMock
    ).toHaveBeenCalledWith(
      "valid-token"
    );


    expect(
      req.user
    ).toEqual({

      id:
        "USER-001",

      username:
        "testuser",

      role:
        "ADMIN",

      companyIds: [
        "COMPANY-A",
        "COMPANY-B"
      ],

      // P3 DÜZELTMESİ (test regresyonu): requireAuth P1-D'den beri
      // req.user'a mustChangePassword de koyuyor (bkz.
      // middleware/auth.js) — bu test P1'den ÖNCE yazılmıştı ve
      // güncellenmemişti, gerçek (doğru) davranışla artık eşleşmeyen
      // eski bir beklenti taşıyordu. Kod DEĞİL, test güncellendi.
      mustChangePassword: false

    });


    expect(
      next
    ).toHaveBeenCalledTimes(1);

    expect(
      res.status
    ).not.toHaveBeenCalled();

  });


  test("companyIds array değilse boş array atanır", () => {

    verifyUserTokenMock.mockReturnValue({

      sub:
        "USER-002",

      username:
        "viewer",

      role:
        "VIEWER",

      companyIds:
        null

    });


    const req = {

      headers: {

        authorization:
          "Bearer valid-token"

      }

    };


    const res =
      createResponse();

    const next =
      jest.fn();


    requireAuth(
      req,
      res,
      next
    );


    expect(
      req.user.companyIds
    ).toEqual([]);

    expect(
      next
    ).toHaveBeenCalledTimes(1);

  });


  test("companyIds içindeki değerler string'e çevrilir", () => {

    verifyUserTokenMock.mockReturnValue({

      sub:
        "USER-003",

      username:
        "numeric-company-user",

      role:
        "VIEWER",

      companyIds: [
        1001,
        1002
      ]

    });


    const req = {

      headers: {

        authorization:
          "Bearer valid-token"

      }

    };


    const res =
      createResponse();

    const next =
      jest.fn();


    requireAuth(
      req,
      res,
      next
    );


    expect(
      req.user.companyIds
    ).toEqual([
      "1001",
      "1002"
    ]);

  });


  test("Geçerli token ile next çağrılır", () => {

    verifyUserTokenMock.mockReturnValue({

      sub:
        "USER-004",

      username:
        "test",

      role:
        "VIEWER",

      companyIds:
        ["COMPANY-A"]

    });


    const req = {

      headers: {

        authorization:
          "Bearer valid-token"

      }

    };


    const res =
      createResponse();

    const next =
      jest.fn();


    requireAuth(
      req,
      res,
      next
    );


    expect(
      next
    ).toHaveBeenCalledTimes(1);

  });

});
