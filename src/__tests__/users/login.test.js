import request from "supertest";

const url = "http://localhost:4000";
const path = "/user/login";
const obj = { email: "classycrascras@gmail.com", password: "123" };
const obj400 = { email: "ds", password: "123" };
const obj500 = {};

describe("Login API", () => {
  test("Login 200", async () => {
    const response = await request(url)
      .post(path)
      .send(obj);
      console.log(response.body)
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});

describe("Login API", () => {
  test("Login 400", async () => {
    const response = await request(url)
      .post(path)
      .send(obj400);
      console.log(response.body)
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
  });
});

describe("Login API", () => {
  test("Login 500", async () => {
    const response = await request(url)
      .post(path)
      .send(obj500);
      console.log(response.body)
    expect(response.status).toBe(500);
    expect(response.body).toBeDefined();
  });
});
