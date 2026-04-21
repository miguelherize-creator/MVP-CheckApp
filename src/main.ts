import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isDev = process.env.NODE_ENV !== 'production';
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: isDev
      ? true
      : corsOrigin
        ? corsOrigin.split(',').map((o) => o.trim())
        : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Walvy API')
    .setDescription('MVP — autenticación y usuario')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

const port = process.env.PORT ?? 3000;
const host = process.env.HOST ?? 'localhost';

await app.listen(Number(port), '0.0.0.0');

console.log(`HTTP ${port} — Swagger: http://${host}:${port}/api`);
}

bootstrap();