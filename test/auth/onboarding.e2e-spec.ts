import * as request from 'supertest';
import { createTestApp, TestApp, registerAndVerify } from '../helpers/app.helper';

describe('Onboarding & Biometric (e2e)', () => {
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

  describe('GET /auth/onboarding', () => {
    it('returns onboarding state for authenticated user', async () => {
      const res = await request(server)
        .get('/auth/onboarding')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        onboardingStatus: expect.any(String),
        biometricPrompted: expect.any(Boolean),
        importAttempted: expect.any(Boolean),
        minDocThresholdMet: expect.any(Boolean),
        financialProfileCompleted: expect.any(Boolean),
      });
    });

    it('returns 401 without token', async () => {
      await request(server).get('/auth/onboarding').expect(401);
    });
  });

  describe('PATCH /auth/biometric', () => {
    it('enables biometric and auto-sets biometricPrompted on onboarding', async () => {
      await request(server)
        .patch('/auth/biometric')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: true, method: 'face_id', deviceId: 'device-001' })
        .expect(200);

      const state = await request(server)
        .get('/auth/onboarding')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(state.body.biometricPrompted).toBe(true);
    });

    it('disables biometric', async () => {
      await request(server)
        .patch('/auth/biometric')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: false })
        .expect(200);
    });

    it('returns 400 when enabled:true but method is missing', async () => {
      await request(server)
        .patch('/auth/biometric')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enabled: true })
        .expect(400);
    });

    it('returns 401 without token', async () => {
      await request(server)
        .patch('/auth/biometric')
        .send({ enabled: false })
        .expect(401);
    });
  });

  describe('PATCH /auth/onboarding/step', () => {
    it('updates currentStep and resumeSurface', async () => {
      const res = await request(server)
        .patch('/auth/onboarding/step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentStep: 'document_upload', resumeSurface: 'onboarding' })
        .expect(200);

      expect(res.body.currentStep).toBe('document_upload');
      expect(res.body.resumeSurface).toBe('onboarding');
    });

    it('marks importAttempted when included in payload', async () => {
      const res = await request(server)
        .patch('/auth/onboarding/step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentStep: 'document_processing',
          resumeSurface: 'onboarding',
          importAttempted: true,
        })
        .expect(200);

      expect(res.body.importAttempted).toBe(true);
    });

    it('stores resumeContext as JSON', async () => {
      const ctx = { pendingStep: 'document_upload' };
      const res = await request(server)
        .patch('/auth/onboarding/step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ resumeSurface: 'home', resumeContext: ctx })
        .expect(200);

      expect(res.body.resumeContext).toMatchObject(ctx);
    });

    it('returns 401 without token', async () => {
      await request(server)
        .patch('/auth/onboarding/step')
        .send({ currentStep: 'welcome' })
        .expect(401);
    });
  });
});
