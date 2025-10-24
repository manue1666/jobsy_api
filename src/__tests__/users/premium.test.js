import request from "supertest";

const url = "http://localhost:4000";
const pathLogin = "/user/login";
const pathPremium = "/user/premium";
const obj = {email : "classycrascras@gmail.com", password: "123"}

describe("Premium API",()=>{
  test("Premium  200", async ()=>{
    const login = await request(url).post(pathLogin).send(obj);
    const token = login.body.token;
    const premium = await request(url).post(pathPremium).set("Authorization", `Bearer ${token}`);
    expect(premium.status).toBe(200);
    expect(premium.body.requiresPaymentMethod).toBe(true);
  })
});