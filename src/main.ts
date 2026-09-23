import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: false,
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const prefix = config.get<string>('API_PREFIX', 'api/v1');

  app.use(helmet());
  app.use(compression());

  const configuredOrigins = config
    .get<string>('CORS_ALLOWED_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = Array.from(
    new Set(
      [
        ...configuredOrigins,
        config.get<string>('WEB_APP_URL'),
        config.get<string>('ADMIN_APP_URL'),
      ].filter((origin): origin is string => Boolean(origin)),
    ),
  );

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const enableSwagger =
    config.get<string>('ENABLE_SWAGGER', isProduction ? 'false' : 'true') === 'true';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Yuthika Organics API')
      .setDescription('Production API for Yuthika Organics storefront, admin and mobile apps.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(config.get<string>('SWAGGER_PATH', 'docs'), app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const prisma = app.get(PrismaService);
  await prisma.$connect();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`Yuthika Organics API running on port ${port}`);
  if (!isProduction) {
    console.log(`API: http://localhost:${port}/${prefix}`);
    if (enableSwagger) {
      console.log(`Docs: http://localhost:${port}/${config.get<string>('SWAGGER_PATH', 'docs')}`);
    }
  }
}

bootstrap();
