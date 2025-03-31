import * as dotenv from 'dotenv';

dotenv.config(); // Load .env variables immediately

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe());
  app.use(
    '/api/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }) // Ensure raw body for Stripe verification
  );

  app.enableCors({
    origin: ['https://www.moverlead.com', 'wss://api.moverlead.com', '*', 'https://localhost:3000'],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type, Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('MoverLead Documentation')
    .setDescription('MoverLead Backend documentation for API references')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, documentFactory);

  // Expose OpenAPI JSON at /api-json
  app.getHttpAdapter().get('api-json', (req, res) => {
    res.json(document);
  });

  await app.listen(process.env.PORT ?? 3008);
}

bootstrap();
