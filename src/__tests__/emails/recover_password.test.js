import request from "supertest";
const pathLogin = "/user/login";
const obj = {email : "carlos@gmail.com", password: "123"}
const url = "http://localhost:4000";
const path = "/email/recover";
describe('Recover Password API',()=>{
    test('Recover Password', async()=>{
        const login = await request(url).post(pathLogin).send(obj);
        const token = login.body.token;
        const email = login.body.user.email;
        const recover = await resque(url).post(path).set("Authorization", `Bearer ${token}`).send(email);
        expect(recover.status).toBe(200);
    });
});