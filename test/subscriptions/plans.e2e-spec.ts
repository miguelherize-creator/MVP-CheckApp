import * as request from 'supertest';
import { createTestApp, TestApp, registerAndVerify } from '../helpers/app.helper';

describe('Subscriptions (e2e)', () => {
  let testApp: TestApp;
  let server: ReturnType<TestApp['app']['getHttpServer']>;
  let accessToken: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer();
    ({ accessToken } = await registerAndVerify(server, testApp.mail));
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('GET /subscriptions/plans', () => {
    it('returns plans without authentication (public endpoint)', async () => {
      const res = await request(server)
        .get('/subscriptions/plans')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('includes pro_monthly and pro_annual plans', async () => {
      const res = await request(server)
        .get('/subscriptions/plans')
        .expect(200);

      const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
      expect(slugs).toContain('pro_monthly');
      expect(slugs).toContain('pro_annual');
    });

    it('returns price as a number (not a string)', async () => {
      const res = await request(server)
        .get('/subscriptions/plans')
        .expect(200);

      for (const plan of res.body) {
        expect(typeof plan.price).toBe('number');
      }
    });

    it('annual plan saves money vs monthly × 12', async () => {
      const res = await request(server)
        .get('/subscriptions/plans')
        .expect(200);

      const monthly = res.body.find((p: { slug: string }) => p.slug === 'pro_monthly');
      const annual = res.body.find((p: { slug: string }) => p.slug === 'pro_annual');

      expect(monthly).toBeDefined();
      expect(annual).toBeDefined();
      expect(annual.price).toBeLessThan(monthly.price * 12);
    });
  });

  describe('GET /subscriptions/me', () => {
    it('returns subscription state for authenticated user', async () => {
      const res = await request(server)
        .get('/subscriptions/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // New user has no paid subscription; response is null or object
      expect(res.status).toBe(200);
    });

    it('returns 401 without token', async () => {
      await request(server)
        .get('/subscriptions/me')
        .expect(401);
    });
  });

  describe('POST /subscriptions/checkout', () => {
    it('returns 401 without token', async () => {
      await request(server)
        .post('/subscriptions/checkout')
        .send({ planId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);
    });

    it('returns 400 or 404 with a non-existent planId', async () => {
      const res = await request(server)
        .post('/subscriptions/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ planId: '00000000-0000-0000-0000-000000000000' });

      expect([400, 404]).toContain(res.status);
    });

    it('returns 400 when planId is missing', async () => {
      await request(server)
        .post('/subscriptions/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });
});
