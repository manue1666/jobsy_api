import request from "supertest";

const url = "http://localhost:4000";
const pathLogin = "/user/login";
const obj = { email: "carlos@gmail.com", password: "123" };
const id = "68f97d6f8b293930c0393c90";
const planId = { planId: "24h" };

describe('Bost API', () => {
    test('Bost', async () => {
        const login = await request(url).post(pathLogin).send(obj);
        const token = login.body.token;

        const boost = await request(url).post(`/service/boost/${id}`).set("Authorization", `Bearer ${token}`).send(planId);
        logger.info(new Date().toISOString() + " - Status del test: " + boost.status);

        expect(boost.status).toBe(200);
    });
});