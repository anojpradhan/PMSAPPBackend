import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AuthGuard } from './auth/guards/auth.guard';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  // for global token check
  app.useGlobalGuards(app.get(AuthGuard));

  app.enableCors({
    origin: ['https://pms-frontend-neon.vercel.app', 'http://localhost:5173'],
    credentials: true,
  });

  // Debug: log current dir + dist contents
  console.log('Current working directory:', process.cwd());
  console.log('Does dist exist?', fs.existsSync('dist'));
  console.log(
    'Files in dist:',
    fs
      .readdirSync('dist', { withFileTypes: true })
      .map((f) => (f.isDirectory() ? `${f.name}/` : f.name)),
  );

  // Optional: log if main.js exists
  const mainPath = path.join(process.cwd(), 'dist', 'main.js');
  console.log('dist/main.js exists?', fs.existsSync(mainPath));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
