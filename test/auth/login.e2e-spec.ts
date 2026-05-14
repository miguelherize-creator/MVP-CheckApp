import * as request from 'supertest';
import {
  createTestApp,
  TestApp,
  uniqueEmail,
  BASE_REGISTER,
  VALID_PASSWORD,
  registerAndVerify,
} from '../helpers/app.helper';

describe('POST /auth/login (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('logs in a verified user and returns tokens', async () => {
    const { email } = await registerAndVerify(server, testApp.mail);

    const res = await request(server)
      .post('/auth/login')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.emailVerified).toBe(true);
    // Active user: no nextStep
    expect(res.body.nextStep).toBeUndefined();
  });

  it('returns nextStep: email_verification for unverified user', async () => {
    const email = uniqueEmail();
    await request(server)
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email })
      .expect(201);

    const res = await request(server)
      .post('/auth/login')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    expect(res.body.nextStep).toBe('email_verification');
  });

  it('returns 401 with wrong password', async () => {
    const { email } = await registerAndVerify(server, testApp.mail);

    await request(server)
      .post('/auth/login')
      .send({ email, password: 'WrongPass99' })
      .expect(401);
  });

  it('returns 401 with non-existent email', async () => {
    await request(server)
      .post('/auth/login')
      .send({ email: 'nobody@e2e.test', password: VALID_PASSWORD })
      .expect(401);
  });

  it('returns 400 when body is missing email', async () => {
    await request(server)
      .post('/auth/login')
      .send({ password: VALID_PASSWORD })
      .expect(400);
  });
});
