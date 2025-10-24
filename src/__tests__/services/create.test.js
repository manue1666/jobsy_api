import request from "supertest";

const url = "http://localhost:4000";
const path = "/service/post";
const pathLogin = "/user/login";

describe('Create Service API', () => {
    test('Create Service', async () => {
        const login = await request(url).post(pathLogin).send({ email: "carlos@gmail.com", password: "123" });
        const token = login.body.token;

        const service = await request(url)
            .post(path)
            .set('Authorization', `Bearer ${token}`)
            .field('service_name', 'Electricista Pro')
            .field('category', 'hogar')
            .field('description', 'Reparaciones eléctricas profesionales')
            .field('phone', '+521231231234')
            .field('email', 'test@example.com')
            .field('address', 'Nueva York, USA')
            .field('tipo', '["domicilio","comercio"]');
        logger.info(new Date().toISOString() + " - Status del test: " + service.status);

        expect(service.status).toBe(201);
    });
});