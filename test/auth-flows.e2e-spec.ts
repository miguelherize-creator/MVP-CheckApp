/**
 * Flujos de autenticación (integración / e2e).
 * Requiere PostgreSQL y archivo .env con DATABASE_URL y JWT_SECRET (igual que al arrancar la app).
 *
 * Ejecutar: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth flows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'Abcd1234';

  describe('Flujo 1 — Register → GET /users/me → Login → GET /users/me → Refresh', () => {
    it('completa el happy path', async () => {
      const email = `flow1_${Date.now()}@e2e.test`;

      const reg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'E2E Flow1',
          email,
          password,
          acceptTerms: true,
        })
        .expect(201);

      expect(reg.body.accessToken).toBeDefined();
      expect(reg.body.refreshToken).toBeDefined();
      expect(reg.body.user.email).toBe(email.toLowerCase());

      const me1 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .expect(200);

      expect(me1.body.email).toBe(email.toLowerCase());

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);

      expect(login.body.accessToken).toBeDefined();
      expect(login.body.refreshToken).toBeDefined();

      const me2 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(me2.body.email).toBe(email.toLowerCase());

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(refreshed.body.accessToken).toBeDefined();
      expect(refreshed.body.refreshToken).toBeDefined();

      const me3 = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(200);

      expect(me3.body.email).toBe(email.toLowerCase());
    });
  });

  describe('Flujo 2 — Solo Login → GET /users/me', () => {
    const email = `flow2_${Date.now()}@e2e.test`;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'E2E Flow2',
          email,
          password,
          acceptTerms: true,
        })
        .expect(201);
    });

    it('login y perfil', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(me.body.email).toBe(email.toLowerCase());
      expect(me.body.name).toBe('E2E Flow2');
    });
  });
});
