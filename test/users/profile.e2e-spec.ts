import * as request from 'supertest';
import { createTestApp, TestApp, registerAndVerify, VALID_PASSWORD } from '../helpers/app.helper';

describe('User profile (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;
  let email: string;
  let accessToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
    ({ email, accessToken } = await registerAndVerify(server, testApp.mail));
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('GET /users/me', () => {
    it('returns the authenticated user profile', async () => {
      const res = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ email, emailVerified: true });
      expect(res.body).toHaveProperty('firstName');
      expect(res.body).toHaveProperty('lastName');
      expect(res.body).toHaveProperty('documentNumber');
      expect(res.body).toHaveProperty('trialEndsAt');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('returns 401 without token', async () => {
      await request(server).get('/users/me').expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates firstName, lastName and username', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Ana', lastName: 'Pérez', username: 'anapz' })
        .expect(200);

      expect(res.body.firstName).toBe('Ana');
      expect(res.body.lastName).toBe('Pérez');
      expect(res.body.username).toBe('anapz');
    });

    it('returns updated profile on GET /users/me', async () => {
      await request(server)
        .patch('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'María' })
        .expect(200);

      const res = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.firstName).toBe('María');
    });

    it('returns 401 without token', async () => {
      await request(server)
        .patch('/users/me')
        .send({ firstName: 'Ana' })
        .expect(401);
    });
  });

  describe('PATCH /users/profile', () => {
    it('updates firstName and lastName (onboarding display name step)', async () => {
      const res = await request(server)
        .patch('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Carlos', lastName: 'González' })
        .expect(200);

      expect(res.body.firstName).toBe('Carlos');
      expect(res.body.lastName).toBe('González');
    });

    it('accepts partial update (only username)', async () => {
      const res = await request(server)
        .patch('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'cargon' })
        .expect(200);

      expect(res.body.username).toBe('cargon');
    });

    it('returns 401 without token', async () => {
      await request(server)
        .patch('/users/profile')
        .send({ firstName: 'Ana' })
        .expect(401);
    });
  });
});
