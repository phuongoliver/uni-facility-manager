import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Kích hoạt Validation toàn cục (BẮT BUỘC)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // Tự động loại bỏ các field thừa không có trong DTO
    transform: true,            // Tự động convert data (ví dụ string "1" -> number 1)
    forbidNonWhitelisted: true, // Báo lỗi ngay nếu Frontend gửi field lạ
  }));

  // 2. Đặt prefix cho API -> http://localhost:3000/api/bookings
  app.setGlobalPrefix('api');

  // 3. Enable CORS (để Frontend Next.js gọi được)
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3500);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();