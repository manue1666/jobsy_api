import { get } from "mongoose";
import request from "supertest";
const pathLogin = "/user/login";
const obj = { email: "classycrascras@gmail.com", password: "123" }
describe('Get Data API', () => {
  test('Get Data', async () => {
    const login = await request(url).post(pathLogin).send(obj);
    const id = login.body.user.id;
    const token = login.body.token;
    const get_data = await request(url).get(`/user/data/${id}`).set("Authorization", `Bearer ${token}`);
    logger.info(new Date().toISOString() + " - Status del test: " + get_data.status);

    expect(get_data.status).toBe(200);
  });
});