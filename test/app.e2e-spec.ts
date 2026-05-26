import * as request from 'supertest';
import { createTestApp, TestApp } from './helpers/app.helper';

describe('Health (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('GET / returns service info', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/')
      .expect(200);

    expect(res.body.service).toBe('walvy-api');
  });

  it('GET /health returns { ok: true }', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body.ok).toBe(true);
  });

  it('GET /users/me returns 401 without token', async () => {
    await request(testApp.app.getHttpServer())
      .get('/users/me')
      .expect(401);
  });
});
