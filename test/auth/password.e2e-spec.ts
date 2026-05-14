import * as request from 'supertest';
import {
  createTestApp,
  TestApp,
  VALID_PASSWORD,
  registerAndVerify,
} from '../helpers/app.helper';

describe('Password management (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('POST /auth/forgot-password', () => {
    it('sends reset OTP to verified email', async () => {
      const { email } = await registerAndVerify(server, testApp.mail);

      await request(server)
        .post('/auth/forgot-password')
        .send({ email })
        .expect(201);

      expect(testApp.mail.getResetCode(email)).toMatch(/^\d{6}$/);
    });

    it('does not reveal whether email exists (safe response)', async () => {
      const res = await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'nobody@e2e.test' });

      // Security: must not return 404 to avoid user enumeration
      expect(res.status).not.toBe(404);
      expect([200, 201]).toContain(res.status);
    });

    it('returns 400 with invalid email format', async () => {
      await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('resets password with valid OTP and allows login with new password', async () => {
      const { email } = await registerAndVerify(server, testApp.mail);
      await request(server).post('/auth/forgot-password').send({ email }).expect(201);
      const code = testApp.mail.getResetCode(email)!;
      const newPassword = 'NewWalvy2024';

      await request(server)
        .post('/auth/reset-password')
        .send({ email, code, newPassword })
        .expect(201);

      await request(server)
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(201);
    });

    it('old password no longer works after reset', async () => {
      const { email } = await registerAndVerify(server, testApp.mail);
      await request(server).post('/auth/forgot-password').send({ email }).expect(201);
      const code = testApp.mail.getResetCode(email)!;

      await request(server)
        .post('/auth/reset-password')
        .send({ email, code, newPassword: 'NewWalvy2024' })
        .expect(201);

      await request(server)
        .post('/auth/login')
        .send({ email, password: VALID_PASSWORD })
        .expect(401);
    });

    it('returns 400 with wrong OTP', async () => {
      const { email } = await registerAndVerify(server, testApp.mail);
      await request(server).post('/auth/forgot-password').send({ email }).expect(201);

      await request(server)
        .post('/auth/reset-password')
        .send({ email, code: '000000', newPassword: 'NewWalvy2024' })
        .expect(400);
    });

    it('returns 400 with non-numeric OTP format', async () => {
      await request(server)
        .post('/auth/reset-password')
        .send({ email: 'x@e2e.test', code: 'abcdef', newPassword: 'NewWalvy2024' })
        .expect(400);
    });

    it('returns 400 with weak new password', async () => {
      const { email } = await registerAndVerify(server, testApp.mail);
      await request(server).post('/auth/forgot-password').send({ email }).expect(201);
      const code = testApp.mail.getResetCode(email)!;

      await request(server)
        .post('/auth/reset-password')
        .send({ email, code, newPassword: 'weakpass' })
        .expect(400);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('changes password and revokes existing sessions', async () => {
      const { email, accessToken, refreshToken } = await registerAndVerify(server, testApp.mail);
      const newPassword = 'NewWalvy2024!';

      await request(server)
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: VALID_PASSWORD, newPassword })
        .expect(200);

      // Old refresh token is revoked
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // Can login with new password
      await request(server)
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(201);
    });

    it('returns 401 with wrong current password', async () => {
      const { accessToken } = await registerAndVerify(server, testApp.mail);

      await request(server)
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'WrongPass99', newPassword: 'NewWalvy2024!' })
        .expect(401);
    });

    it('returns 400 with weak new password', async () => {
      const { accessToken } = await registerAndVerify(server, testApp.mail);

      await request(server)
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: VALID_PASSWORD, newPassword: 'weak' })
        .expect(400);
    });

    it('returns 401 without access token', async () => {
      await request(server)
        .patch('/users/me/password')
        .send({ currentPassword: VALID_PASSWORD, newPassword: 'NewWalvy2024!' })
        .expect(401);
    });
  });
});
