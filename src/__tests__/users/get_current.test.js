import request from "supertest";

const url = "http://localhost:4000";
const pathLogin = "/user/login";
const obj = {email : "classycrascras@gmail.com", password: "123"}
const path = "/user/me";

describe('Get Current API', () => {
  test('Get Current',async () => {
    const login = await request(url).post(pathLogin).send(obj);
    const token = login.body.token;
    const user = login.body.user;

    const get_current_user = await request(url).get(path).set("Authorization", `Bearer ${token}`).send(user);
    expect(get_current_user.status).toBe(200);
  });
});