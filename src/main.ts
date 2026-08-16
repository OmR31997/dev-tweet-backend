import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getClientOriginsFromEnv } from './config/client-origin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = getClientOriginsFromEnv();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (corsOrigins.length === 0) {
    if (nodeEnv === 'production') {
      throw new Error(
        'CLIENT_ORIGIN is required in production (comma-separated allowed origins).',
      );
    }
    console.warn(
      '[env] CLIENT_ORIGIN is not set — browser CORS requests will be rejected. Set it in backend/.env',
    );
  }
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevTweetHub API')
    .setDescription(
      'REST API for DevTweetHub — authentication, posts, users, messages, groups, and notifications.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access token from POST /auth/login or /auth/refresh',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        console.log(
          `[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
        );
      });
      next();
    });
  }

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}`);
  console.log(`Swagger docs at http://${host}:${port}/docs`);
}

void bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
