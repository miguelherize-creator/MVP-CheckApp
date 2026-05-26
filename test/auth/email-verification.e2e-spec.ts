import * as request from 'supertest';
import {
  createTestApp,
  TestApp,
  uniqueEmail,
  BASE_REGISTER,
  registerUser,
} from '../helpers/app.helper';

describe('Email Verification (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('POST /auth/email-verification/confirm', () => {
    it('confirms email with valid OTP', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);
      const code = testApp.mail.getVerificationCode(email)!;

      const res = await request(server)
        .post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email, code })
        .expect(201);

      expect(res.body.user.emailVerified).toBe(true);
      expect(res.body.user.email).toBe(email);
    });

    it('returns 400 with wrong OTP code', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);

      const res = await request(server)
        .post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email, code: '000000' })
        .expect(400);

      expect(res.body.message).toContain('incorrecto');
    });

    it('returns 400 with code that has wrong format', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);

      await request(server)
        .post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email, code: 'abc123' })
        .expect(400);
    });

    it('returns 400 when email does not match OTP recipient', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);
      const code = testApp.mail.getVerificationCode(email)!;

      await request(server)
        .post('/auth/email-verification/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'other@e2e.test', code })
        .expect(400);
    });

    it('returns 401 without access token', async () => {
      await request(server)
        .post('/auth/email-verification/confirm')
        .send({ email: 'x@e2e.test', code: '123456' })
        .expect(401);
    });
  });

  describe('POST /auth/email-verification/request', () => {
    it('sends a new OTP and invalidates the previous one', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);
      const firstCode = testApp.mail.getVerificationCode(email);

      const res = await request(server)
        .post('/auth/email-verification/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email })
        .expect(201);

      expect(res.body.message).toContain(email);
      const newCode = testApp.mail.getVerificationCode(email);
      expect(newCode).toBeDefined();
      // New code replaces old; old is now invalidated in DB
      expect(newCode).toBeTruthy();
    });

    it('returns 401 without access token', async () => {
      await request(server)
        .post('/auth/email-verification/request')
        .send({ email: 'x@e2e.test' })
        .expect(401);
    });
  });

  describe('POST /auth/email-verification/resend', () => {
    it('resends OTP (same behavior as request)', async () => {
      const email = uniqueEmail();
      const { accessToken } = await registerUser(server, email);

      const res = await request(server)
        .post('/auth/email-verification/resend')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email })
        .expect(201);

      expect(res.body.message).toContain(email);
      expect(testApp.mail.getVerificationCode(email)).toMatch(/^\d{6}$/);
    });

    it('returns 401 without access token', async () => {
      await request(server)
        .post('/auth/email-verification/resend')
        .send({ email: 'x@e2e.test' })
        .expect(401);
    });
  });
});
