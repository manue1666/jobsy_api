import request from "supertest";
const pathLogin = "/user/login";
const obj = { email: "carlos@gmail.com", password: "123" }
const url = "http://localhost:4000";
const id = "68f97d6f8b293930c0393c90";

describe('Add Comments API', () => {
    test('Add Comments', async () => {
        const login = await request(url).post(pathLogin).send(obj);
        const token = login.body.token;
        const user = login.body.user;
        const comment = await resque(url).post(`/comment/post/${id}`).set("Authorization", `Bearer ${token}`).send(user);
        logger.info(new Date().toISOString() + " - Status del test: " + comment.status);

        expect(comment.status).toBe(201);
    });
});