import * as request from 'supertest';
import {
  createTestApp,
  TestApp,
  uniqueEmail,
  BASE_REGISTER,
  VALID_RUT,
  VALID_PASSWORD,
} from '../helpers/app.helper';

describe('POST /auth/register (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('registers a new user and returns tokens + nextStep', async () => {
    const email = uniqueEmail();
    const res = await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email })
      .expect(201);

    expect(res.body.user).toMatchObject({ email, emailVerified: false });
    expect(res.body.user.firstName).toBeNull();
    expect(res.body.user.lastName).toBeNull();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.nextStep).toBe('email_verification');
  });

  it('sends OTP to the registered email', async () => {
    const email = uniqueEmail();
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email })
      .expect(201);

    expect(testApp.mail.getVerificationCode(email)).toMatch(/^\d{6}$/);
  });

  it('returns 409 when email already exists', async () => {
    const email = uniqueEmail();
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email })
      .expect(409);
  });

  it('returns 400 when acceptTerms is false', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), acceptTerms: false })
      .expect(400);
  });

  it('returns 400 when acceptPrivacy is false', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), acceptPrivacy: false })
      .expect(400);
  });

  it('returns 400 with invalid email format', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: 'not-an-email' })
      .expect(400);
  });

  it('returns 400 with password missing uppercase', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), password: 'walvy2024' })
      .expect(400);
  });

  it('returns 400 with password too short', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), password: 'W1vy' })
      .expect(400);
  });

  it('returns 400 with invalid RUT', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), documentNumber: '12345678-0' })
      .expect(400);
  });

  it('returns 400 when required fields are missing', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ email: uniqueEmail() })
      .expect(400);
  });

  it('returns 400 when extra fields are sent (forbidNonWhitelisted)', async () => {
    await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({ ...BASE_REGISTER, email: uniqueEmail(), unknownField: 'value' })
      .expect(400);
  });
});
