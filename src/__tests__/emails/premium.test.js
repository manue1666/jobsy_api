import request from "supertest";
const pathLogin = "/user/login";
const obj = {email : "carlos@gmail.com", password: "123"}
const url = "http://localhost:4000";
const path = "/email/post";
describe('Email Premium API',()=>{
    test('Email Premium', async()=>{
        const login = await request(url).post(pathLogin).send(obj);
        const token = login.body.token;
        const user = login.body.user;
        const email = await resque(url).post(path).set("Authorization", `Bearer ${token}`).send(user);
        expect(email.status).toBe(200);
    });
});