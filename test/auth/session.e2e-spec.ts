import * as request from 'supertest';
import {
  createTestApp,
  TestApp,
  registerAndVerify,
} from '../helpers/app.helper';

describe('Session management (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('POST /auth/refresh', () => {
    it('returns new access and refresh tokens', async () => {
      const { refreshToken } = await registerAndVerify(server, testApp.mail);

      const res = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('issues a new token on refresh (rotation)', async () => {
      const { refreshToken: original } = await registerAndVerify(server, testApp.mail);

      const refreshRes = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: original })
        .expect(201);

      const rotated = refreshRes.body.refreshToken;
      expect(rotated).not.toBe(original);

      // Rotated token works (do not re-use original after this — reuse detection would revoke it)
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: rotated })
        .expect(201);
    });

    it('rejects reuse of an already-consumed refresh token', async () => {
      const { refreshToken: original } = await registerAndVerify(server, testApp.mail);

      // Consume the token once
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: original })
        .expect(201);

      // Reuse triggers replay-attack detection → 401 and revokes all sessions
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: original })
        .expect(401);
    });

    it('returns 401 with an invalid refresh token', async () => {
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-valid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token', async () => {
      const { refreshToken } = await registerAndVerify(server, testApp.mail);

      await request(server)
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(201);

      // Revoked token must not work
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('is idempotent (no error when called twice on same token)', async () => {
      const { refreshToken } = await registerAndVerify(server, testApp.mail);

      await request(server).post('/auth/logout').send({ refreshToken }).expect(201);
      // Second call silently succeeds — logout does not fail on already-revoked tokens
      await request(server).post('/auth/logout').send({ refreshToken }).expect(201);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('revokes all active sessions', async () => {
      const { accessToken, refreshToken } = await registerAndVerify(server, testApp.mail);

      await request(server)
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // All refresh tokens (including the one from login) are revoked
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('returns 401 without access token', async () => {
      await request(server)
        .post('/auth/logout-all')
        .expect(401);
    });
  });
});
