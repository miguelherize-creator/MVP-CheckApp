import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { MockMailService } from './mail.mock';

export interface TestApp {
  app: INestApplication;
  mail: MockMailService;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = new MockMailService();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  return { app, mail };
}

export function uniqueEmail(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@e2e.test`;
}

// Valid Chilean RUT (12345678-5 computed via modulo-11)
export const VALID_RUT = '12345678-5';
export const VALID_PASSWORD = 'Walvy2024';

export const BASE_REGISTER = {
  documentNumber: VALID_RUT,
  password: VALID_PASSWORD,
  acceptTerms: true,
  acceptPrivacy: true,
};

export async function registerUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(server)
    .post('/auth/register')
    .send({ ...BASE_REGISTER, email })
    .expect(201);

  return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

export async function registerAndVerify(
  server: ReturnType<INestApplication['getHttpServer']>,
  mail: MockMailService,
  email?: string,
): Promise<{ email: string; accessToken: string; refreshToken: string }> {
  const e = email ?? uniqueEmail();
  const { accessToken } = await registerUser(server, e);

  const code = mail.getVerificationCode(e);
  if (!code) throw new Error(`No verification code captured for ${e}`);

  await request(server)
    .post('/auth/email-verification/confirm')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ email: e, code })
    .expect(201);

  // Login to get tokens for an active user
  const loginRes = await request(server)
    .post('/auth/login')
    .send({ email: e, password: VALID_PASSWORD })
    .expect(201);

  return {
    email: e,
    accessToken: loginRes.body.accessToken,
    refreshToken: loginRes.body.refreshToken,
  };
}
