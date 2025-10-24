import request from "supertest";
const pathLogin = "/user/login";
const obj = { email: "classycrascras@gmail.com", password: "123" }
const url = "http://localhost:4000";
describe('Delete User API', () => {
  test('Delete User By Id', async () => {
    const login = await request(url).post(pathLogin).send(obj);
    const token = login.body.token;
    const id = login.body.user.id;

    const deleteResponse = await request(url).delete(`/users/delete/${id}`).set("Authorization", `Bearer ${token}`);
    logger.info(new Date().toISOString() + " - Status del test: " + deleteResponse.status);

    expect(deleteResponse.status).toBe(200);
  });
});