import request from "supertest";
const url = "http://localhost:4000";
const path = "/user/password";
const pathLogin = "/user/login";
const obj = { email: "classycrascras@gmail.com", password: "123" };
const password = "12345"

describe('Password API', () => {
  test('Update Password', async () => {
    const login = await request(url).post(pathLogin).send(obj);
    const token = login.body.token;

    const update = await request(url).patch(path).set("Authorization", `Bearer ${token}`).send({ currentPassword: obj.password, password: password });
    logger.info(new Date().toISOString() + " - Status del test: " + update.status);

    expect(update.status).toBe(200);
  });
});