import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from './modules/bookings/bookings.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // 1. Load biến môi trường từ file .env
    ConfigModule.forRoot({
      isGlobal: true, // Để dùng ConfigService ở mọi nơi không cần import lại
    }),

    // 2. Kết nối Database PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'StrongPassword123!', // Matches docker-compose.yml
      database: process.env.DB_NAME || 'uni_facility_db',

      // Tự động load tất cả entities (Booking, BookingDetail,...)
      autoLoadEntities: true,

      // QUAN TRỌNG: set false vì bạn đã có file init.sql chuẩn rồi. 
      // Nếu để true, TypeORM có thể tự sửa schema làm hỏng các Constraint/Trigger xịn của bạn.
      synchronize: false,
    }),

    // 3. Import Feature Modules
    BookingsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }