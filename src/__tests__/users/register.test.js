// src/__tests__/users/login.test.js
import request from "supertest";

const url = "http://localhost:4000";
const path = "/user/regist";
const obj = { name: "Carlos Ivan", email: "car123@gmail.com", password: "123" };
const objArr = [{ name: "Jose Lopez Lopez", email: "user1@gmail.com", password: "123" }, +{ name: "Mario Flores Lara", email: "marioHernandez@gmail.com", password: "123" }]
const obj400 = {};
const objArr400 = [];

describe("Register API 201", () => {
  test("Register - Only User", async () => {
    const response = await request(url)
      .post(path)
      .send(obj);
    console.log(response.body)
    logger.info(new Date().toISOString()+ " - Status del test: " + response.status);
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
  });
});

describe("Register API 201", () => {
  test("Register - All Users", async () => {
    const response = await request(url)
      .post(path)
      .send(objArr);
    console.log(response.body)
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 400', () => {
  test('Register - Only User', async () => {
    const response = await request(url)
      .post(path)
      .send(obj400);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 400', () => {
  test('Register - All Users', async () => {
    const response = await request(url)
      .post(path)
      .send(objArr400);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 409', () => {
  test('Register - Only User', async () => {
    const response = await request(url)
      .post(path)
      .send(obj);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(409);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 409', () => {
  test('Register - All Users', async () => {
    const response = await request(url)
      .post(path)
      .send(objArr);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(409);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 500', () => {
  test('Register - Only User', async () => {
    const response = await request(url)
      .post(path)
      .send(obj);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(500);
    expect(response.body).toBeDefined();
  });
});

describe('Register API 500', () => {
  test('Register - All Users', async () => {
    const response = await request(url)
      .post(path)
      .send(objArr);
    console.log(response.body);
    logger.info(new Date().toISOString() + " - Status del test: " + response.status);

    expect(response.status).toBe(500);
    expect(response.body).toBeDefined();
  });
});